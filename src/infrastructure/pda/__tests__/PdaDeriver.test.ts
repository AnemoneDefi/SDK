/**
 * PdaDeriver tests verify each derivation against an independent re-derivation
 * via @solana/web3.js's findProgramAddressSync using the seeds documented in
 * the program's `#[derive(Accounts)]` blocks. If the program ever changes a
 * seed (e.g. b"market" → b"swap_market"), these tests break first.
 */

import { PublicKey } from "@solana/web3.js";
import { describe, it, expect } from "vitest";
import { PdaDeriver } from "../PdaDeriver";
import { ANEMONE_PROGRAM_ID } from "../../../constants";

const PROGRAM_ID = new PublicKey(ANEMONE_PROGRAM_ID);

function expectedPda(seeds: (Buffer | Uint8Array)[]): {
  address: PublicKey;
  bump: number;
} {
  const [address, bump] = PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
  return { address, bump };
}

function i64Le(v: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(v);
  return buf;
}

describe("PdaDeriver", () => {
  const market = new PublicKey("So11111111111111111111111111111111111111115");
  const owner = new PublicKey("So11111111111111111111111111111111111111114");
  const reserve = new PublicKey(
    "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
  );
  const tenor = BigInt(30 * 86_400);

  it("protocol seed = b'protocol'", async () => {
    const got = await PdaDeriver.protocol();
    const want = expectedPda([Buffer.from("protocol")]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
    expect(got.bump).toBe(want.bump);
  });

  it("market seed = b'market' + reserve + tenor_seconds_le", async () => {
    const got = await PdaDeriver.market(reserve, tenor);
    const want = expectedPda([
      Buffer.from("market"),
      reserve.toBuffer(),
      i64Le(tenor),
    ]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
    expect(got.bump).toBe(want.bump);
  });

  it("market produces different addresses for different tenors", async () => {
    const a = await PdaDeriver.market(reserve, BigInt(30 * 86_400));
    const b = await PdaDeriver.market(reserve, BigInt(90 * 86_400));
    expect(a.address.toBase58()).not.toBe(b.address.toBase58());
  });

  it("lpVault seed = b'lp_vault' + market", async () => {
    const got = await PdaDeriver.lpVault(market);
    const want = expectedPda([Buffer.from("lp_vault"), market.toBuffer()]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
  });

  it("collateralVault seed = b'collateral_vault' + market", async () => {
    const got = await PdaDeriver.collateralVault(market);
    const want = expectedPda([
      Buffer.from("collateral_vault"),
      market.toBuffer(),
    ]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
  });

  it("lpMint seed = b'lp_mint' + market", async () => {
    const got = await PdaDeriver.lpMint(market);
    const want = expectedPda([Buffer.from("lp_mint"), market.toBuffer()]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
  });

  it("kaminoDepositAccount seed = b'kamino_deposit' + market", async () => {
    const got = await PdaDeriver.kaminoDepositAccount(market);
    const want = expectedPda([
      Buffer.from("kamino_deposit"),
      market.toBuffer(),
    ]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
  });

  it("lpPosition seed = b'lp' + owner + market", async () => {
    const got = await PdaDeriver.lpPosition(owner, market);
    const want = expectedPda([
      Buffer.from("lp"),
      owner.toBuffer(),
      market.toBuffer(),
    ]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
  });

  it("swapPosition seed = b'swap' + trader + market + nonce", async () => {
    const got = await PdaDeriver.swapPosition(owner, market, 5);
    const want = expectedPda([
      Buffer.from("swap"),
      owner.toBuffer(),
      market.toBuffer(),
      Buffer.from([5]),
    ]);
    expect(got.address.toBase58()).toBe(want.address.toBase58());
  });

  it("swapPosition produces different addresses for different nonces", async () => {
    const a = await PdaDeriver.swapPosition(owner, market, 0);
    const b = await PdaDeriver.swapPosition(owner, market, 1);
    expect(a.address.toBase58()).not.toBe(b.address.toBase58());
  });

  it("market seed encoding is little-endian (regression)", async () => {
    // 30 days = 0x278d00 in u64 = bytes [0x00, 0x8d, 0x27, 0, 0, 0, 0, 0]
    const got = await PdaDeriver.market(reserve, BigInt(30 * 86_400));
    const beBytes = Buffer.alloc(8);
    beBytes.writeBigInt64BE(BigInt(30 * 86_400));
    const wrongBe = expectedPda([
      Buffer.from("market"),
      reserve.toBuffer(),
      beBytes,
    ]);
    // Sanity: the wrong BE encoding produces a different address. If this
    // assertion fails, someone changed PdaDeriver.market to use BE bytes.
    expect(got.address.toBase58()).not.toBe(wrongBe.address.toBase58());
  });
});
