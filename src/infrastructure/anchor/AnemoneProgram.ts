import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { ANEMONE_PROGRAM_ID } from "../../constants";
import IDL from "../../../idl/anemone.json";
import type { Anemone } from "../../idl/anemone";

export type AnchorWallet = {
  publicKey: PublicKey;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
};

export type AnemoneProgram = Program<Anemone>;

export function buildAnemoneProgram(
  connection: Connection,
  wallet: AnchorWallet
): AnemoneProgram {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program<Anemone>(IDL as Anemone, provider);
}

export function buildReadonlyProgram(connection: Connection): AnemoneProgram {
  const keypair = Keypair.generate();
  const wallet: AnchorWallet = {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => tx,
    signAllTransactions: async (txs) => txs,
  };
  return buildAnemoneProgram(connection, wallet);
}

export { ANEMONE_PROGRAM_ID };
export const PROGRAM_PUBLIC_KEY = new PublicKey(ANEMONE_PROGRAM_ID);
