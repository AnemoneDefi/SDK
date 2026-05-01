/**
 * ADMIN E2E — exercises the kill-switch + keeper-rotation paths through the
 * SDK against the live program.
 *
 * Tests are sequenced (vitest sequence.concurrent=false) and end with a
 * cleanup step that restores the original keeper + unpaused state so other
 * E2E files in the same surfpool run aren't affected.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Keypair } from "@solana/web3.js";
import { rpcAvailable } from "./helpers/connection";
import { bootstrapEnvironment } from "./helpers/bootstrap";
import type { BootstrapResult } from "./helpers/bootstrap";

describe("E2E: admin lifecycle (setKeeper + pause/unpause) through SDK", () => {
  let ctx: BootstrapResult | null = null;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
  }, 90_000);

  it("setKeeper rotates protocol_state.keeperAuthority", async () => {
    if (!ctx) return;

    const newKeeper = Keypair.generate();

    await ctx.sdk.admin.setKeeper.execute({
      authority: ctx.deployer.publicKey,
      newKeeper: newKeeper.publicKey,
    });

    const protocol = await ctx.sdk.query.protocol.fetch();
    expect(protocol).not.toBeNull();
    expect(protocol!.keeperAuthority).toBe(newKeeper.publicKey.toBase58());

    // Restore so subsequent E2E files (which call updateRateIndex with the
    // deployer as keeper) keep working.
    await ctx.sdk.admin.setKeeper.execute({
      authority: ctx.deployer.publicKey,
      newKeeper: ctx.deployer.publicKey,
    });

    const restored = await ctx.sdk.query.protocol.fetch();
    expect(restored!.keeperAuthority).toBe(ctx.deployer.publicKey.toBase58());
  }, 30_000);

  it("pauseProtocol → paused=true, unpauseProtocol → paused=false", async () => {
    if (!ctx) return;

    // Sanity: should start unpaused (clean bootstrap or post-prior-run cleanup)
    const before = await ctx.sdk.query.protocol.fetch();
    expect(before!.paused).toBe(false);

    // Pause
    await ctx.sdk.admin.pauseProtocol.execute({
      authority: ctx.deployer.publicKey,
    });
    const paused = await ctx.sdk.query.protocol.fetch();
    expect(paused!.paused).toBe(true);

    // Unpause — restore for later tests
    await ctx.sdk.admin.unpauseProtocol.execute({
      authority: ctx.deployer.publicKey,
    });
    const unpaused = await ctx.sdk.query.protocol.fetch();
    expect(unpaused!.paused).toBe(false);
  }, 30_000);
});
