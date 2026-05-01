import { PublicKey } from "@solana/web3.js";
import { ANEMONE_PROGRAM_ID, SEEDS } from "../../constants";

export interface DerivedPda {
  address: PublicKey;
  bump: number;
}

function toSeedBuffer(str: string): Buffer {
  return Buffer.from(str, "utf-8");
}

function i64ToLeBytes(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(value);
  return buf;
}

const PROGRAM_ID = new PublicKey(ANEMONE_PROGRAM_ID);

async function derive(seeds: Buffer[]): Promise<DerivedPda> {
  const [address, bump] = await PublicKey.findProgramAddress(seeds, PROGRAM_ID);
  return { address, bump };
}

export const PdaDeriver = {
  protocol(): Promise<DerivedPda> {
    return derive([toSeedBuffer(SEEDS.PROTOCOL)]);
  },

  market(underlyingReserve: PublicKey, tenorSeconds: bigint): Promise<DerivedPda> {
    return derive([
      toSeedBuffer(SEEDS.MARKET),
      underlyingReserve.toBuffer(),
      i64ToLeBytes(tenorSeconds),
    ]);
  },

  lpVault(market: PublicKey): Promise<DerivedPda> {
    return derive([toSeedBuffer(SEEDS.LP_VAULT), market.toBuffer()]);
  },

  collateralVault(market: PublicKey): Promise<DerivedPda> {
    return derive([toSeedBuffer(SEEDS.COLLATERAL_VAULT), market.toBuffer()]);
  },

  lpMint(market: PublicKey): Promise<DerivedPda> {
    return derive([toSeedBuffer(SEEDS.LP_MINT), market.toBuffer()]);
  },

  kaminoDepositAccount(market: PublicKey): Promise<DerivedPda> {
    return derive([toSeedBuffer(SEEDS.KAMINO_DEPOSIT), market.toBuffer()]);
  },

  lpPosition(owner: PublicKey, market: PublicKey): Promise<DerivedPda> {
    return derive([
      toSeedBuffer(SEEDS.LP_POSITION),
      owner.toBuffer(),
      market.toBuffer(),
    ]);
  },

  /**
   * Swap position seed mirrors the program: `[b"swap", trader, market, nonce]`.
   * Note that the trader (owner) comes BEFORE market, opposite of `lpPosition`.
   */
  swapPosition(
    trader: PublicKey,
    market: PublicKey,
    nonce: number
  ): Promise<DerivedPda> {
    return derive([
      toSeedBuffer(SEEDS.SWAP_POSITION),
      trader.toBuffer(),
      market.toBuffer(),
      Buffer.from([nonce]),
    ]);
  },
};
