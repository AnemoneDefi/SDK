/**
 * LIQUIDATION POSITIVE E2E — exercises the *successful* liquidation path.
 *
 * To force a position underwater on a freshly-opened swap, this test cheats:
 * after open, we use surfpool's `surfnet_setAccount` to overwrite
 * `swap_position.collateral_remaining` to a value below maintenance margin.
 * The program cannot tell the difference between this and a legitimate
 * settlement-driven drain — the assertions cover the same fee-split math
 * (1/3 treasury, 2/3 liquidator) that a real liquidation would exercise.
 *
 * Flow:
 *   1. Bootstrap primary + LP-deposit
 *   2. open_swap with NONCE 41
 *   3. Read swap_position raw bytes; rewrite collateral_remaining = 1 lamport
 *      (well below maintenance) via surfnet_setAccount
 *   4. liquidate_position via SDK (with refresh preInstruction)
 *   5. Assert:
 *      - position account closed
 *      - liquidator received ~2/3 of fee
 *      - treasury received ~1/3 of fee
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";
import { rpcAvailable } from "./helpers/connection";
import { bootstrapEnvironment, seedRateIndex } from "./helpers/bootstrap";
import type { BootstrapResult } from "./helpers/bootstrap";
import {
  KAMINO_LENDING_MARKET,
  SCOPE_PRICES,
  refreshReserveIx,
  setAccountData,
  setTokenBalance,
} from "./helpers/surfpool";
import { SwapDirection } from "../src/domain/enums";
import { PdaDeriver } from "../src/infrastructure/pda/PdaDeriver";

const NONCE = 41;

/**
 * Open a swap signed by an arbitrary keypair (not ctx's deployer wallet).
 * Builds a fresh AnchorProvider rooted at `trader` and instantiates the SDK
 * use-case against it — the SDK already supports any AnemoneProgram, so the
 * test just needs to wire a trader-bound program.
 */
async function openSwapAsTrader(
  ctx: BootstrapResult,
  trader: Keypair,
  nonce: number
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
    market: ctx.marketPda,
    underlyingMint: ctx.underlyingMint,
    treasury: ctx.treasury,
    collateralVault: ctx.collateralVaultPda,
    direction: SwapDirection.PayFixed,
    notional: 100_000_000n,
    nonce,
    maxRateBps: 65_535n,
    minRateBps: 0n,
  });
}

// SwapPosition layout (from state/position.rs). offsets in bytes from start
// of account data (after Anchor 8-byte discriminator):
//   0   discriminator (8)
//   8   owner (32)
//   40  market (32)
//   72  direction (1, enum)
//   73  notional (8, u64)
//   81  fixed_rate_bps (8, u64)
//   89  spread_bps_at_open (8, u64)   ← added in PR #32 (protocol-fee-on-spread)
//   97  collateral_deposited (8, u64)
//   105 collateral_remaining (8, u64) ← target
const COLLATERAL_REMAINING_OFFSET = 105;

describe("E2E: liquidation positive path (forced underwater)", () => {
  let ctx: BootstrapResult | null = null;
  let liquidator: Keypair;
  // The split-ratio test needs the trader to be DIFFERENT from the treasury
  // wallet, otherwise `remainder` (paid to owner's ATA) lands in the same
  // account as `treasury_fee` and breaks the split snapshot delta.
  let trader: Keypair;

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
      5_000_000_000
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

    const market = await ctx.rawProgram.account.swapMarket.fetch(ctx.marketPda);
    const TARGET = 2_000_000_000n;
    if (BigInt(market.lpNav.toString()) < TARGET) {
      await ctx.sdk.lp.depositLiquidity.execute({
        depositor: ctx.deployer.publicKey,
        market: ctx.marketPda,
        underlyingMint: ctx.underlyingMint,
        lpMint: ctx.lpMintPda,
        lpVault: ctx.lpVaultPda,
        amount: TARGET - BigInt(market.lpNav.toString()),
      });
    }

    // Liquidator with own keypair + USDC ATA (constraint token::authority = liquidator)
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

    // Trader (separate from deployer) so owner_token_account ≠ treasury_ata.
    trader = Keypair.generate();
    const tradSig = await ctx.connection.requestAirdrop(
      trader.publicKey,
      1_000_000_000
    );
    await ctx.connection.confirmTransaction(tradSig, "confirmed");
    // Fund trader with enough USDC to cover IM (~$2.5) + opening fee.
    await setTokenBalance(
      ctx.connection,
      trader.publicKey,
      ctx.underlyingMint,
      100_000_000 // 100 USDC
    );
  }, 120_000);

  it("forces a position underwater and liquidates with correct fee split", async () => {
    if (!ctx) return;

    const { address: positionPda } = await PdaDeriver.swapPosition(
      trader.publicKey,
      ctx.marketPda,
      NONCE
    );

    // Open swap signed by `trader` (different keypair than deployer/treasury).
    if (!(await ctx.connection.getAccountInfo(positionPda))) {
      await openSwapAsTrader(ctx, trader, NONCE);
    }

    // ---- Forge underwater: rewrite collateral_remaining = 1 lamport.
    const accountInfo = await ctx.connection.getAccountInfo(positionPda);
    if (!accountInfo) throw new Error("position vanished");
    const data = Buffer.from(accountInfo.data);
    // Set u64 collateral_remaining to 1 (LE)
    data.writeBigUInt64LE(1n, COLLATERAL_REMAINING_OFFSET);
    await setAccountData(ctx.connection, positionPda, data);

    // Sanity: SDK reads back the forged value
    const forged = await ctx.sdk.query.positions.fetchSwapPosition(
      positionPda.toBase58()
    );
    expect(forged!.collateralRemaining).toBe(1n);

    // ---- Snapshot fee accounts before liquidation
    const liquidatorAta = getAssociatedTokenAddressSync(
      ctx.underlyingMint,
      liquidator.publicKey
    );
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.underlyingMint,
      liquidator.publicKey
    );

    const treasuryBefore = (
      await getAccount(ctx.connection, ctx.treasury)
    ).amount;
    const liquidatorBefore = (
      await getAccount(ctx.connection, liquidatorAta)
    ).amount;

    // ---- Liquidate via SDK as the liquidator wallet (raw program is fine
    // here because conformance test already validates the SDK's account
    // ordering for liquidate_position; we need a different signer than the
    // wallet baked into ctx.sdk).
    const { Wallet, AnchorProvider, Program } = await import("@coral-xyz/anchor");
    const liquidatorWallet = new Wallet(liquidator);
    const liquidatorProvider = new AnchorProvider(
      ctx.connection,
      liquidatorWallet,
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
      preInstructions: [liquidateRefresh],
    });

    // ---- Position closed
    const closed = await ctx.connection.getAccountInfo(positionPda);
    expect(closed).toBeNull();

    // ---- Fee split: with collateral_remaining = 1 and liquidation_fee_bps
    // = 300 (3%), fee = floor(1 * 300 / 10_000) = 0. Both sides get 0 — too
    // small to assert split math meaningfully. Re-run with a larger forged
    // value to validate the actual 1/3 — 2/3 ratio.
    //
    // NOTE: keeping this case here proves the *plumbing* (program loaded
    // all 23 accounts and accepted treasury) and the underwater-detection
    // works. The split-ratio assertion lives in the next test.
    const treasuryAfter = (
      await getAccount(ctx.connection, ctx.treasury)
    ).amount;
    const liquidatorAfter = (
      await getAccount(ctx.connection, liquidatorAta)
    ).amount;

    // At collateral=1, fee=0 → both unchanged. This is the edge case.
    expect(treasuryAfter).toBeGreaterThanOrEqual(treasuryBefore);
    expect(liquidatorAfter).toBeGreaterThanOrEqual(liquidatorBefore);
  }, 60_000);

  it("liquidates with non-zero fee and validates 1/3 treasury, 2/3 liquidator split", async () => {
    if (!ctx) return;

    // Use a different nonce so we don't collide with the previous test.
    const SPLIT_NONCE = 42;
    const { address: positionPda } = await PdaDeriver.swapPosition(
      trader.publicKey,
      ctx.marketPda,
      SPLIT_NONCE
    );

    if (!(await ctx.connection.getAccountInfo(positionPda))) {
      await openSwapAsTrader(ctx, trader, SPLIT_NONCE);
    }

    // Forge collateral_remaining to a value comfortably below maintenance.
    // We can't predict the exact fee in advance because the program computes
    // it against `collateral_mtm` (= collateral_remaining + catchup_amount +
    // mark-to-market PnL), which depends on the rate-index drift between
    // open and liquidate. We assert the *split ratio* instead: the program
    // splits `fee = collateral_mtm * 300/10000` as treasury = fee/3,
    // liquidator = fee - fee/3.
    const FORGED_COLLATERAL = 30_000n;

    const accountInfo = await ctx.connection.getAccountInfo(positionPda);
    if (!accountInfo) throw new Error("position vanished");
    const data = Buffer.from(accountInfo.data);
    data.writeBigUInt64LE(FORGED_COLLATERAL, COLLATERAL_REMAINING_OFFSET);
    await setAccountData(ctx.connection, positionPda, data);

    // Snapshots (treasury already exists, liquidator ATA already created)
    const liquidatorAta = getAssociatedTokenAddressSync(
      ctx.underlyingMint,
      liquidator.publicKey
    );
    const treasuryBefore = (
      await getAccount(ctx.connection, ctx.treasury)
    ).amount;
    const liquidatorBefore = (
      await getAccount(ctx.connection, liquidatorAta)
    ).amount;

    // Liquidate via raw program with the liquidator's wallet
    const { Wallet, AnchorProvider, Program } = await import("@coral-xyz/anchor");
    const liquidatorWallet = new Wallet(liquidator);
    const liquidatorProvider = new AnchorProvider(
      ctx.connection,
      liquidatorWallet,
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
      preInstructions: [liquidateRefresh],
    });

    const treasuryAfter = (
      await getAccount(ctx.connection, ctx.treasury)
    ).amount;
    const liquidatorAfter = (
      await getAccount(ctx.connection, liquidatorAta)
    ).amount;

    // ---- The fee split. Both sides MUST receive a non-zero share, and the
    // ratio MUST match the program's `fee/3` for treasury / `fee - fee/3`
    // for liquidator (= 1/3 vs 2/3 with rounding favoring the liquidator).
    const treasuryFee = treasuryAfter - treasuryBefore;
    const liquidatorFee = liquidatorAfter - liquidatorBefore;
    const totalFee = treasuryFee + liquidatorFee;

    // Both sides got paid (proves the dual-transfer plumbing works)
    expect(treasuryFee).toBeGreaterThan(0n);
    expect(liquidatorFee).toBeGreaterThan(0n);

    // Exact split: program does treasury_fee = fee/3, liquidator_fee = fee - fee/3
    const expectedTreasuryFee = totalFee / 3n;
    const expectedLiquidatorFee = totalFee - expectedTreasuryFee;
    expect(treasuryFee).toBe(expectedTreasuryFee);
    expect(liquidatorFee).toBe(expectedLiquidatorFee);

    // Liquidator share is always >= treasury share (rounding favors the
    // liquidator when totalFee % 3 != 0). For totalFee divisible by 3 they
    // are exactly 1:2.
    expect(liquidatorFee).toBeGreaterThanOrEqual(treasuryFee * 2n);
  }, 60_000);
});
