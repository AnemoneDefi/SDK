import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { describe, it, expect, vi } from "vitest";
import { PositionRepository } from "../PositionRepository";
import { LpStatus, PositionStatus, SwapDirection } from "../../../domain/enums";

vi.mock("../../pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      lpPosition: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111128"),
        bump: 253,
      }),
    },
  };
});

const PK = (s: string) => new PublicKey(s);

const RAW_LP = {
  isInitialized: true,
  owner: PK("So11111111111111111111111111111111111111114"),
  market: PK("So11111111111111111111111111111111111111115"),
  shares: new BN(1_000_000),
  depositedAmount: new BN(1_000_000),
  status: LpStatus.Active,
  bump: 253,
};

const RAW_SWAP = {
  owner: PK("So11111111111111111111111111111111111111114"),
  market: PK("So11111111111111111111111111111111111111115"),
  direction: SwapDirection.PayFixed,
  notional: new BN(10_000_000),
  fixedRateBps: new BN(490),
  spreadBpsAtOpen: new BN(80),
  collateralDeposited: new BN(50_000),
  collateralRemaining: new BN(45_000),
  entryRateIndex: new BN(456),
  lastSettledRateIndex: new BN(456),
  realizedPnl: new BN(0),
  numSettlements: 0,
  unpaidPnl: new BN(0),
  openTimestamp: new BN(1_700_000_000),
  maturityTimestamp: new BN(1_702_592_000),
  nextSettlementTs: new BN(1_700_086_400),
  lastSettlementTs: new BN(0),
  status: PositionStatus.Open,
  nonce: 0,
  bump: 253,
};

function buildProgramMock(opts: {
  lpFetch?: () => Promise<unknown>;
  lpAll?: () => Promise<unknown>;
  swapFetch?: () => Promise<unknown>;
  swapAll?: () => Promise<unknown>;
}) {
  return {
    account: {
      lpPosition: {
        fetch: vi.fn(opts.lpFetch ?? (() => Promise.resolve(RAW_LP))),
        all: vi.fn(opts.lpAll ?? (() => Promise.resolve([]))),
      },
      swapPosition: {
        fetch: vi.fn(opts.swapFetch ?? (() => Promise.resolve(RAW_SWAP))),
        all: vi.fn(opts.swapAll ?? (() => Promise.resolve([]))),
      },
    },
  } as any;
}

describe("PositionRepository", () => {
  describe("LP positions", () => {
    it("fetchLpPosition maps raw → LpPosition", async () => {
      const program = buildProgramMock({});
      const repo = new PositionRepository(program);

      const got = await repo.fetchLpPosition(
        "So11111111111111111111111111111111111111114",
        "So11111111111111111111111111111111111111115"
      );

      expect(got).not.toBeNull();
      expect(got!.publicKey).toBe(
        "So11111111111111111111111111111111111111128"
      );
      expect(got!.shares).toBe(BigInt(1_000_000));
      expect(got!.depositedAmount).toBe(BigInt(1_000_000));
      expect(got!.status).toBe(LpStatus.Active);
      expect(got!.isInitialized).toBe(true);
    });

    it("fetchLpPosition returns null on missing account", async () => {
      const program = buildProgramMock({
        lpFetch: () => Promise.reject(new Error("not found")),
      });
      const repo = new PositionRepository(program);

      const got = await repo.fetchLpPosition(
        "So11111111111111111111111111111111111111114",
        "So11111111111111111111111111111111111111115"
      );

      expect(got).toBeNull();
    });

    it("fetchLpPositionsByOwner maps each account", async () => {
      const program = buildProgramMock({
        lpAll: () =>
          Promise.resolve([
            {
              publicKey: PK("So11111111111111111111111111111111111111128"),
              account: RAW_LP,
            },
            {
              publicKey: PK("So11111111111111111111111111111111111111129"),
              account: { ...RAW_LP, shares: new BN(2_000_000) },
            },
          ]),
      });
      const repo = new PositionRepository(program);

      const got = await repo.fetchLpPositionsByOwner(
        "So11111111111111111111111111111111111111114"
      );

      expect(got).toHaveLength(2);
      expect(got[0].shares).toBe(BigInt(1_000_000));
      expect(got[1].shares).toBe(BigInt(2_000_000));
    });
  });

  describe("Swap positions", () => {
    it("fetchSwapPosition maps raw → SwapPosition (with unpaidPnl)", async () => {
      const program = buildProgramMock({});
      const repo = new PositionRepository(program);

      const got = await repo.fetchSwapPosition(
        "So11111111111111111111111111111111111111126"
      );

      expect(got).not.toBeNull();
      expect(got!.notional).toBe(BigInt(10_000_000));
      expect(got!.collateralRemaining).toBe(BigInt(45_000));
      expect(got!.direction).toBe(SwapDirection.PayFixed);
      expect(got!.unpaidPnl).toBe(BigInt(0));
      expect(got!.numSettlements).toBe(0);
      expect(got!.status).toBe(PositionStatus.Open);
    });

    it("fetchSwapPosition propagates non-zero unpaidPnl", async () => {
      const program = buildProgramMock({
        swapFetch: () =>
          Promise.resolve({ ...RAW_SWAP, unpaidPnl: new BN(123) }),
      });
      const repo = new PositionRepository(program);

      const got = await repo.fetchSwapPosition(
        "So11111111111111111111111111111111111111126"
      );

      expect(got!.unpaidPnl).toBe(BigInt(123));
    });

    it("fetchSwapPositionsByOwner maps each account", async () => {
      const program = buildProgramMock({
        swapAll: () =>
          Promise.resolve([
            {
              publicKey: PK("So11111111111111111111111111111111111111126"),
              account: RAW_SWAP,
            },
          ]),
      });
      const repo = new PositionRepository(program);

      const got = await repo.fetchSwapPositionsByOwner(
        "So11111111111111111111111111111111111111114"
      );

      expect(got).toHaveLength(1);
      expect(got[0].publicKey).toBe(
        "So11111111111111111111111111111111111111126"
      );
    });
  });
});
