/**
 * Bootstraps a clean Anemone deployment on the live validator. Idempotent —
 * each step short-circuits when the on-chain state is already in place, so
 * running multiple E2E tests in sequence reuses the same protocol/market.
 *
 * Returns the addresses every E2E test needs (PDAs + Kamino references) plus
 * the deployer wallet. Tests then layer their specific operations on top.
 */

import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getMint,
} from "@solana/spl-token";
import { Reserve } from "@kamino-finance/klend-sdk";
import {
  ANEMONE_PROGRAM_ID,
  KAMINO_PROGRAM_ID,
  USDC_MINT,
} from "../../src/constants";
import { Anemone } from "../../src/Anemone";
import IDL from "../../idl/anemone.json";
import type { Anemone as AnemoneIdl } from "../../src/idl/anemone";
import { PdaDeriver } from "../../src/infrastructure/pda/PdaDeriver";
import {
  KAMINO_LENDING_MARKET,
  KAMINO_USDC_RESERVE,
  SCOPE_PRICES,
  refreshReserveIx,
  setTokenBalance,
} from "./surfpool";
import {
  buildConnection,
  loadDeployerWallet,
} from "./connection";

export const TENOR_SECONDS = BigInt(2_592_000); // 30 days
export const SETTLEMENT_PERIOD_SECONDS = BigInt(86_400); // 1 day
export const MAX_UTILIZATION_BPS = 6_000;
export const BASE_SPREAD_BPS = 80;

// "Short" market — distinct PDA from the primary because tenor is in the
// market seed. Used by E2E tests that need to actually exercise settle /
// claim_matured / cycle through liquidation: the primary market's 30-day
// tenor + 1-day settlement is too long to wait through in a test.
//
// Tenor 301 (not the natural 300) so the PDA is FRESH on every surfpool
// restart in this dev branch. Surfpool persists our market state across
// restarts but re-forks Kamino's reserve in a way that desyncs our stored
// rate index from Kamino's bsf — a fresh PDA dodges the issue. Bump this
// any time the persisted short-market state goes bad.
export const SHORT_TENOR_SECONDS = BigInt(301);
export const SHORT_SETTLEMENT_PERIOD_SECONDS = BigInt(60); // 1 min

// "Kamino-real" market — tenor 1200s, distinct PDA from primary/short. Used
// only by the deposit_to_kamino/withdraw_from_kamino E2E because that flow
// requires the *real* k-USDC mint (Kamino refuses to mint k-tokens to a
// kamino_deposit_account whose mint doesn't match `reserve.collateral.
// mint_pubkey`). The other markets use a fake placeholder for simplicity.
export const KAMINO_TENOR_SECONDS = BigInt(1_200);
export const KAMINO_SETTLEMENT_PERIOD_SECONDS = BigInt(120);

const PROTOCOL_FEE_BPS = 1_000;
const OPENING_FEE_BPS = 5;
const LIQUIDATION_FEE_BPS = 300;
const WITHDRAWAL_FEE_BPS = 5;
const EARLY_CLOSE_FEE_BPS = 500;

export interface BootstrapResult {
  connection: Connection;
  wallet: Wallet;
  sdk: Anemone;
  rawProgram: Program<AnemoneIdl>;
  deployer: Keypair;
  protocolStatePda: PublicKey;
  marketPda: PublicKey;
  lpVaultPda: PublicKey;
  collateralVaultPda: PublicKey;
  lpMintPda: PublicKey;
  kaminoDepositPda: PublicKey;
  kaminoCollateralMint: PublicKey;
  underlyingMint: PublicKey;
  underlyingReserve: PublicKey;
  underlyingProtocol: PublicKey;
  treasury: PublicKey;
  /** Kamino-managed accounts resolved from the live USDC reserve. */
  kamino: {
    lendingMarket: PublicKey;
    lendingMarketAuthority: PublicKey;
    reserveLiquiditySupply: PublicKey;
    reserveCollateralMint: PublicKey;
  };
}

/**
 * Returns the full bootstrap context. Idempotent: re-running after a previous
 * setup is cheap (no transactions sent if everything already exists).
 */
export async function bootstrapEnvironment(): Promise<BootstrapResult> {
  const connection = buildConnection();
  const wallet = loadDeployerWallet();
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  // Use the raw Anchor Program for setup — admin instructions need explicit
  // BN encoding (createMarket takes i64 args, not bigint).
  const rawProgram = new Program<AnemoneIdl>(IDL as AnemoneIdl, provider);
  const sdk = new Anemone({ connection, wallet });

  const deployer = (wallet as any).payer as Keypair;
  const usdcMint = new PublicKey(USDC_MINT);
  const reserveMainnet = KAMINO_USDC_RESERVE;
  const kaminoProgram = new PublicKey(KAMINO_PROGRAM_ID);

  const { address: protocolStatePda } = await PdaDeriver.protocol();
  const { address: marketPda } = await PdaDeriver.market(
    reserveMainnet,
    TENOR_SECONDS
  );
  const { address: lpVaultPda } = await PdaDeriver.lpVault(marketPda);
  const { address: collateralVaultPda } =
    await PdaDeriver.collateralVault(marketPda);
  const { address: lpMintPda } = await PdaDeriver.lpMint(marketPda);
  const { address: kaminoDepositPda } =
    await PdaDeriver.kaminoDepositAccount(marketPda);

  // Treasury is the deployer's USDC ATA on the live mint. We seed it via
  // surfpool's setTokenAccount so the ATA exists with a zero balance — the
  // protocol writes opening + early-close + liquidation fees here later.
  await setTokenBalance(connection, deployer.publicKey, usdcMint, 0);
  const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
  const treasury = getAssociatedTokenAddressSync(usdcMint, deployer.publicKey);

  // ----- protocol state
  const protocolExists = await connection.getAccountInfo(protocolStatePda);
  if (!protocolExists) {
    await rawProgram.methods
      .initializeProtocol(
        PROTOCOL_FEE_BPS,
        OPENING_FEE_BPS,
        LIQUIDATION_FEE_BPS,
        WITHDRAWAL_FEE_BPS,
        EARLY_CLOSE_FEE_BPS
      )
      .accountsStrict({
        protocolState: protocolStatePda,
        authority: deployer.publicKey,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ----- market
  const marketExists = await connection.getAccountInfo(marketPda);
  let kaminoCollateralMint: PublicKey;
  if (marketExists) {
    // Re-derive kamino_collateral_mint from the existing kamino_deposit_account
    // (its mint is what we stored at create time).
    const ata = await connection.getParsedAccountInfo(kaminoDepositPda);
    const parsed = (ata.value as any)?.data?.parsed?.info;
    kaminoCollateralMint = new PublicKey(parsed.mint);
  } else {
    // Throw-away k-USDC placeholder. The real Kamino reserve's collateral mint
    // is read at runtime by the program for CPIs; the market just stores ours
    // as metadata for the kamino_deposit_account PDA.
    const fakeKaminoMint = Keypair.generate();
    kaminoCollateralMint = await createMint(
      connection,
      deployer,
      deployer.publicKey,
      null,
      6,
      fakeKaminoMint
    );

    await rawProgram.methods
      .createMarket(
        new BN(TENOR_SECONDS.toString()),
        new BN(SETTLEMENT_PERIOD_SECONDS.toString()),
        MAX_UTILIZATION_BPS,
        BASE_SPREAD_BPS
      )
      .accountsStrict({
        protocolState: protocolStatePda,
        market: marketPda,
        lpVault: lpVaultPda,
        collateralVault: collateralVaultPda,
        lpMint: lpMintPda,
        kaminoDepositAccount: kaminoDepositPda,
        kaminoCollateralMint,
        underlyingReserve: reserveMainnet,
        underlyingProtocol: kaminoProgram,
        underlyingMint: usdcMint,
        authority: deployer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  // ----- resolve the live Kamino USDC reserve's internal accounts. The
  // request_withdrawal redeem-on-shortfall path passes these as `mut`, so we
  // must give the program the right addresses even when no shortfall fires.
  const reserveAcc = await connection.getAccountInfo(reserveMainnet);
  if (!reserveAcc) {
    throw new Error(
      `Kamino reserve ${reserveMainnet.toBase58()} not found — surfpool fork issue?`
    );
  }
  const reserve = Reserve.decode(reserveAcc.data);
  const lendingMarket = new PublicKey(
    (reserve as any).lendingMarket.toString()
  );
  const reserveLiquiditySupply = new PublicKey(
    (reserve.liquidity as any).supplyVault.toString()
  );
  const reserveCollateralMint = new PublicKey(
    (reserve.collateral as any).mintPubkey.toString()
  );
  const [lendingMarketAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("lma"), lendingMarket.toBuffer()],
    kaminoProgram
  );

  return {
    connection,
    wallet,
    sdk,
    rawProgram,
    deployer,
    protocolStatePda,
    marketPda,
    lpVaultPda,
    collateralVaultPda,
    lpMintPda,
    kaminoDepositPda,
    kaminoCollateralMint,
    underlyingMint: usdcMint,
    underlyingReserve: reserveMainnet,
    underlyingProtocol: kaminoProgram,
    treasury,
    kamino: {
      lendingMarket,
      lendingMarketAuthority,
      reserveLiquiditySupply,
      reserveCollateralMint,
    },
  };
}

export interface ShortMarketResult {
  tenorSeconds: bigint;
  settlementPeriodSeconds: bigint;
  marketPda: PublicKey;
  lpVaultPda: PublicKey;
  collateralVaultPda: PublicKey;
  lpMintPda: PublicKey;
  kaminoDepositPda: PublicKey;
  kaminoCollateralMint: PublicKey;
}

/**
 * Bootstraps a SECOND market on the same Kamino USDC reserve with a 5-min
 * tenor + 1-min settlement period. Idempotent. Returns a struct of just the
 * short-market addresses — pair with the primary `BootstrapResult` to access
 * the protocol/treasury/Kamino references.
 *
 * Use this when an E2E test needs to actually progress through settle /
 * claim_matured (the primary market's 30-day tenor is too long to wait).
 */
export async function bootstrapShortMarket(
  ctx: BootstrapResult
): Promise<ShortMarketResult> {
  const { address: marketPda } = await PdaDeriver.market(
    ctx.underlyingReserve,
    SHORT_TENOR_SECONDS
  );
  const { address: lpVaultPda } = await PdaDeriver.lpVault(marketPda);
  const { address: collateralVaultPda } =
    await PdaDeriver.collateralVault(marketPda);
  const { address: lpMintPda } = await PdaDeriver.lpMint(marketPda);
  const { address: kaminoDepositPda } =
    await PdaDeriver.kaminoDepositAccount(marketPda);

  const exists = await ctx.connection.getAccountInfo(marketPda);
  let kaminoCollateralMint: PublicKey;

  if (exists) {
    const ata = await ctx.connection.getParsedAccountInfo(kaminoDepositPda);
    const parsed = (ata.value as any)?.data?.parsed?.info;
    kaminoCollateralMint = new PublicKey(parsed.mint);
  } else {
    // Throw-away k-USDC placeholder, same convention as the primary market.
    const fakeMint = Keypair.generate();
    kaminoCollateralMint = await createMint(
      ctx.connection,
      ctx.deployer,
      ctx.deployer.publicKey,
      null,
      6,
      fakeMint
    );

    await ctx.rawProgram.methods
      .createMarket(
        new BN(SHORT_TENOR_SECONDS.toString()),
        new BN(SHORT_SETTLEMENT_PERIOD_SECONDS.toString()),
        MAX_UTILIZATION_BPS,
        BASE_SPREAD_BPS
      )
      .accountsStrict({
        protocolState: ctx.protocolStatePda,
        market: marketPda,
        lpVault: lpVaultPda,
        collateralVault: collateralVaultPda,
        lpMint: lpMintPda,
        kaminoDepositAccount: kaminoDepositPda,
        kaminoCollateralMint,
        underlyingReserve: ctx.underlyingReserve,
        underlyingProtocol: ctx.underlyingProtocol,
        underlyingMint: ctx.underlyingMint,
        authority: ctx.deployer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  return {
    tenorSeconds: SHORT_TENOR_SECONDS,
    settlementPeriodSeconds: SHORT_SETTLEMENT_PERIOD_SECONDS,
    marketPda,
    lpVaultPda,
    collateralVaultPda,
    lpMintPda,
    kaminoDepositPda,
    kaminoCollateralMint,
  };
}

/**
 * Bootstraps a THIRD market using the REAL Kamino k-USDC mint as the
 * `kamino_deposit_account` mint. Required for `deposit_to_kamino` /
 * `withdraw_from_kamino` to round-trip USDC through the live Kamino reserve
 * — the fake placeholder mint used by primary/short markets makes Kamino's
 * `redeem_reserve_collateral` reject.
 *
 * Tenor 1200s; we don't actually wait through it in any E2E.
 */
export async function bootstrapKaminoMarket(
  ctx: BootstrapResult
): Promise<ShortMarketResult> {
  const { address: marketPda } = await PdaDeriver.market(
    ctx.underlyingReserve,
    KAMINO_TENOR_SECONDS
  );
  const { address: lpVaultPda } = await PdaDeriver.lpVault(marketPda);
  const { address: collateralVaultPda } =
    await PdaDeriver.collateralVault(marketPda);
  const { address: lpMintPda } = await PdaDeriver.lpMint(marketPda);
  const { address: kaminoDepositPda } =
    await PdaDeriver.kaminoDepositAccount(marketPda);

  const exists = await ctx.connection.getAccountInfo(marketPda);
  if (!exists) {
    // Use the REAL k-USDC mint from the Kamino reserve.
    await ctx.rawProgram.methods
      .createMarket(
        new BN(KAMINO_TENOR_SECONDS.toString()),
        new BN(KAMINO_SETTLEMENT_PERIOD_SECONDS.toString()),
        MAX_UTILIZATION_BPS,
        BASE_SPREAD_BPS
      )
      .accountsStrict({
        protocolState: ctx.protocolStatePda,
        market: marketPda,
        lpVault: lpVaultPda,
        collateralVault: collateralVaultPda,
        lpMint: lpMintPda,
        kaminoDepositAccount: kaminoDepositPda,
        kaminoCollateralMint: ctx.kamino.reserveCollateralMint,
        underlyingReserve: ctx.underlyingReserve,
        underlyingProtocol: ctx.underlyingProtocol,
        underlyingMint: ctx.underlyingMint,
        authority: ctx.deployer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  return {
    tenorSeconds: KAMINO_TENOR_SECONDS,
    settlementPeriodSeconds: KAMINO_SETTLEMENT_PERIOD_SECONDS,
    marketPda,
    lpVaultPda,
    collateralVaultPda,
    lpMintPda,
    kaminoDepositPda,
    kaminoCollateralMint: ctx.kamino.reserveCollateralMint,
  };
}

/**
 * Seed prev + current rate_index for an arbitrary market PDA. Unlike
 * `seedRateIndex` (which targets the primary market via the BootstrapResult),
 * this is parameterised — used for the short market. Bundles refreshReserve.
 */
export async function seedRateIndexFor(
  ctx: BootstrapResult,
  marketPda: PublicKey
): Promise<void> {
  // Always re-seed. The early-return optimization (skip if already-seeded
  // and fresh) caused suite-vs-isolation drift: a previous test leaves
  // state where the elapsed/index pair would technically pass the staleness
  // gate but produces an APY that blows past open_swap's slippage cap.
  // Re-seeding every call costs ~9-10s per test but is the only reliable
  // way to keep open_swap quotes consistent across test ordering.

  const callUpdateRate = async () => {
    const refresh = refreshReserveIx({
      reserve: ctx.underlyingReserve,
      lendingMarket: KAMINO_LENDING_MARKET,
      scopePrices: SCOPE_PRICES,
      kaminoProgram: ctx.underlyingProtocol,
    });
    await ctx.rawProgram.methods
      .updateRateIndex()
      .accountsStrict({
        protocolState: ctx.protocolStatePda,
        market: marketPda,
        kaminoReserve: ctx.underlyingReserve,
        keeper: ctx.deployer.publicKey,
      })
      .preInstructions([refresh])
      .rpc();
  };

  // Fallback: when surfpool restarts and re-forks the Kamino reserve at a
  // slot whose `cumulative_borrow_rate_bsf` is LOWER than what we previously
  // stored on this market, `update_rate_index` rejects with InvalidRateIndex
  // (monotonicity check). Recover by force-rewriting via set_rate_index_oracle
  // — admin-only path gated to dev-tools feature, exists exactly for this.
  const callOracleSeed = async () => {
    const reserveAcc = await ctx.connection.getAccountInfo(ctx.underlyingReserve);
    if (!reserveAcc) throw new Error("Kamino reserve not found");
    const reserve = Reserve.decode(reserveAcc.data);
    const bsfValue = (reserve.liquidity as any).cumulativeBorrowRateBsf.value;
    const lower = BigInt(bsfValue[0].toString());
    const upper = BigInt(bsfValue[1].toString()) << 64n;
    const liveBsf = lower | upper;
    // baseSeed picked just below live Kamino bsf so the two oracle writes
    // stay strictly ordered and end near the live value. delta sized for
    // ~10% APY over the 9s gap: APY = (delta/baseSeed) * year/elapsed →
    // delta/baseSeed ≈ 2.85e-8 → delta = baseSeed / 35_000_000.
    const baseSeed = liveBsf - liveBsf / 1_000n;
    const delta = baseSeed / 35_000_000n > 0n ? baseSeed / 35_000_000n : 1n;

    await ctx.rawProgram.methods
      .setRateIndexOracle(new BN(baseSeed.toString()))
      .accountsStrict({
        protocolState: ctx.protocolStatePda,
        market: marketPda,
        authority: ctx.deployer.publicKey,
      })
      .rpc();
    await new Promise((r) => setTimeout(r, 9_000));
    await ctx.rawProgram.methods
      .setRateIndexOracle(new BN((baseSeed + delta).toString()))
      .accountsStrict({
        protocolState: ctx.protocolStatePda,
        market: marketPda,
        authority: ctx.deployer.publicKey,
      })
      .rpc();
  };

  // Use the oracle path unconditionally. update_rate_index is exercised by
  // keeper-ops.e2e.test.ts directly — this helper just needs to land
  // sensible values on the market so open_swap quotes a sane APY. Going
  // through update_rate_index here makes the helper depend on Kamino's
  // bsf advancing between two 9-second-apart calls, which is unreliable
  // on a freshly-forked surfpool.
  await callOracleSeed();
}

/**
 * Populate previous + current rate index by calling update_rate_index twice
 * (with a 9s gap to satisfy MIN_RATE_UPDATE_ELAPSED_SECS). Bundles a fresh
 * Kamino refreshReserve preInstruction each time to avoid StaleOracle.
 *
 * Idempotent: if both indices are already seeded, only refreshes the current
 * one when it's older than `MAX_QUOTE_STALENESS_SECS / 2`. This keeps the
 * rate fresh for `open_swap` across multiple test files in one surfpool run.
 */
export async function seedRateIndex(ctx: BootstrapResult): Promise<void> {
  return seedRateIndexFor(ctx, ctx.marketPda);
}
