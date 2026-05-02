/**
 * SWAP write E2E — exercises the full trader path through the SDK against the
 * live program: open_swap → close_position_early. This is the highest-fidelity
 * proof that the SDK's `direction` enum encoding, BN args, and 22-account
 * close-early ordering all line up with what the program expects.
 *
 * settle_period is NOT exercised here — settlement_period_seconds = 86_400
 * by design, and surfpool's clock advance moves slots, not unix_timestamp,
 * so we can't fast-forward the on-chain `Clock::get().unix_timestamp` past
 * the next-settlement gate without keeper-bot orchestration that's outside
 * the SDK's scope. close_position_early covers the same trader-side close
 * paths through the SDK.
 *
 * Flow:
 *   1. Bootstrap protocol + market + rate index + LP deposit (idempotent)
 *   2. Mint USDC to trader (deployer wallet)
 *   3. open_swap PayFixed 100 USDC notional, 20 USDC collateral
 *   4. Verify SwapPosition exists with expected fields
 *   5. close_position_early — trader takes any PnL + remaining collateral
 *   6. Verify position is closed and trader USDC balance changed
 */

import { BN } from "@coral-xyz/anchor";
import { describe, it, expect, beforeAll } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { rpcAvailable } from "./helpers/connection";
import { bootstrapEnvironment, seedRateIndex } from "./helpers/bootstrap";
import type { BootstrapResult } from "./helpers/bootstrap";
import {
  KAMINO_LENDING_MARKET,
  SCOPE_PRICES,
  refreshReserveIx,
  setTokenBalance,
} from "./helpers/surfpool";
import { SwapDirection } from "../src/domain/enums";
import { PdaDeriver } from "../src/infrastructure/pda/PdaDeriver";

const NONCE = 7; // unique per test run; bump if a prior position exists

describe("E2E: swap open + close lifecycle through SDK", () => {
  let ctx: BootstrapResult | null = null;
  let swapPositionAddress: PublicKey;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
    await seedRateIndex(ctx);

    // Mint USDC for both LP deposits and trader collateral. 1000 USDC.
    await setTokenBalance(
      ctx.connection,
      ctx.deployer.publicKey,
      ctx.underlyingMint,
      1_000_000_000
    );

    // Make sure the LP-token ATA exists so deposit_liquidity works.
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.lpMintPda,
      ctx.deployer.publicKey
    );

    // Bundle a sync_kamino_yield to keep last_kamino_sync_ts fresh — both LP
    // and trader handlers gate on MAX_NAV_STALENESS_SECS.
    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });
    await ctx.rawProgram.methods
      .syncKaminoYield()
      .accountsStrict({
        market: ctx.marketPda,
        kaminoReserve: ctx.underlyingReserve,
        kaminoDepositAccount: ctx.kaminoDepositPda,
        kaminoLendingMarket: KAMINO_LENDING_MARKET,
        pythOracle: ctx.underlyingProtocol,
        switchboardPriceOracle: ctx.underlyingProtocol,
        switchboardTwapOracle: ctx.underlyingProtocol,
        scopePrices: SCOPE_PRICES,
        kaminoProgram: ctx.underlyingProtocol,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions([refresh])
      .rpc();

    // LP deposit so the vault has liquidity for traders to swap against.
    // The 100 USDC PayFixed below + max 60% utilization → need at least
    // 100/0.6 ≈ 167 USDC of NAV. Top up to 500 USDC if we're below that.
    const market = await ctx.rawProgram.account.swapMarket.fetch(ctx.marketPda);
    const MIN_NAV = 200_000_000n; // 200 USDC
    const currentNav = BigInt(market.lpNav.toString());
    if (currentNav < MIN_NAV) {
      await ctx.sdk.lp.depositLiquidity.execute({
        depositor: ctx.deployer.publicKey,
        market: ctx.marketPda,
        underlyingMint: ctx.underlyingMint,
        lpMint: ctx.lpMintPda,
        lpVault: ctx.lpVaultPda,
        amount: 500_000_000n, // 500 USDC
      });
    }
  }, 120_000);

  it("open_swap PayFixed via SDK (notional=100 USDC, collateral=20 USDC)", async () => {
    if (!ctx) return;

    // Skip if a position with this nonce already exists (test is one-shot).
    const { address } = await PdaDeriver.swapPosition(
      ctx.deployer.publicKey,
      ctx.marketPda,
      NONCE
    );
    swapPositionAddress = address;
    const exists = await ctx.connection.getAccountInfo(address);
    if (exists) {
      console.warn(
        `[E2E skip] SwapPosition with nonce=${NONCE} already exists. Bump NONCE.`
      );
      return;
    }

    // SDK does NOT manage collateral_remaining — that field is set internally
    // when the trader sends collateral via open_swap. Caller transfers the
    // collateral amount + opening fee through trader_token_account; the
    // program splits it. Here we send 20 USDC; the program's open_swap reads
    // out collateral and routes opening_fee_bps to treasury.

    const result = await ctx.sdk.trader.openSwap.execute({
      trader: ctx.deployer.publicKey,
      market: ctx.marketPda,
      underlyingMint: ctx.underlyingMint,
      treasury: ctx.treasury,
      collateralVault: ctx.collateralVaultPda,
      direction: SwapDirection.PayFixed,
      notional: 100_000_000n, // 100 USDC
      nonce: NONCE,
      maxRateBps: 65_535n, // very loose; UI would tighten
      minRateBps: 0n,
    });

    expect(result.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);
    expect(result.swapPositionAddress).toBe(address.toBase58());

    // Verify SwapPosition was created and has expected shape
    const pos = await ctx.sdk.query.positions.fetchSwapPosition(
      address.toBase58()
    );
    expect(pos).not.toBeNull();
    expect(pos!.owner).toBe(ctx.deployer.publicKey.toBase58());
    expect(pos!.market).toBe(ctx.marketPda.toBase58());
    expect(pos!.notional).toBe(100_000_000n);
    expect(pos!.direction).toBe(SwapDirection.PayFixed);
    expect(pos!.numSettlements).toBe(0);
    expect(pos!.collateralDeposited).toBeGreaterThan(0n);
  }, 60_000);

  it("close_position_early via SDK returns collateral to trader", async () => {
    if (!ctx) return;

    const pos = await ctx.sdk.query.positions.fetchSwapPosition(
      swapPositionAddress.toBase58()
    );
    if (!pos) {
      console.warn("[E2E skip] No open position to close.");
      return;
    }

    const traderAta = getAssociatedTokenAddressSync(
      ctx.underlyingMint,
      ctx.deployer.publicKey
    );
    const usdcBefore = (await ctx.connection
      .getTokenAccountBalance(traderAta)
      .then((r) => BigInt(r.value.amount))) as bigint;

    const result = await ctx.sdk.trader.closePositionEarly.execute({
      owner: ctx.deployer.publicKey,
      market: ctx.marketPda,
      swapPosition: swapPositionAddress,
      underlyingMint: ctx.underlyingMint,
      lpVault: ctx.lpVaultPda,
      collateralVault: ctx.collateralVaultPda,
      treasury: ctx.treasury,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: ctx.kamino.lendingMarket,
      kaminoLendingMarketAuthority: ctx.kamino.lendingMarketAuthority,
      reserveLiquidityMint: ctx.underlyingMint,
      reserveLiquiditySupply: ctx.kamino.reserveLiquiditySupply,
      reserveCollateralMint: ctx.kamino.reserveCollateralMint,
      collateralTokenProgram: TOKEN_PROGRAM_ID,
      liquidityTokenProgram: TOKEN_PROGRAM_ID,
    });

    expect(result.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);

    // Position account is closed (rent returned to owner)
    const closed = await ctx.connection.getAccountInfo(swapPositionAddress);
    expect(closed).toBeNull();

    // Trader received collateral back (minus early-close fee + any PnL loss)
    const usdcAfter = (await ctx.connection
      .getTokenAccountBalance(traderAta)
      .then((r) => BigInt(r.value.amount))) as bigint;
    // Should grow — collateral coming back exceeds early-close fee for a
    // position that just opened (no rate move = ~zero PnL, only fee paid).
    expect(usdcAfter).toBeGreaterThan(usdcBefore);
  }, 60_000);
});
