/**
 * SETTLE_PERIOD E2E — exercises the trader settle path through the SDK
 * against a SECONDARY short-tenor market (300s tenor / 60s settlement),
 * because waiting through the primary market's 1-day settlement period is
 * not viable in a hands-off test.
 *
 * Flow:
 *   1. Bootstrap primary (protocol + reserve helpers) + short market
 *   2. LP-deposit on the short market so swap has counterparties
 *   3. open_swap (NONCE 21)
 *   4. Wait 65s real time so now ≥ next_settlement_ts
 *   5. settle_period via SDK
 *   6. Assert numSettlements grew, lastSettlementTs moved, lastSettledRateIndex
 *      updated. Cleanup: close the position so the test is replay-safe.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
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

const NONCE = 21;

describe("E2E: settle_period on short-tenor market through SDK", () => {
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

    // USDC + LP-token ATA for the short-market lpMint.
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

    // sync_kamino_yield on the short market so deposit_liquidity passes the
    // staleness gate.
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

    // Top up LP NAV on the short market.
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

  it("opens a swap on the short market, waits 65s, and settles via SDK", async () => {
    if (!ctx || !shortMarket) return;

    const { address: positionPda } = await PdaDeriver.swapPosition(
      ctx.deployer.publicKey,
      shortMarket.marketPda,
      NONCE
    );

    // Replay-safe: skip open if position already exists.
    const exists = await ctx.connection.getAccountInfo(positionPda);
    if (!exists) {
      await ctx.sdk.trader.openSwap.execute({
        trader: ctx.deployer.publicKey,
        market: shortMarket.marketPda,
        underlyingMint: ctx.underlyingMint,
        treasury: ctx.treasury,
        collateralVault: shortMarket.collateralVaultPda,
        direction: SwapDirection.PayFixed,
        notional: 100_000_000n,
        nonce: NONCE,
        // 65_535 = no effective cap. Fresh-surfpool clock skew can make
        // seedRateIndex produce an APY above 100% on the first run because
        // the two update_rate_index calls land in the same on-chain second
        // (elapsed → 0 in the APY formula).
        maxRateBps: 65_535n,
        minRateBps: 0n,
      });
    }

    const before = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(before).not.toBeNull();
    const numSettlementsBefore = before!.numSettlements;
    const lastSettlementTsBefore = before!.lastSettlementTs;
    const nextSettlementTs = before!.nextSettlementTs;

    // Wait until on-chain clock past next_settlement_ts. Use surfpool's
    // forked clock, not wall — they can be offset by 100+ seconds.
    const onChainNow = BigInt(await onChainNowSec(ctx.connection));
    const waitSecs = Number(nextSettlementTs - onChainNow) + 5;
    if (waitSecs > 0) {
      console.log(`  Waiting ${waitSecs}s wall for next_settlement_ts...`);
      await sleepWallSecs(waitSecs);
    }

    // Refresh rate index so current_rate_index is recent (settle_period
    // requires market.current_rate_index >= position.last_settled_rate_index).
    // The bootstrap already seeded it; just bump it now.
    await seedRateIndexFor(ctx, shortMarket.marketPda);

    await ctx.sdk.trader.settlePeriod.execute({
      caller: ctx.deployer.publicKey,
      market: shortMarket.marketPda,
      swapPosition: positionPda,
      underlyingMint: ctx.underlyingMint,
      lpVault: shortMarket.lpVaultPda,
      collateralVault: shortMarket.collateralVaultPda,
        treasury: ctx.treasury,
    });

    const after = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(after).not.toBeNull();
    expect(after!.numSettlements).toBe(numSettlementsBefore + 1);
    expect(after!.lastSettlementTs).toBeGreaterThan(lastSettlementTsBefore);

    // Cleanup: close so the test is replay-safe.
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
  }, 180_000);
});
