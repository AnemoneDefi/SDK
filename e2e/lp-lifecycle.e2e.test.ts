/**
 * LP write E2E — proves end-to-end account ordering, BN encoding, ATA derivation
 * for the LP path against the live program.
 *
 * Flow:
 *   1. Bootstrap protocol + market + rate index (idempotent)
 *   2. Mint USDC to deployer via surfpool cheat
 *   3. sync_kamino_yield to seed last_kamino_sync_ts (avoid StaleNav)
 *   4. SDK deposit_liquidity → assert lp_nav grew
 *   5. SDK request_withdrawal of half shares → assert balance grew back
 */

import { BN } from "@coral-xyz/anchor";
import { describe, it, expect, beforeAll } from "vitest";
import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
  getAccount,
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

const DEPOSIT_AMOUNT = BigInt(10_000_000); // 10 USDC

describe("E2E: LP deposit + withdrawal lifecycle through SDK", () => {
  let ctx: BootstrapResult | null = null;

  beforeAll(async () => {
    if (!(await rpcAvailable())) {
      console.warn("[E2E skip] No validator at $RPC_URL.");
      return;
    }
    ctx = await bootstrapEnvironment();
    await seedRateIndex(ctx);

    // Mint USDC to deployer via surfpool cheat (100 USDC).
    await setTokenBalance(
      ctx.connection,
      ctx.deployer.publicKey,
      ctx.underlyingMint,
      100_000_000
    );

    // The program does NOT init the depositor's LP-token ATA — caller's job.
    // Create it idempotently so the test is replay-safe.
    await createAssociatedTokenAccountIdempotent(
      ctx.connection,
      ctx.deployer,
      ctx.lpMintPda,
      ctx.deployer.publicKey
    );

    // Seed last_kamino_sync_ts so deposit_liquidity / request_withdrawal pass
    // the MAX_NAV_STALENESS_SECS gate. Bundle a refresh_reserve preInstruction
    // to keep the Kamino reserve fresh.
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
  }, 90_000);

  it("deposits 10 USDC via SDK and lp_nav grows by exactly that", async () => {
    if (!ctx) return;

    const before = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );
    const lpNavBefore = before!.lpNav;

    const result = await ctx.sdk.lp.depositLiquidity.execute({
      depositor: ctx.deployer.publicKey,
      market: ctx.marketPda,
      underlyingMint: ctx.underlyingMint,
      lpMint: ctx.lpMintPda,
      lpVault: ctx.lpVaultPda,
      amount: DEPOSIT_AMOUNT,
    });

    expect(result.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);

    const after = await ctx.sdk.query.markets.fetchByAddress(
      ctx.marketPda.toBase58()
    );
    expect(after!.lpNav).toBe(lpNavBefore + DEPOSIT_AMOUNT);
    expect(after!.totalLpShares).toBeGreaterThan(0n);
  }, 30_000);

  it("LpPosition is queryable via SDK after deposit", async () => {
    if (!ctx) return;

    const lp = await ctx.sdk.query.positions.fetchLpPosition(
      ctx.deployer.publicKey.toBase58(),
      ctx.marketPda.toBase58()
    );

    expect(lp).not.toBeNull();
    expect(lp!.owner).toBe(ctx.deployer.publicKey.toBase58());
    expect(lp!.market).toBe(ctx.marketPda.toBase58());
    expect(lp!.shares).toBeGreaterThan(0n);
  });

  it("requestWithdrawal of half shares burns LP tokens and pays out USDC", async () => {
    if (!ctx) return;

    const lpBefore = await ctx.sdk.query.positions.fetchLpPosition(
      ctx.deployer.publicKey.toBase58(),
      ctx.marketPda.toBase58()
    );
    const shares = lpBefore!.shares;
    const half = shares / 2n;

    const usdcAta = getAssociatedTokenAddressSync(
      ctx.underlyingMint,
      ctx.deployer.publicKey
    );
    const usdcBefore = (await getAccount(ctx.connection, usdcAta)).amount;

    // Bundle a fresh sync_kamino_yield + refresh_reserve so NAV is < 600s old.
    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });
    const syncIx = await ctx.rawProgram.methods
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
      .instruction();

    const result = await ctx.sdk.lp.requestWithdrawal.execute({
      withdrawer: ctx.deployer.publicKey,
      market: ctx.marketPda,
      underlyingMint: ctx.underlyingMint,
      lpMint: ctx.lpMintPda,
      lpVault: ctx.lpVaultPda,
      treasury: ctx.treasury,
      sharesToBurn: half,
      kaminoReserve: ctx.underlyingReserve,
      kaminoLendingMarket: ctx.kamino.lendingMarket,
      kaminoLendingMarketAuthority: ctx.kamino.lendingMarketAuthority,
      reserveLiquidityMint: ctx.underlyingMint,
      reserveLiquiditySupply: ctx.kamino.reserveLiquiditySupply,
      reserveCollateralMint: ctx.kamino.reserveCollateralMint,
      collateralTokenProgram: TOKEN_PROGRAM_ID,
      liquidityTokenProgram: TOKEN_PROGRAM_ID,
    });

    expect(result.signature).toMatch(/^[1-9A-HJ-NP-Za-km-z]+$/);

    const usdcAfter = (await getAccount(ctx.connection, usdcAta)).amount;
    expect(usdcAfter).toBeGreaterThan(usdcBefore);

    const lpAfter = await ctx.sdk.query.positions.fetchLpPosition(
      ctx.deployer.publicKey.toBase58(),
      ctx.marketPda.toBase58()
    );
    expect(lpAfter!.shares).toBe(shares - half);
  }, 30_000);
});
