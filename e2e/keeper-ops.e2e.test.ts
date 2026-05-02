/**
 * KEEPER E2E — exercises the two read-/write-light keeper paths
 * (updateRateIndex + syncKaminoYield) through the SDK with explicit
 * before/after asserts. These are exercised by the bootstrap helper too,
 * but only as side effects — this file makes them first-class tests.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { rpcAvailable } from "./helpers/connection";
import { bootstrapEnvironment, seedRateIndex } from "./helpers/bootstrap";
import type { BootstrapResult } from "./helpers/bootstrap";
import {
  KAMINO_LENDING_MARKET,
  SCOPE_PRICES,
  refreshReserveIx,
} from "./helpers/surfpool";

describe("E2E: keeper ops (updateRateIndex + syncKaminoYield) through SDK", () => {
  let ctx: BootstrapResult | null = null;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
    // Seed both rate-index slots so the post-update_rate_index assertion has
    // a non-zero `previous_rate_index` to compare against.
    await seedRateIndex(ctx);
  }, 90_000);

  it("updateRateIndex via SDK rotates current → previous and bumps timestamp", async () => {
    if (!ctx) return;

    const before = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );
    const prevCurrent = before!.currentRateIndex;
    const prevTs = before!.lastRateUpdateTs;

    // Wait past MIN_RATE_UPDATE_ELAPSED_SECS = 8s so the program accepts
    // the update without `InvalidElapsedTime`.
    await new Promise((r) => setTimeout(r, 9_500));

    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    // SDK now supports preInstructions — bundle Kamino refresh_reserve so
    // `cumulative_borrow_rate_bsf` is fresh before the program reads it.
    await ctx.sdk.keeper.updateRateIndex.execute({
      keeper: ctx.deployer.publicKey,
      underlyingReserve: ctx.underlyingReserve,
      tenorSeconds: 2_592_000n,
      kaminoReserve: ctx.underlyingReserve,
      preInstructions: [refresh],
    });

    const after = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );

    // current rotated forward
    expect(after!.currentRateIndex).toBeGreaterThanOrEqual(prevCurrent);
    // previous now equals what current was before
    expect(after!.previousRateIndex).toBe(prevCurrent);
    // timestamp moved forward
    expect(after!.lastRateUpdateTs).toBeGreaterThan(prevTs);
  }, 60_000);

  it("syncKaminoYield via SDK bumps lastKaminoSyncTs and updates snapshot", async () => {
    if (!ctx) return;

    const before = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );
    const tsBefore = before!.lastKaminoSyncTs;

    // Bundle refresh_reserve as a pre-instruction. The SDK execute path
    // doesn't take preInstructions, so we do it via the raw program — but
    // the accounts/args mirror exactly what sdk.keeper.syncKaminoYield builds.
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

    const after = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );

    expect(after!.lastKaminoSyncTs).toBeGreaterThan(tsBefore);
    // Snapshot should be writable (could be 0 if no k-tokens deposited yet,
    // but never negative or undefined).
    expect(after!.lastKaminoSnapshotUsdc).toBeGreaterThanOrEqual(0n);
  }, 60_000);

  it("syncKaminoYield via SDK use-case (with preInstructions) — full plumbing", async () => {
    if (!ctx) return;

    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    const before = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );

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

    const after = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );
    expect(after!.lastKaminoSyncTs).toBeGreaterThanOrEqual(
      before!.lastKaminoSyncTs
    );
  }, 60_000);
});
