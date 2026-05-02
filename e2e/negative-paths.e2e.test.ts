/**
 * NEGATIVE E2E — exercises program reverts through the SDK on the live
 * validator. Covers the most-frequented authorization, validation, and
 * state-machine guards. Each test asserts EITHER the canonical error name
 * (AnemoneError::*) OR the Anchor error code that maps to it, so the test
 * survives small framework upgrades.
 *
 * Why bother: the unit tests in src/__tests__ verify account ordering and BN
 * encoding, but mock out the chain. They cannot prove "wrong signer fails"
 * end-to-end — only that the SDK packs the tx with the same accounts the
 * IDL declares. These tests close that gap.
 *
 * Tests covered (one assertion per program error):
 *   1. set_keeper from non-admin              → InvalidAuthority (has_one)
 *   2. pause_protocol from non-admin          → InvalidAuthority (has_one)
 *   3. open_swap with notional < MIN_NOTIONAL → InvalidAmount
 *   4. settle_period before next_settlement_ts → SettlementNotDue
 *   5. liquidate on healthy position          → AboveMaintenanceMargin
 *   6. claim_matured on Open position         → PositionNotMatured
 *
 * Tests 4-6 share a single "happy" Open position (NONCE 71) so we don't
 * pay the open_swap cost three times.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { Keypair } from "@solana/web3.js";
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
  refreshReserveIx,
  setTokenBalance,
} from "./helpers/surfpool";
import { SwapDirection } from "../src/domain/enums";
import { PdaDeriver } from "../src/infrastructure/pda/PdaDeriver";

const NONCE = 71;
const NOTIONAL = 100_000_000n; // 100 USDC, well above MIN_NOTIONAL

/**
 * Builds an Anemone SDK rooted at an arbitrary signer keypair (the ctx.sdk
 * is rooted at the deployer wallet — useless for "wrong signer" tests).
 */
async function sdkAs(ctx: BootstrapResult, signer: Keypair) {
  const { Wallet, AnchorProvider } = await import("@coral-xyz/anchor");
  const { Anemone } = await import("../src/Anemone");
  return new Anemone({
    connection: ctx.connection,
    wallet: new Wallet(signer),
  });
}

/** Asserts the promise rejects AND the error mentions the expected program error name. */
async function expectAnemoneError(
  promise: Promise<unknown>,
  errorName: string
): Promise<void> {
  let caught: unknown = null;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught, "expected promise to reject").not.toBeNull();
  const message =
    caught && typeof caught === "object" && "message" in caught
      ? String((caught as { message: unknown }).message)
      : String(caught);
  expect(
    message.includes(errorName),
    `expected error message to mention ${errorName}, got: ${message}`
  ).toBe(true);
}

describe("E2E: negative paths through SDK", () => {
  let ctx: BootstrapResult | null = null;
  let shortMarket: ShortMarketResult | null = null;
  let trader: Keypair;
  let positionPda: import("@solana/web3.js").PublicKey;

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

    // Fresh sync_kamino_yield to pass staleness gate for deposit_liquidity.
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

    // LP NAV for the short market (so open_swap can pass utilization).
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

    // Trader keypair, separate from deployer.
    trader = Keypair.generate();
    const sig = await ctx.connection.requestAirdrop(
      trader.publicKey,
      1_000_000_000
    );
    await ctx.connection.confirmTransaction(sig, "confirmed");
    await setTokenBalance(
      ctx.connection,
      trader.publicKey,
      ctx.underlyingMint,
      200_000_000
    );

    // Open ONE position to be reused by tests 4-6.
    const { address } = await PdaDeriver.swapPosition(
      trader.publicKey,
      shortMarket.marketPda,
      NONCE
    );
    positionPda = address;

    if (!(await ctx.connection.getAccountInfo(positionPda))) {
      const traderSdk = await sdkAs(ctx, trader);
      await traderSdk.trader.openSwap.execute({
        trader: trader.publicKey,
        market: shortMarket.marketPda,
        underlyingMint: ctx.underlyingMint,
        treasury: ctx.treasury,
        collateralVault: shortMarket.collateralVaultPda,
        direction: SwapDirection.PayFixed,
        notional: NOTIONAL,
        nonce: NONCE,
        maxRateBps: 65_535n,
        minRateBps: 0n,
      });
    }
  }, 180_000);

  it("set_keeper from non-admin signer is rejected (InvalidAuthority)", async () => {
    if (!ctx) return;
    const stranger = Keypair.generate();
    const airdrop = await ctx.connection.requestAirdrop(
      stranger.publicKey,
      100_000_000
    );
    await ctx.connection.confirmTransaction(airdrop, "confirmed");

    const strangerSdk = await sdkAs(ctx, stranger);
    await expectAnemoneError(
      strangerSdk.admin.setKeeper.execute({
        authority: stranger.publicKey,
        newKeeper: stranger.publicKey,
      }),
      "InvalidAuthority"
    );
  }, 30_000);

  it("pause_protocol from non-admin signer is rejected (InvalidAuthority)", async () => {
    if (!ctx) return;
    const stranger = Keypair.generate();
    const airdrop = await ctx.connection.requestAirdrop(
      stranger.publicKey,
      100_000_000
    );
    await ctx.connection.confirmTransaction(airdrop, "confirmed");

    const strangerSdk = await sdkAs(ctx, stranger);
    await expectAnemoneError(
      strangerSdk.admin.pauseProtocol.execute({
        authority: stranger.publicKey,
      }),
      "InvalidAuthority"
    );
  }, 30_000);

  it("open_swap with notional < MIN_NOTIONAL ($10 USDC) is rejected (InvalidAmount)", async () => {
    if (!ctx || !shortMarket) return;
    const tinyTrader = Keypair.generate();
    const sig = await ctx.connection.requestAirdrop(
      tinyTrader.publicKey,
      100_000_000
    );
    await ctx.connection.confirmTransaction(sig, "confirmed");
    await setTokenBalance(
      ctx.connection,
      tinyTrader.publicKey,
      ctx.underlyingMint,
      100_000_000
    );

    const traderSdk = await sdkAs(ctx, tinyTrader);
    await expectAnemoneError(
      traderSdk.trader.openSwap.execute({
        trader: tinyTrader.publicKey,
        market: shortMarket.marketPda,
        underlyingMint: ctx.underlyingMint,
        treasury: ctx.treasury,
        collateralVault: shortMarket.collateralVaultPda,
        direction: SwapDirection.PayFixed,
        notional: 5_000_000n, // $5 — below MIN_NOTIONAL of $10
        nonce: 72,
        maxRateBps: 65_535n,
        minRateBps: 0n,
      }),
      "InvalidAmount"
    );
  }, 30_000);

  it("settle_period before next_settlement_ts is rejected (SettlementNotDue)", async () => {
    if (!ctx || !shortMarket) return;
    // Position was just opened; next_settlement_ts is ~60s in the future.
    // Calling settle_period now must be rejected.
    await expectAnemoneError(
      ctx.sdk.trader.settlePeriod.execute({
        caller: ctx.deployer.publicKey,
        market: shortMarket.marketPda,
        swapPosition: positionPda,
        underlyingMint: ctx.underlyingMint,
        lpVault: shortMarket.lpVaultPda,
        collateralVault: shortMarket.collateralVaultPda,
      }),
      "SettlementNotDue"
    );
  }, 30_000);

  it("liquidate_position on a healthy position is rejected (AboveMaintenanceMargin)", async () => {
    if (!ctx || !shortMarket) return;

    // Liquidator is whoever — using deployer for convenience.
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.underlyingMint,
      ctx.deployer.publicKey
    );

    const liquidateRefresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    await expectAnemoneError(
      ctx.sdk.trader.liquidatePosition.execute({
        liquidator: ctx.deployer.publicKey,
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
      }),
      "AboveMaintenanceMargin"
    );
  }, 30_000);

  it("claim_matured on an Open (not yet matured) position is rejected (PositionNotMatured)", async () => {
    if (!ctx || !shortMarket) return;

    // Need owner ATA for claim_matured (program transfers payout there).
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.underlyingMint,
      trader.publicKey
    );

    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });

    const traderSdk = await sdkAs(ctx, trader);
    await expectAnemoneError(
      traderSdk.trader.claimMatured.execute({
        owner: trader.publicKey,
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
        preInstructions: [refresh],
      }),
      "PositionNotMatured"
    );
  }, 30_000);
});
