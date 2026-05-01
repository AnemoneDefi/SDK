/**
 * READ E2E — exercises the SDK's query path against a live validator.
 *
 * Bootstrap (idempotent): initializes protocol + creates market on first run,
 * seeds the rate index. Asserts every entity field round-trips with the right
 * type — drift in the IDL mapper breaks here first.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { rpcAvailable } from "./helpers/connection";
import { bootstrapEnvironment, seedRateIndex } from "./helpers/bootstrap";
import type { BootstrapResult } from "./helpers/bootstrap";

describe("E2E: read-only queries against live validator", () => {
  let ctx: BootstrapResult | null = null;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn(
        `[E2E skip] No validator at ${process.env.RPC_URL || "http://127.0.0.1:8899"}.`
      );
      return;
    }
    ctx = await bootstrapEnvironment();
    await seedRateIndex(ctx);
  }, 90_000);

  it("query.protocol.fetch() decodes the protocol state with new fields", async () => {
    if (!ctx) return;

    const protocol = await ctx.sdk.query.protocol.fetch();

    expect(protocol).not.toBeNull();
    expect(protocol!.publicKey).toBe(ctx.protocolStatePda.toBase58());
    expect(protocol!.authority).toBe(ctx.deployer.publicKey.toBase58());
    expect(typeof protocol!.keeperAuthority).toBe("string");
    expect(typeof protocol!.treasury).toBe("string");
    expect(typeof protocol!.totalMarkets).toBe("bigint");
    expect(protocol!.totalMarkets).toBeGreaterThanOrEqual(1n);
    expect(typeof protocol!.paused).toBe("boolean");
  });

  it("initializeProtocol persisted the fee config (full bootstrap assertion)", async () => {
    if (!ctx) return;

    const protocol = await ctx.sdk.query.protocol.fetch();

    // These are the values bootstrap.ts sends to initializeProtocol. If the
    // SDK's u16 arg encoding ever silently corrupts them, this test fails
    // before any production call would hit the same bug.
    expect(protocol!.protocolFeeBps).toBe(1_000);
    expect(protocol!.openingFeeBps).toBe(5);
    expect(protocol!.liquidationFeeBps).toBe(300);
    expect(protocol!.withdrawalFeeBps).toBe(5);
    expect(protocol!.earlyCloseFeeBps).toBe(500);

    // After init, treasury should be the deployer's USDC ATA (per bootstrap)
    // and keeperAuthority should equal authority on first init.
    expect(protocol!.keeperAuthority).toBe(ctx.deployer.publicKey.toBase58());
    expect(protocol!.treasury).toBe(ctx.treasury.toBase58());
    expect(protocol!.paused).toBe(false);
  });

  it("createMarket persisted the market config (full bootstrap assertion)", async () => {
    if (!ctx) return;

    const m = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );

    // Bootstrap creates the market with these exact params; if any of them
    // silently round-trips wrong (BN→u64 truncation, etc.), this catches it.
    expect(m!.tenorSeconds).toBe(2_592_000n);
    expect(m!.settlementPeriodSeconds).toBe(86_400n);
    expect(m!.maxUtilizationBps).toBe(6_000);
    expect(m!.baseSpreadBps).toBe(80);

    // Identity fields from createMarket
    expect(m!.protocolState).toBe(ctx.protocolStatePda.toBase58());
    expect(m!.underlyingReserve).toBe(ctx.underlyingReserve.toBase58());
    expect(m!.underlyingMint).toBe(ctx.underlyingMint.toBase58());
    expect(m!.underlyingProtocol).toBe(ctx.underlyingProtocol.toBase58());

    // PDA-derived vault addresses must match what PdaDeriver computed at
    // bootstrap time — proves the market account ordering is right.
    expect(m!.lpVault).toBe(ctx.lpVaultPda.toBase58());
    expect(m!.collateralVault).toBe(ctx.collateralVaultPda.toBase58());
    expect(m!.lpMint).toBe(ctx.lpMintPda.toBase58());
    expect(m!.kaminoDepositAccount).toBe(ctx.kaminoDepositPda.toBase58());

    // Market starts unpaused (status = 0)
    expect(m!.status).toBe(0);
  });

  it("query.markets.fetchAll() decodes the market with all 6 new fields", async () => {
    if (!ctx) return;

    const markets = await ctx.sdk.query.markets.fetchAll();

    expect(markets.length).toBeGreaterThanOrEqual(1);

    const m = markets.find((mk) => mk.publicKey === ctx!.marketPda.toBase58());
    expect(m).toBeDefined();
    // Every field added in the recent program revisions — drift would surface
    // here as `undefined → bigint(undefined)` throwing during mapping.
    expect(typeof m!.lpNav).toBe("bigint");
    expect(typeof m!.previousRateIndex).toBe("bigint");
    expect(typeof m!.previousRateUpdateTs).toBe("bigint");
    expect(typeof m!.currentRateIndex).toBe("bigint");
    expect(typeof m!.totalKaminoCollateral).toBe("bigint");
    expect(typeof m!.lastKaminoSnapshotUsdc).toBe("bigint");
    expect(typeof m!.lastKaminoSyncTs).toBe("bigint");
    // After seedRateIndex, both snapshots should be non-zero.
    expect(m!.previousRateIndex).toBeGreaterThan(0n);
    expect(m!.currentRateIndex).toBeGreaterThan(m!.previousRateIndex);
  });

  it("query.markets.fetchByReserveAndTenor() resolves the same market", async () => {
    if (!ctx) return;

    const m = await ctx.sdk.query.markets.fetchByReserveAndTenor(
      ctx.underlyingReserve.toBase58(),
      2_592_000n
    );

    expect(m).not.toBeNull();
    expect(m!.publicKey).toBe(ctx.marketPda.toBase58());
  });
});
