/**
 * Surfpool RPC helpers — surfpool extends Solana RPC with cheats for setting
 * token balances and warping time, both required for E2E lifecycle tests.
 */

import { Connection, PublicKey } from "@solana/web3.js";

async function rpc(
  connection: Connection,
  method: string,
  params: unknown[]
): Promise<{ result?: any; error?: any }> {
  // The Connection class doesn't expose its RPC URL in a typed way, so we
  // reach into the private field. Stable across @solana/web3.js 1.9x.
  const endpoint = (connection as any)._rpcEndpoint as string;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return res.json() as Promise<{ result?: any; error?: any }>;
}

/**
 * Set the SPL token balance on `owner`'s ATA via surfpool's
 * `surfnet_setTokenAccount` cheat. Creates the ATA if missing.
 *
 * `amount` is raw token units (e.g. 5_000_000 for 5 USDC at 6 dp).
 */
export async function setTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  amount: bigint | number
): Promise<void> {
  const res = await rpc(connection, "surfnet_setTokenAccount", [
    owner.toBase58(),
    mint.toBase58(),
    { amount: Number(amount) },
  ]);
  if (res.error) {
    throw new Error(`surfnet_setTokenAccount failed: ${JSON.stringify(res.error)}`);
  }
}

/** Jump surfpool's clock forward by N slots from the current slot. */
export async function warpForwardSlots(
  connection: Connection,
  slots: number
): Promise<number> {
  const current = await connection.getSlot("confirmed");
  const target = current + slots;
  const res = await rpc(connection, "surfnet_timeTravel", [
    { absoluteSlot: target },
  ]);
  if (res.error) {
    throw new Error(`surfnet_timeTravel failed: ${JSON.stringify(res.error)}`);
  }
  return target;
}

/** Build a Kamino refresh_reserve instruction (anchor discriminator). */
export function refreshReserveIx(args: {
  reserve: PublicKey;
  lendingMarket: PublicKey;
  scopePrices: PublicKey;
  kaminoProgram: PublicKey;
}): import("@solana/web3.js").TransactionInstruction {
  const { TransactionInstruction } = require("@solana/web3.js");
  const REFRESH_RESERVE_DISCRIMINATOR = Buffer.from([
    2, 218, 138, 235, 79, 201, 25, 102,
  ]);
  return new TransactionInstruction({
    programId: args.kaminoProgram,
    keys: [
      { pubkey: args.reserve, isSigner: false, isWritable: true },
      { pubkey: args.lendingMarket, isSigner: false, isWritable: false },
      { pubkey: args.kaminoProgram, isSigner: false, isWritable: false },
      { pubkey: args.kaminoProgram, isSigner: false, isWritable: false },
      { pubkey: args.kaminoProgram, isSigner: false, isWritable: false },
      { pubkey: args.scopePrices, isSigner: false, isWritable: false },
    ],
    data: REFRESH_RESERVE_DISCRIMINATOR,
  });
}

/**
 * Overwrite the raw data bytes of an arbitrary on-chain account via
 * `surfnet_setAccount`. Use with extreme care — this is meant for E2E
 * tests that need to force a position into a specific state (e.g. drain
 * `collateral_remaining` to make liquidation fire). Programs cannot tell
 * the difference between this and a legit on-chain write.
 */
export async function setAccountData(
  connection: Connection,
  address: PublicKey,
  data: Buffer
): Promise<void> {
  const res = await rpc(connection, "surfnet_setAccount", [
    address.toBase58(),
    { data: data.toString("hex") },
  ]);
  if (res.error) {
    throw new Error(
      `surfnet_setAccount(data) failed: ${JSON.stringify(res.error)}`
    );
  }
}

/**
 * Get the on-chain unix_timestamp via getBlockTime(currentSlot). Surfpool's
 * forked slot inherits a mainnet timestamp, so on-chain `Clock` may be 100+
 * seconds offset from wall time. Use this — not `Date.now()` — when reasoning
 * about position.maturity_timestamp / next_settlement_ts.
 */
export async function onChainNowSec(connection: Connection): Promise<number> {
  const slot = await connection.getSlot("confirmed");
  const ts = await connection.getBlockTime(slot);
  if (ts === null) {
    throw new Error(`getBlockTime returned null for slot ${slot}`);
  }
  return ts;
}

/**
 * Wait `wallSecs` seconds of REAL wall-clock time. On-chain clock advances
 * at ~1× wall rate (surfpool produces a slot every 400ms by default), so
 * waiting `N` wall seconds advances on-chain by ~N as well — modulo any
 * initial offset, which `onChainNowSec` lets you account for explicitly.
 */
export function sleepWallSecs(wallSecs: number): Promise<void> {
  return new Promise((r) => setTimeout(r, wallSecs * 1000));
}

/** Mainnet Kamino USDC reserve, lending market, and Scope prices. */
export const KAMINO_USDC_RESERVE = new PublicKey(
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
);
export const KAMINO_LENDING_MARKET = new PublicKey(
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"
);
export const SCOPE_PRICES = new PublicKey(
  "3t4JZcueEzTbVP6kLxXrL3VpWx45jDer4eqysweBchNH"
);
