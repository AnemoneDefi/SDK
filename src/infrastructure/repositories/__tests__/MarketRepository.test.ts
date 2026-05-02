import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { describe, it, expect, vi } from "vitest";
import { MarketRepository } from "../MarketRepository";

vi.mock("../../pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      market: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111122"),
        bump: 253,
      }),
    },
  };
});

const PK = (s: string) => new PublicKey(s);

const RAW_MARKET = {
  protocolState: PK("So11111111111111111111111111111111111111121"),
  underlyingProtocol: PK("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"),
  underlyingReserve: PK("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"),
  underlyingMint: PK("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  lpVault: PK("So11111111111111111111111111111111111111117"),
  kaminoDepositAccount: PK("So11111111111111111111111111111111111111123"),
  collateralVault: PK("So11111111111111111111111111111111111111118"),
  lpMint: PK("So11111111111111111111111111111111111111116"),
  tenorSeconds: new BN(2_592_000),
  settlementPeriodSeconds: new BN(86_400),
  maxUtilizationBps: 6000,
  baseSpreadBps: 50,
  lpNav: new BN(1_000_000),
  totalLpShares: new BN(1_000_000),
  totalFixedNotional: new BN(0),
  totalVariableNotional: new BN(0),
  previousRateIndex: new BN(123),
  previousRateUpdateTs: new BN(1_700_000_000),
  currentRateIndex: new BN(456),
  lastRateUpdateTs: new BN(1_700_000_300),
  cumulativeFeesEarned: new BN(50),
  totalOpenPositions: new BN(0),
  totalKaminoCollateral: new BN(800_000),
  lastKaminoSnapshotUsdc: new BN(800_500),
  lastKaminoSyncTs: new BN(1_700_000_400),
  status: 0,
  bump: 253,
};

function buildProgramMock(opts: {
  fetch?: () => Promise<unknown>;
  all?: () => Promise<unknown>;
}) {
  return {
    account: {
      swapMarket: {
        fetch: vi.fn(opts.fetch ?? (() => Promise.resolve(RAW_MARKET))),
        all: vi.fn(opts.all ?? (() => Promise.resolve([]))),
      },
    },
  } as any;
}

describe("MarketRepository", () => {
  describe("fetchByAddress", () => {
    it("maps raw account → Market entity (full field coverage)", async () => {
      const program = buildProgramMock({});
      const repo = new MarketRepository(program);

      const got = await repo.fetchByAddress(
        "So11111111111111111111111111111111111111122"
      );

      expect(got).not.toBeNull();
      expect(got!.publicKey).toBe(
        "So11111111111111111111111111111111111111122"
      );
      expect(got!.tenorSeconds).toBe(BigInt(2_592_000));
      expect(got!.lpNav).toBe(BigInt(1_000_000));
      expect(got!.previousRateIndex).toBe(BigInt(123));
      expect(got!.currentRateIndex).toBe(BigInt(456));
      expect(got!.lastKaminoSyncTs).toBe(BigInt(1_700_000_400));
      expect(got!.totalKaminoCollateral).toBe(BigInt(800_000));
      expect(got!.maxUtilizationBps).toBe(6000);
      expect(got!.bump).toBe(253);
    });

    it("returns null for non-existent account", async () => {
      const program = buildProgramMock({
        fetch: () => Promise.reject(new Error("not found")),
      });
      const repo = new MarketRepository(program);

      const got = await repo.fetchByAddress(
        "So11111111111111111111111111111111111111122"
      );

      expect(got).toBeNull();
    });
  });

  describe("fetchAll", () => {
    it("maps each account in a getProgramAccounts result", async () => {
      const program = buildProgramMock({
        all: () =>
          Promise.resolve([
            {
              publicKey: PK("So11111111111111111111111111111111111111122"),
              account: RAW_MARKET,
            },
            {
              publicKey: PK("So11111111111111111111111111111111111111125"),
              account: { ...RAW_MARKET, currentRateIndex: new BN(789) },
            },
          ]),
      });
      const repo = new MarketRepository(program);

      const got = await repo.fetchAll();

      expect(got).toHaveLength(2);
      expect(got[0].currentRateIndex).toBe(BigInt(456));
      expect(got[1].currentRateIndex).toBe(BigInt(789));
    });

    it("returns empty array when no markets exist", async () => {
      const program = buildProgramMock({ all: () => Promise.resolve([]) });
      const repo = new MarketRepository(program);

      expect(await repo.fetchAll()).toEqual([]);
    });
  });

  describe("fetchByReserveAndTenor", () => {
    it("derives market PDA and delegates to fetchByAddress", async () => {
      const program = buildProgramMock({});
      const repo = new MarketRepository(program);

      const got = await repo.fetchByReserveAndTenor(
        "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59",
        BigInt(2_592_000)
      );

      expect(got).not.toBeNull();
      expect(got!.publicKey).toBe(
        "So11111111111111111111111111111111111111122"
      );
    });
  });
});
