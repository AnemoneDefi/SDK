/**
 * KAMINO DEPOSIT/WITHDRAW E2E — exercises the keeper's custody round-trip
 * through the SDK against the REAL Kamino USDC reserve.
 *
 * Requires a market created with the live `reserve.collateral.mint_pubkey`
 * as `kaminoCollateralMint` (the placeholder mint other tests use makes the
 * Kamino CPI reject). Bootstrap helper handles that.
 *
 * Flow:
 *   1. Bootstrap primary + kamino-real market
 *   2. LP-deposit 100 USDC on the kamino market
 *   3. keeper.depositToKamino(50 USDC) → moves USDC out of lp_vault, k-USDC
 *      into kamino_deposit_account
 *   4. Assert lp_vault dropped, kamino_deposit_account got k-tokens
 *   5. keeper.withdrawFromKamino(<all k-tokens>) → moves USDC back, burns k
 *   6. Assert lp_vault recovered (≥ original modulo Kamino fee), k-tokens=0
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAccount,
} from "@solana/spl-token";
import { rpcAvailable } from "./helpers/connection";
import {
  bootstrapEnvironment,
  bootstrapKaminoMarket,
  seedRateIndex,
  seedRateIndexFor,
  KAMINO_TENOR_SECONDS,
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

const DEPOSIT_AMOUNT = 50_000_000n; // 50 USDC

describe("E2E: deposit_to_kamino + withdraw_from_kamino round-trip via SDK", () => {
  let ctx: BootstrapResult | null = null;
  let kaminoMarket: ShortMarketResult | null = null;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
    await seedRateIndex(ctx);
    kaminoMarket = await bootstrapKaminoMarket(ctx);
    await seedRateIndexFor(ctx, kaminoMarket.marketPda);

    await setTokenBalance(
      ctx.connection,
      ctx.deployer.publicKey,
      ctx.underlyingMint,
      5_000_000_000
    );
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      kaminoMarket.lpMintPda,
      ctx.deployer.publicKey
    );

    // sync_kamino_yield to bump the staleness gate, with refresh bundled.
    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });
    await ctx.sdk.keeper.syncKaminoYield.execute({
      underlyingReserve: ctx.underlyingReserve,
      tenorSeconds: KAMINO_TENOR_SECONDS,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: KAMINO_LENDING_MARKET,
      pythOracle: ctx.underlyingProtocol,
      switchboardPriceOracle: ctx.underlyingProtocol,
      switchboardTwapOracle: ctx.underlyingProtocol,
      scopePrices: SCOPE_PRICES,
      preInstructions: [refresh],
    });

    // Need ≥ DEPOSIT_AMOUNT of LP NAV. Top up to 200 USDC to leave room.
    const market = await ctx.rawProgram.account.swapMarket.fetch(
      kaminoMarket.marketPda
    );
    const TARGET = 200_000_000n;
    const navNow = BigInt(market.lpNav.toString());
    if (navNow < TARGET) {
      await ctx.sdk.lp.depositLiquidity.execute({
        depositor: ctx.deployer.publicKey,
        market: kaminoMarket.marketPda,
        underlyingMint: ctx.underlyingMint,
        lpMint: kaminoMarket.lpMintPda,
        lpVault: kaminoMarket.lpVaultPda,
        amount: TARGET - navNow,
      });
    }
  }, 120_000);

  it("deposit_to_kamino moves USDC into Kamino and mints k-tokens", async () => {
    if (!ctx || !kaminoMarket) return;

    const lpVaultBefore = (
      await getAccount(ctx.connection, kaminoMarket.lpVaultPda)
    ).amount;
    const kDepositBefore = (
      await getAccount(ctx.connection, kaminoMarket.kaminoDepositPda)
    ).amount;

    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    await ctx.sdk.keeper.depositToKamino.execute({
      keeper: ctx.deployer.publicKey,
      underlyingReserve: ctx.underlyingReserve,
      tenorSeconds: KAMINO_TENOR_SECONDS,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: ctx.kamino.lendingMarket,
      kaminoLendingMarketAuthority: ctx.kamino.lendingMarketAuthority,
      reserveLiquidityMint: ctx.underlyingMint,
      reserveLiquiditySupply: ctx.kamino.reserveLiquiditySupply,
      reserveCollateralMint: ctx.kamino.reserveCollateralMint,
      collateralTokenProgram: TOKEN_PROGRAM_ID,
      liquidityTokenProgram: TOKEN_PROGRAM_ID,
      amount: DEPOSIT_AMOUNT,
      preInstructions: [refresh],
    });

    const lpVaultAfter = (
      await getAccount(ctx.connection, kaminoMarket.lpVaultPda)
    ).amount;
    const kDepositAfter = (
      await getAccount(ctx.connection, kaminoMarket.kaminoDepositPda)
    ).amount;

    // lp_vault dropped by exactly DEPOSIT_AMOUNT (USDC sent to Kamino)
    expect(lpVaultAfter).toBe(lpVaultBefore - DEPOSIT_AMOUNT);
    // kamino_deposit_account received k-tokens (count is reserve-rate dependent)
    expect(kDepositAfter).toBeGreaterThan(kDepositBefore);
  }, 60_000);

  it("withdraw_from_kamino redeems all k-tokens back to USDC", async () => {
    if (!ctx || !kaminoMarket) return;

    const lpVaultBefore = (
      await getAccount(ctx.connection, kaminoMarket.lpVaultPda)
    ).amount;
    const kDepositBefore = (
      await getAccount(ctx.connection, kaminoMarket.kaminoDepositPda)
    ).amount;

    if (kDepositBefore === 0n) {
      console.warn("[E2E skip] No k-tokens to withdraw.");
      return;
    }

    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    await ctx.sdk.keeper.withdrawFromKamino.execute({
      keeper: ctx.deployer.publicKey,
      underlyingReserve: ctx.underlyingReserve,
      tenorSeconds: KAMINO_TENOR_SECONDS,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: ctx.kamino.lendingMarket,
      kaminoLendingMarketAuthority: ctx.kamino.lendingMarketAuthority,
      reserveLiquidityMint: ctx.underlyingMint,
      reserveLiquiditySupply: ctx.kamino.reserveLiquiditySupply,
      reserveCollateralMint: ctx.kamino.reserveCollateralMint,
      collateralTokenProgram: TOKEN_PROGRAM_ID,
      liquidityTokenProgram: TOKEN_PROGRAM_ID,
      collateralAmount: kDepositBefore,
      preInstructions: [refresh],
    });

    const lpVaultAfter = (
      await getAccount(ctx.connection, kaminoMarket.lpVaultPda)
    ).amount;
    const kDepositAfter = (
      await getAccount(ctx.connection, kaminoMarket.kaminoDepositPda)
    ).amount;

    // k-tokens fully burned
    expect(kDepositAfter).toBe(0n);
    // lp_vault recovered ≈ the deposited amount. Kamino's integer-math
    // exchange rate can lose up to a few base units on the round-trip
    // (mint at collateral→liquidity, redeem at liquidity→collateral) — for
    // a 50 USDC deposit the observed loss is ~1 unit ($0.000001), which we
    // accept as Kamino-internal rounding rather than an SDK bug.
    const ROUNDING_TOLERANCE = 10n; // 0.00001 USDC at 6dp
    expect(lpVaultAfter).toBeGreaterThanOrEqual(
      lpVaultBefore + DEPOSIT_AMOUNT - ROUNDING_TOLERANCE
    );
  }, 60_000);
});
