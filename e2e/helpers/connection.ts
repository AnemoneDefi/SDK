import { Connection, Keypair } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";

export function loadKeypair(filePath: string): Keypair {
  const expanded = filePath.startsWith("~")
    ? path.join(os.homedir(), filePath.slice(1))
    : filePath;
  const bytes = JSON.parse(fs.readFileSync(expanded, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

export function loadDeployerWallet(): Wallet {
  const keypairPath =
    process.env.DEPLOYER_KEYPAIR ||
    path.join(os.homedir(), ".config/solana/id.json");
  return new Wallet(loadKeypair(keypairPath));
}

export function buildConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

/** Returns true when a validator is reachable at RPC_URL. */
export async function rpcAvailable(): Promise<boolean> {
  try {
    const conn = new Connection(RPC_URL, "confirmed");
    await Promise.race([
      conn.getVersion(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2_000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tries to load the on-chain deployment metadata that the anemone repo writes
 * out after `setup-surfpool` / `setup-devnet`. Returns null if the file does
 * not exist — most E2E tests can short-circuit and skip in that case.
 */
export function loadDeployment():
  | {
      protocolState: string;
      market: string;
      lpVault: string;
      collateralVault: string;
      lpMint: string;
      treasury: string;
      underlyingReserve: string;
      underlyingMint: string;
    }
  | null {
  const candidates = [
    process.env.DEPLOYMENT_FILE,
    path.join(__dirname, "../../../anemone/deployments/localnet.json"),
    path.join(__dirname, "../../../anemone/deployments/surfpool.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
  }
  return null;
}
