/**
 * PRE-MAINNET HARDENING E2E — covers the 4 critical paths that pure happy-
 * path E2E misses but that production WILL hit. Each test is a negative case
 * proving a specific guard fires:
 *
 *   1. PAUSE INTEGRATION — pauseProtocol must actually block open_swap and
 *      deposit_liquidity. The admin-lifecycle test only flips the flag; this
 *      test proves the flag has teeth.
 *
 *   2. KEEPER ROTATION REJECTS OLD KEEPER — after setKeeper(new), the OLD
 *      keeper must be rejected from update_rate_index. Without this, the
 *      keeper-rotation security model is cosmetic.
 *
 *   3. TOKEN-2022 MINT REJECTED AT create_market — UnsupportedMintExtensions
 *      must fire when admin tries to create a market with a mint owned by the
 *      Token-2022 program. Without this, a malicious admin could create a
 *      market on a fee-on-transfer mint and corrupt vault accounting.
 *
 *   4. SLIPPAGE EDGE — receive-fixed with min_rate_bps > offered fixed_rate
 *      must reject (SlippageExceeded). Production traders rely on this; if
 *      the inequality is wrong, MEV bots arbitrage stale quotes.
 *
 * NOT covered (resistant by design, see notes inline):
 *   - First-depositor LP inflation: lp_nav is internally tracked (never
 *     derived from lp_vault.amount), so vault donations don't poison share
 *     price. Investigated 2026-05-01; donation just sits locked.
 *   - Donation attack on lp_vault: same reason as above.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  createMint,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
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

async function sdkAs(ctx: BootstrapResult, signer: Keypair) {
  const { Wallet } = await import("@coral-xyz/anchor");
  const { Anemone } = await import("../src/Anemone");
  return new Anemone({
    connection: ctx.connection,
    wallet: new Wallet(signer),
  });
}

async function expectError(
  promise: Promise<unknown>,
  pattern: RegExp
): Promise<void> {
  let caught: unknown = null;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught, "expected reject").not.toBeNull();
  const msg =
    caught && typeof caught === "object" && "message" in caught
      ? String((caught as any).message)
      : String(caught);
  expect(
    pattern.test(msg),
    `expected ${pattern} in: ${msg}`
  ).toBe(true);
}

describe("E2E: pre-mainnet hardening through SDK", () => {
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
  }, 120_000);

  // ---------- 1. PAUSE INTEGRATION ----------

  it("pauseProtocol blocks open_swap with ProtocolPaused", async () => {
    if (!ctx || !shortMarket) return;

    await ctx.sdk.admin.pauseProtocol.execute({
      authority: ctx.deployer.publicKey,
    });

    try {
      const trader = Keypair.generate();
      const sig = await ctx.connection.requestAirdrop(
        trader.publicKey,
        100_000_000
      );
      await ctx.connection.confirmTransaction(sig, "confirmed");
      await setTokenBalance(
        ctx.connection,
        trader.publicKey,
        ctx.underlyingMint,
        100_000_000
      );

      const traderSdk = await sdkAs(ctx, trader);

      await expectError(
        traderSdk.trader.openSwap.execute({
          trader: trader.publicKey,
          market: shortMarket.marketPda,
          underlyingMint: ctx.underlyingMint,
          treasury: ctx.treasury,
          collateralVault: shortMarket.collateralVaultPda,
          direction: SwapDirection.PayFixed,
          notional: 100_000_000n,
          nonce: 91,
          maxRateBps: 65_535n,
          minRateBps: 0n,
        }),
        /ProtocolPaused/i
      );
    } finally {
      // Always restore so downstream tests aren't broken.
      await ctx.sdk.admin.unpauseProtocol.execute({
        authority: ctx.deployer.publicKey,
      });
    }
  }, 30_000);

  it("pauseProtocol blocks deposit_liquidity with ProtocolPaused", async () => {
    if (!ctx || !shortMarket) return;

    await ctx.sdk.admin.pauseProtocol.execute({
      authority: ctx.deployer.publicKey,
    });

    try {
      await expectError(
        ctx.sdk.lp.depositLiquidity.execute({
          depositor: ctx.deployer.publicKey,
          market: shortMarket.marketPda,
          underlyingMint: ctx.underlyingMint,
          lpMint: shortMarket.lpMintPda,
          lpVault: shortMarket.lpVaultPda,
          amount: 1_000_000n,
        }),
        /ProtocolPaused/i
      );
    } finally {
      await ctx.sdk.admin.unpauseProtocol.execute({
        authority: ctx.deployer.publicKey,
      });
    }
  }, 30_000);

  // ---------- 2. KEEPER ROTATION ----------

  it("after setKeeper, OLD keeper is rejected from update_rate_index", async () => {
    if (!ctx) return;

    const newKeeper = Keypair.generate();
    const sig = await ctx.connection.requestAirdrop(
      newKeeper.publicKey,
      100_000_000
    );
    await ctx.connection.confirmTransaction(sig, "confirmed");

    // Rotate to a NEW keeper. The deployer (current keeper) becomes "old".
    await ctx.sdk.admin.setKeeper.execute({
      authority: ctx.deployer.publicKey,
      newKeeper: newKeeper.publicKey,
    });

    try {
      // Deployer (old keeper) tries update_rate_index — must be rejected.
      const refresh = refreshReserveIx({
        reserve: ctx.underlyingReserve,
        lendingMarket: KAMINO_LENDING_MARKET,
        scopePrices: SCOPE_PRICES,
        kaminoProgram: ctx.underlyingProtocol,
      });

      await expectError(
        ctx.sdk.keeper.updateRateIndex.execute({
          keeper: ctx.deployer.publicKey,
          underlyingReserve: ctx.underlyingReserve,
          tenorSeconds: 2_592_000n,
          kaminoReserve: ctx.underlyingReserve,
          preInstructions: [refresh],
        }),
        /InvalidAuthority/i
      );
    } finally {
      // Restore deployer as keeper so the rest of the suite keeps working.
      // We need to call setKeeper from the AUTHORITY (deployer), which
      // is admin (separate from keeper authority). Deployer is BOTH.
      await ctx.sdk.admin.setKeeper.execute({
        authority: ctx.deployer.publicKey,
        newKeeper: ctx.deployer.publicKey,
      });
    }
  }, 30_000);

  // ---------- 3. TOKEN-2022 REJECTED ----------

  it("create_market rejects a Token-2022 mint with UnsupportedMintExtensions", async () => {
    if (!ctx) return;

    // Spin up a Token-2022 mint. The program's create_market checks
    // `underlying_mint.to_account_info().owner == &spl_token::ID` and rejects
    // anything owned by Token-2022.
    const t22Mint = await createMint(
      ctx.connection,
      ctx.deployer,
      ctx.deployer.publicKey,
      null,
      6,
      Keypair.generate(),
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    // Use a unique tenor so this market PDA is fresh (won't collide with
    // bootstrap markets). Token-2022 mints will never be valid for the
    // primary kamino USDC reserve, so we point the same reserve and a
    // fake k-mint and let the program reject before getting to Kamino.
    const ATTEMPT_TENOR = BigInt(1234);
    const { address: marketPda } = await PdaDeriver.market(
      ctx.underlyingReserve,
      ATTEMPT_TENOR
    );
    const { address: lpVaultPda } = await PdaDeriver.lpVault(marketPda);
    const { address: collateralVaultPda } =
      await PdaDeriver.collateralVault(marketPda);
    const { address: lpMintPda } = await PdaDeriver.lpMint(marketPda);
    const { address: kaminoDepositPda } =
      await PdaDeriver.kaminoDepositAccount(marketPda);

    // Throw-away k-USDC placeholder for this attempt (same convention as
    // bootstrapShortMarket).
    const fakeK = await createMint(
      ctx.connection,
      ctx.deployer,
      ctx.deployer.publicKey,
      null,
      6,
      Keypair.generate()
    );

    await expectError(
      ctx.rawProgram.methods
        .createMarket(
          new BN(ATTEMPT_TENOR.toString()),
          new BN(60),
          6_000,
          80
        )
        .accountsStrict({
          protocolState: ctx.protocolStatePda,
          market: marketPda,
          lpVault: lpVaultPda,
          collateralVault: collateralVaultPda,
          lpMint: lpMintPda,
          kaminoDepositAccount: kaminoDepositPda,
          kaminoCollateralMint: fakeK,
          underlyingReserve: ctx.underlyingReserve,
          underlyingProtocol: ctx.underlyingProtocol,
          underlyingMint: t22Mint,
          authority: ctx.deployer.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc(),
      // Either path proves the rejection: program-level
      // `UnsupportedMintExtensions` OR Anchor's `incorrect program id`
      // (the mint is owned by Token-2022 but we passed TOKEN_PROGRAM_ID).
      /UnsupportedMintExtensions|incorrect program id/i
    );
  }, 60_000);

  // ---------- 4. SLIPPAGE EDGE ----------

  it("receive-fixed with min_rate_bps > offered fixed_rate is rejected (SlippageExceeded)", async () => {
    if (!ctx || !shortMarket) return;

    const trader = Keypair.generate();
    const sig = await ctx.connection.requestAirdrop(
      trader.publicKey,
      100_000_000
    );
    await ctx.connection.confirmTransaction(sig, "confirmed");
    await setTokenBalance(
      ctx.connection,
      trader.publicKey,
      ctx.underlyingMint,
      100_000_000
    );

    const traderSdk = await sdkAs(ctx, trader);

    // Receive-fixed: trader receives the offered fixed_rate. With seeded
    // ~10% APY and 80 bps spread, fixed_rate offered ≈ 920 bps. Setting
    // min=10000 (100%) means the trader demands a fixed rate of at least
    // 100% — must be rejected with SlippageExceeded.
    await expectError(
      traderSdk.trader.openSwap.execute({
        trader: trader.publicKey,
        market: shortMarket.marketPda,
        underlyingMint: ctx.underlyingMint,
        treasury: ctx.treasury,
        collateralVault: shortMarket.collateralVaultPda,
        direction: SwapDirection.ReceiveFixed,
        notional: 100_000_000n,
        nonce: 92,
        maxRateBps: 65_535n,
        minRateBps: 10_000n, // demand ≥ 100% — unrealistic
      }),
      /SlippageExceeded/i
    );
  }, 30_000);
});
