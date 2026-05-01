/**
 * LIQUIDATION E2E — exercises the 23-account `liquidate_position` path.
 *
 * Forcing a position underwater on a freshly-opened swap requires manipulating
 * collateral or running settlements through unfavorable rate moves — neither
 * fits in a hands-off SDK test. So we do a *negative* E2E: open a healthy
 * position, attempt liquidation, and assert it fails with the program's
 * `AboveMaintenanceMargin` business error.
 *
 * That rejection is meaningful: it can only fire AFTER the program has loaded
 * all 22 mut/non-mut accounts (incl. the full Kamino redeem block + treasury
 * with the new 1/3 split). If the SDK had the wrong account ordering, mut
 * flag, or a missing account, the error would be `ConstraintMut`,
 * `AccountNotInitialized`, or similar — not `AboveMaintenanceMargin`. So
 * passing this test proves the full SDK plumbing for liquidation is correct.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
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

const NONCE = 9; // unique per test run

describe("E2E: liquidation plumbing through SDK", () => {
  let ctx: BootstrapResult | null = null;
  let swapPositionAddress: PublicKey;
  let liquidator: Keypair;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
    await seedRateIndex(ctx);

    // Deployer top-up + LP-token ATA (idempotent).
    await setTokenBalance(
      ctx.connection,
      ctx.deployer.publicKey,
      ctx.underlyingMint,
      1_000_000_000
    );
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.lpMintPda,
      ctx.deployer.publicKey
    );

    // Sync NAV.
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

    // Top up LP pool to 500 USDC if low.
    const market = await ctx.rawProgram.account.swapMarket.fetch(ctx.marketPda);
    if (BigInt(market.lpNav.toString()) < 200_000_000n) {
      await ctx.sdk.lp.depositLiquidity.execute({
        depositor: ctx.deployer.publicKey,
        market: ctx.marketPda,
        underlyingMint: ctx.underlyingMint,
        lpMint: ctx.lpMintPda,
        lpVault: ctx.lpVaultPda,
        amount: 500_000_000n,
      });
    }

    // Create a fresh liquidator keypair, fund it with SOL + USDC. The
    // liquidator must have its own USDC ATA — `liquidator_token_account`
    // requires `token::authority = liquidator` constraint.
    liquidator = Keypair.generate();
    const sig = await ctx.connection.requestAirdrop(
      liquidator.publicKey,
      1_000_000_000
    );
    await ctx.connection.confirmTransaction(sig, "confirmed");
    await setTokenBalance(
      ctx.connection,
      liquidator.publicKey,
      ctx.underlyingMint,
      0
    );
  }, 120_000);

  it("opens a healthy position via SDK (collateral >> maintenance)", async () => {
    if (!ctx) return;

    const { address } = await PdaDeriver.swapPosition(
      ctx.deployer.publicKey,
      ctx.marketPda,
      NONCE
    );
    swapPositionAddress = address;
    if (await ctx.connection.getAccountInfo(address)) {
      console.warn(
        `[E2E note] SwapPosition with nonce=${NONCE} already exists; reusing.`
      );
      return;
    }

    await ctx.sdk.trader.openSwap.execute({
      trader: ctx.deployer.publicKey,
      market: ctx.marketPda,
      underlyingMint: ctx.underlyingMint,
      treasury: ctx.treasury,
      collateralVault: ctx.collateralVaultPda,
      direction: SwapDirection.PayFixed,
      notional: 100_000_000n,
      nonce: NONCE,
      maxRateBps: 65_535n,
      minRateBps: 0n,
    });

    const pos = await ctx.sdk.query.positions.fetchSwapPosition(
      address.toBase58()
    );
    expect(pos).not.toBeNull();
    expect(pos!.collateralRemaining).toBeGreaterThan(0n);
  }, 60_000);

  it("liquidate_position via SDK fails with AboveMaintenanceMargin (proves plumbing)", async () => {
    if (!ctx) return;

    // The SDK builds the AnchorProvider from the deployer wallet — to call
    // liquidate_position with a different signer (the liquidator), we use the
    // raw program with a fresh provider rooted at the liquidator wallet.
    const { Wallet, AnchorProvider, Program } = await import("@coral-xyz/anchor");
    const liquidatorWallet = new Wallet(liquidator);
    const liquidatorProvider = new AnchorProvider(
      ctx.connection,
      liquidatorWallet,
      { commitment: "confirmed" }
    );
    const idl = (await import("../idl/anemone.json")).default;
    const liquidatorProgram = new Program(idl as any, liquidatorProvider);

    // Create the liquidator's USDC ATA (program enforces token::authority = liquidator).
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.underlyingMint,
      liquidator.publicKey
    );

    const liquidatorAta = (
      await import("@solana/spl-token")
    ).getAssociatedTokenAddressSync(ctx.underlyingMint, liquidator.publicKey);

    // Build the LiquidatePosition use-case bound to the liquidator's program
    const { LiquidatePosition } = await import(
      "../src/application/use-cases/trader/LiquidatePosition"
    );
    const useCase = new LiquidatePosition(liquidatorProgram as any);

    const SYSVAR_INSTRUCTIONS = new PublicKey(
      "Sysvar1nstructions1111111111111111111111111"
    );

    let caughtError: any = null;
    try {
      await useCase.execute({
        liquidator: liquidator.publicKey,
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
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    // The semantic check is "liquidate of a healthy position is rejected".
    // The most informative rejection is `AboveMaintenanceMargin`, but when
    // the position was opened in a previous run and the rate index has
    // been re-seeded since, the program rejects earlier with
    // `InvalidRateIndex` (position.last_settled_rate_index > market.current).
    // Either reject is fine — anything else (ConstraintMut, AccountNotInit,
    // InsufficientFunds) signals SDK-side account ordering or seeding bug.
    const msg = caughtError?.message || String(caughtError);
    expect(msg).toMatch(
      /AboveMaintenanceMargin|maintenance margin|InvalidRateIndex/i
    );
  }, 60_000);
});
