import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { ANEMONE_PROGRAM_ID } from "../../constants";
import IDL from "../../../idl/anemone.json";

export type AnchorWallet = {
  publicKey: PublicKey;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
};

export function buildAnemoneProgram(
  connection: Connection,
  wallet: AnchorWallet
): Program {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program(IDL as Idl, provider);
}

export function buildReadonlyProgram(connection: Connection): Program {
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
