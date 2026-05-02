/**
 * LIQUIDATION ORGANIC E2E — drives a position underwater via the program's
 * own settlement math, with NO direct write to swap_position state. Proves
 * the maintenance-margin check fires from real on-chain economics rather
 * than a forged collateral_remaining value.
 *
 * The "external" lever is `set_rate_index_oracle` (admin-only, dev-tools
 * feature). It rotates current → previous and sets a new current, exactly
 * the same shape as `update_rate_index` reading Kamino. This simulates a
 * Kamino USDC borrow-rate spike (e.g. April 2026 contagion) hitting the
 * market between trader's open and liquidator's call. Everything downstream
 * is the program: liquidate's mark-to-market computes pnl < 0 → drains
 * collateral via real transfer_checked → maintenance-margin require fires.
 *
 * Why receive-fixed: rate_index is monotonic (always grows), so a pay-fixed
 * trader benefits from rate growth and never goes underwater. Receive-fixed
 * pays variable, receives fixed — a rate spike makes them lose.
 *
 * Flow:
 *   1. Bootstrap short market + LP NAV
 *   2. Trader (separate keypair) opens receive-fixed, NONCE 81
 *   3. Read market.current_rate_index, bump it +200 bps via setRateIndexOracle
 *      (well under the 500 bps circuit breaker)
 *   4. Liquidate via SDK from a third keypair
 *   5. Assert position closed; LP vault grew (trader paid collateral out via
 *      MtM); the test never wrote to swap_position directly.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAccount,
} from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { rpcAvailable } from "./helpers/connection";
import {
  bootstrapEnvironment,
  bootstrapShortMarket,
  seedRateIndex,
  seedRateIndexFor,
  SHORT_TENOR_SECONDS,
} from "./helpers/bootstrap";
import type {
  BootstrapResult,
  ShortMarketResult,
} from "./helpers/bootstrap";
import {
  KAMINO_LENDING_MARKET,
  SCOPE_PRICES,
  refreshReserveIx,
  setTokenBalance,
} from "./helpers/surfpool";
import { SwapDirection } from "../src/domain/enums";
import { PdaDeriver } from "../src/infrastructure/pda/PdaDeriver";

const NONCE = 81;
const NOTIONAL = 100_000_000n; // 100 USDC — IM ≈ 285 base units at 300s tenor
const RATE_BUMP_BPS = 200n; // 2% — well under the 500 bps period circuit breaker

async function openReceiveFixedAsTrader(
  ctx: BootstrapResult,
  shortMarket: ShortMarketResult,
  trader: Keypair
): Promise<void> {
  const { Wallet, AnchorProvider, Program } = await import("@coral-xyz/anchor");
  const traderProvider = new AnchorProvider(
    ctx.connection,
    new Wallet(trader),
    { commitment: "confirmed" }
  );
  const idl = (await import("../idl/anemone.json")).default;
  const traderProgram = new Program(idl as any, traderProvider);
  const { OpenSwap } = await import(
    "../src/application/use-cases/trader/OpenSwap"
  );
  const useCase = new OpenSwap(traderProgram as any);
  await useCase.execute({
    trader: trader.publicKey,
    market: shortMarket.marketPda,
    underlyingMint: ctx.underlyingMint,
    treasury: ctx.treasury,
    collateralVault: shortMarket.collateralVaultPda,
    direction: SwapDirection.ReceiveFixed,
    notional: NOTIONAL,
    nonce: NONCE,
    maxRateBps: 65_535n,
    minRateBps: 1n,
  });
}

describe("E2E: liquidation triggered by organic rate-index spike (no forged state)", () => {
  let ctx: BootstrapResult | null = null;
  let shortMarket: ShortMarketResult | null = null;
  let trader: Keypair;
  let liquidator: Keypair;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
    await seedRateIndex(ctx);

    shortMarket = await bootstrapShortMarket(ctx);
    await seedRateIndexFor(ctx, shortMarket.marketPda);

    await setTokenBalance(
      ctx.connection,
      ctx.deployer.publicKey,
      ctx.underlyingMint,
      5_000_000_000
    );
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      shortMarket.lpMintPda,
      ctx.deployer.publicKey
    );

    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });
    await ctx.sdk.keeper.syncKaminoYield.execute({
      underlyingReserve: ctx.underlyingReserve,
      tenorSeconds: SHORT_TENOR_SECONDS,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: KAMINO_LENDING_MARKET,
      pythOracle: ctx.underlyingProtocol,
      switchboardPriceOracle: ctx.underlyingProtocol,
      switchboardTwapOracle: ctx.underlyingProtocol,
      scopePrices: SCOPE_PRICES,
      preInstructions: [refresh],
    });

    const market = await ctx.rawProgram.account.swapMarket.fetch(
      shortMarket.marketPda
    );
    const TARGET_NAV = 2_000_000_000n;
    if (BigInt(market.lpNav.toString()) < TARGET_NAV) {
      await ctx.sdk.lp.depositLiquidity.execute({
        depositor: ctx.deployer.publicKey,
        market: shortMarket.marketPda,
        underlyingMint: ctx.underlyingMint,
        lpMint: shortMarket.lpMintPda,
        lpVault: shortMarket.lpVaultPda,
        amount: TARGET_NAV - BigInt(market.lpNav.toString()),
      });
    }

    trader = Keypair.generate();
    const tradSig = await ctx.connection.requestAirdrop(
      trader.publicKey,
      1_000_000_000
    );
    await ctx.connection.confirmTransaction(tradSig, "confirmed");
    await setTokenBalance(
      ctx.connection,
      trader.publicKey,
      ctx.underlyingMint,
      100_000_000
    );

    liquidator = Keypair.generate();
    const liqSig = await ctx.connection.requestAirdrop(
      liquidator.publicKey,
      1_000_000_000
    );
    await ctx.connection.confirmTransaction(liqSig, "confirmed");
    await setTokenBalance(
      ctx.connection,
      liquidator.publicKey,
      ctx.underlyingMint,
      0
    );
  }, 120_000);

  it("liquidates a receive-fixed position after a 200 bps rate spike, with no forged state", async () => {
    if (!ctx || !shortMarket) return;

    const { address: positionPda } = await PdaDeriver.swapPosition(
      trader.publicKey,
      shortMarket.marketPda,
      NONCE
    );

    if (!(await ctx.connection.getAccountInfo(positionPda))) {
      await openReceiveFixedAsTrader(ctx, shortMarket, trader);
    }

    // Confirm position is in the expected pre-bump state. collateral_remaining
    // should equal the freshly-deposited initial margin — NOT 1, NOT some
    // forged value. We never write to it directly in this test.
    const opened = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(opened).not.toBeNull();
    expect(opened!.status).toBe(0); // PositionStatus::Open
    const initialCollateral = opened!.collateralRemaining;
    expect(initialCollateral).toBeGreaterThan(0n);

    // ---- Drive rate index UP via the admin oracle. Simulates a Kamino spike.
    const marketBefore = await ctx.rawProgram.account.swapMarket.fetch(
      shortMarket.marketPda
    );
    const currentIndex = BigInt(marketBefore.currentRateIndex.toString());
    const newIndex =
      currentIndex + (currentIndex * RATE_BUMP_BPS) / 10_000n;

    await ctx.sdk.admin.setRateIndexOracle.execute({
      authority: ctx.deployer.publicKey,
      market: shortMarket.marketPda,
      rateIndex: newIndex,
    });

    // ---- Snapshots before liquidation
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.underlyingMint,
      liquidator.publicKey
    );
    const lpVaultBefore = (
      await getAccount(ctx.connection, shortMarket.lpVaultPda)
    ).amount;
    const collateralVaultBefore = (
      await getAccount(ctx.connection, shortMarket.collateralVaultPda)
    ).amount;

    // ---- Liquidate from the liquidator wallet (third party).
    const { Wallet, AnchorProvider, Program } = await import("@coral-xyz/anchor");
    const liquidatorProvider = new AnchorProvider(
      ctx.connection,
      new Wallet(liquidator),
      { commitment: "confirmed" }
    );
    const idl = (await import("../idl/anemone.json")).default;
    const liquidatorProgram = new Program(idl as any, liquidatorProvider);
    const { LiquidatePosition } = await import(
      "../src/application/use-cases/trader/LiquidatePosition"
    );
    const liquidateUseCase = new LiquidatePosition(liquidatorProgram as any);

    const liquidateRefresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    await liquidateUseCase.execute({
      liquidator: liquidator.publicKey,
      owner: trader.publicKey,
      market: shortMarket.marketPda,
      swapPosition: positionPda,
      underlyingMint: ctx.underlyingMint,
      lpVault: shortMarket.lpVaultPda,
      collateralVault: shortMarket.collateralVaultPda,
      treasury: ctx.treasury,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: ctx.kamino.lendingMarket,
      kaminoLendingMarketAuthority: ctx.kamino.lendingMarketAuthority,
      reserveLiquidityMint: ctx.underlyingMint,
      reserveLiquiditySupply: ctx.kamino.reserveLiquiditySupply,
      reserveCollateralMint: ctx.kamino.reserveCollateralMint,
      collateralTokenProgram: TOKEN_PROGRAM_ID,
      liquidityTokenProgram: TOKEN_PROGRAM_ID,
      preInstructions: [liquidateRefresh],
    });

    // ---- Assertions
    // 1. Position closed (close = owner constraint in liquidate_position).
    const after = await ctx.connection.getAccountInfo(positionPda);
    expect(after).toBeNull();

    // 2. Real economics moved: collateral vault dropped, lp vault grew —
    //    the trader's IM was burned by the MtM transfer to the LP vault.
    //    No forged write was ever performed on swap_position.
    const lpVaultAfter = (
      await getAccount(ctx.connection, shortMarket.lpVaultPda)
    ).amount;
    const collateralVaultAfter = (
      await getAccount(ctx.connection, shortMarket.collateralVaultPda)
    ).amount;

    expect(collateralVaultAfter).toBeLessThan(collateralVaultBefore);
    expect(lpVaultAfter).toBeGreaterThan(lpVaultBefore);
  }, 60_000);
});
