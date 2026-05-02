/**
 * TRADER COLLATERAL E2E — exercises addCollateral through the SDK against
 * the live program.
 *
 * Flow:
 *   1. Bootstrap protocol + market + rate index + LP deposit (idempotent)
 *   2. Open a fresh swap position (NONCE = 11, distinct from other E2E files)
 *   3. Snapshot collateralRemaining
 *   4. addCollateral via SDK with 5 USDC
 *   5. Re-fetch and assert collateralRemaining grew by exactly 5_000_000
 *   6. Cleanup: close the position (so the test is replay-safe)
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
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

const NONCE = 11;
const ADD_AMOUNT = 5_000_000n; // 5 USDC

describe("E2E: addCollateral through SDK", () => {
  let ctx: BootstrapResult | null = null;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
    await seedRateIndex(ctx);

    await setTokenBalance(
      ctx.connection,
      ctx.deployer.publicKey,
      ctx.underlyingMint,
      5_000_000_000 // 5000 USDC
    );
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.lpMintPda,
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
      tenorSeconds: 2_592_000n,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: KAMINO_LENDING_MARKET,
      pythOracle: ctx.underlyingProtocol,
      switchboardPriceOracle: ctx.underlyingProtocol,
      switchboardTwapOracle: ctx.underlyingProtocol,
      scopePrices: SCOPE_PRICES,
      preInstructions: [refresh],
    });

    // Top up LP pool to keep utilization safe even when other E2E files have
    // left positions open in the same surfpool run. We need:
    //   (total_fixed + total_variable + new_notional) / lp_nav ≤ max_util
    //   ≈ ((existing 100..200) + 100) / lp_nav ≤ 0.6
    //   → lp_nav ≥ ~500 USDC. Top up to 2000 to leave generous headroom.
    const market = await ctx.rawProgram.account.swapMarket.fetch(ctx.marketPda);
    const TARGET_NAV = 2_000_000_000n; // 2000 USDC
    const currentNav = BigInt(market.lpNav.toString());
    if (currentNav < TARGET_NAV) {
      await ctx.sdk.lp.depositLiquidity.execute({
        depositor: ctx.deployer.publicKey,
        market: ctx.marketPda,
        underlyingMint: ctx.underlyingMint,
        lpMint: ctx.lpMintPda,
        lpVault: ctx.lpVaultPda,
        amount: TARGET_NAV - currentNav,
      });
    }
  }, 120_000);

  it("addCollateral grows collateralRemaining by the deposited amount", async () => {
    if (!ctx) return;

    // Open a fresh position. Skip if NONCE collision (replay-safe).
    const { address: positionPda } = await PdaDeriver.swapPosition(
      ctx.deployer.publicKey,
      ctx.marketPda,
      NONCE
    );
    const exists = await ctx.connection.getAccountInfo(positionPda);
    if (!exists) {
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
    }

    const before = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(before).not.toBeNull();
    const collBefore = before!.collateralRemaining;

    await ctx.sdk.trader.addCollateral.execute({
      owner: ctx.deployer.publicKey,
      market: ctx.marketPda,
      underlyingMint: ctx.underlyingMint,
      collateralVault: ctx.collateralVaultPda,
      nonce: NONCE,
      amount: ADD_AMOUNT,
    });

    const after = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(after).not.toBeNull();
    expect(after!.collateralRemaining).toBe(collBefore + ADD_AMOUNT);

    // Cleanup: close so the test is replay-safe across surfpool runs that
    // keep state.
    await ctx.sdk.trader.closePositionEarly.execute({
      owner: ctx.deployer.publicKey,
      market: ctx.marketPda,
      swapPosition: positionPda,
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
  }, 60_000);
});
