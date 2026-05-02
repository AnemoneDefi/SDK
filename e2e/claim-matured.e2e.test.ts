/**
 * CLAIM_MATURED E2E — exercises the trader-side claim path through the SDK.
 * Uses the short-tenor market (300s) so we can actually wait through tenor
 * expiry without burning hours.
 *
 * Total runtime: ~5min real wall-clock. Worth it for end-to-end coverage of
 * the 19-account claim path including the internal Kamino redeem-on-shortfall.
 *
 * Flow:
 *   1. Bootstrap primary + short market
 *   2. open_swap on the short market with NONCE 31 (independent of settle test)
 *   3. Wait until now >= maturity_timestamp (~305s wall-clock)
 *   4. settle_period (transitions position to Matured)
 *   5. claim_matured via SDK (with refresh_reserve preInstruction)
 *   6. Assert position closed; trader USDC balance grew
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
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
  onChainNowSec,
  refreshReserveIx,
  setTokenBalance,
  sleepWallSecs,
} from "./helpers/surfpool";
import { SwapDirection } from "../src/domain/enums";
import { PdaDeriver } from "../src/infrastructure/pda/PdaDeriver";

const NONCE = 31;

describe("E2E: claim_matured on short-tenor market through SDK", () => {
  let ctx: BootstrapResult | null = null;
  let shortMarket: ShortMarketResult | null = null;

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
  }, 120_000);

  it("opens, waits past maturity, settles to Matured, then claim_matured via SDK", async () => {
    if (!ctx || !shortMarket) return;

    const { address: positionPda } = await PdaDeriver.swapPosition(
      ctx.deployer.publicKey,
      shortMarket.marketPda,
      NONCE
    );

    // Stale-position cleanup: a leaked position from a prior run can have
    // maturity_timestamp far in the future (or in the past with status still
    // Open if a settle never landed). Either way, close it via the SDK so we
    // start with a fresh maturity = now + 300s.
    const existing = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    if (existing && existing.status === 0 /* Open */) {
      console.log("  Closing leaked position from prior run...");
      await ctx.sdk.trader.closePositionEarly.execute({
        owner: ctx.deployer.publicKey,
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
      });
    }

    // Open a fresh swap so maturity_timestamp = now + 300s.
    await ctx.sdk.trader.openSwap.execute({
      trader: ctx.deployer.publicKey,
      market: shortMarket.marketPda,
      underlyingMint: ctx.underlyingMint,
      treasury: ctx.treasury,
      collateralVault: shortMarket.collateralVaultPda,
      direction: SwapDirection.PayFixed,
      notional: 100_000_000n,
      nonce: NONCE,
      maxRateBps: 65_535n,
      minRateBps: 0n,
    });

    const pos = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(pos).not.toBeNull();
    const maturityTs = pos!.maturityTimestamp;

    // Use on-chain clock (NOT Date.now) — surfpool's forked slot can put
    // unix_timestamp 100+ seconds offset from wall, so basing the wait on
    // wall-now over-estimates dramatically.
    const onChainNow = BigInt(await onChainNowSec(ctx.connection));
    const waitSecs = Number(maturityTs - onChainNow) + 5;
    if (waitSecs > 0) {
      console.log(`  Waiting ${waitSecs}s wall for maturity...`);
      await sleepWallSecs(waitSecs);
    }

    // Refresh rate so settle_period passes the rate-index check, then settle.
    // settle_period transitions Open → Matured when now >= maturity_timestamp.
    await seedRateIndexFor(ctx, shortMarket.marketPda);
    await ctx.sdk.trader.settlePeriod.execute({
      caller: ctx.deployer.publicKey,
      market: shortMarket.marketPda,
      swapPosition: positionPda,
      underlyingMint: ctx.underlyingMint,
      lpVault: shortMarket.lpVaultPda,
      collateralVault: shortMarket.collateralVaultPda,
    });

    const matured = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(matured).not.toBeNull();
    // Position should now be Matured (status = 1)
    expect(matured!.status).toBe(1);

    // Snapshot trader USDC before claim
    const traderAta = getAssociatedTokenAddressSync(
      ctx.underlyingMint,
      ctx.deployer.publicKey
    );
    const usdcBefore = BigInt(
      (await ctx.connection.getTokenAccountBalance(traderAta)).value.amount
    );

    // claim_matured with refresh_reserve preInstruction
    const claimRefresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    await ctx.sdk.trader.claimMatured.execute({
      owner: ctx.deployer.publicKey,
      market: shortMarket.marketPda,
      swapPosition: positionPda,
      underlyingMint: ctx.underlyingMint,
      lpVault: shortMarket.lpVaultPda,
      collateralVault: shortMarket.collateralVaultPda,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: ctx.kamino.lendingMarket,
      kaminoLendingMarketAuthority: ctx.kamino.lendingMarketAuthority,
      reserveLiquidityMint: ctx.underlyingMint,
      reserveLiquiditySupply: ctx.kamino.reserveLiquiditySupply,
      reserveCollateralMint: ctx.kamino.reserveCollateralMint,
      collateralTokenProgram: TOKEN_PROGRAM_ID,
      liquidityTokenProgram: TOKEN_PROGRAM_ID,
      preInstructions: [claimRefresh],
    });

    // Position account closed (rent returned to owner).
    const closedAcct = await ctx.connection.getAccountInfo(positionPda);
    expect(closedAcct).toBeNull();

    // Trader received their final collateral payout.
    const usdcAfter = BigInt(
      (await ctx.connection.getTokenAccountBalance(traderAta)).value.amount
    );
    expect(usdcAfter).toBeGreaterThan(usdcBefore);
  }, 360_000); // 6min: open + wait 305s + settle + claim
});
