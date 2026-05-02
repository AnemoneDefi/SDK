import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SyncKaminoYield } from "../SyncKaminoYield";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      market: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111122"),
        bump: 253,
      }),
      kaminoDepositAccount: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111123"),
        bump: 252,
      }),
    },
  };
});

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      syncKaminoYield: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("SyncKaminoYield", () => {
  const baseParams = {
    underlyingReserve: new PublicKey(
      "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
    ),
    tenorSeconds: BigInt(30 * 86_400),
    kaminoReserve: new PublicKey("So11111111111111111111111111111111111111124"),
    kaminoLendingMarket: new PublicKey(
      "So11111111111111111111111111111111111111125"
    ),
    pythOracle: PublicKey.default,
    switchboardPriceOracle: PublicKey.default,
    switchboardTwapOracle: PublicKey.default,
    scopePrices: PublicKey.default,
  };

  let rpcMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("syncSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new SyncKaminoYield(program);

    const result = await useCase.execute(baseParams);

    expect(result.signature).toBe("syncSig");
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("oracle stale"));
    const program = buildProgramMock(rpcMock);
    const useCase = new SyncKaminoYield(program);

    await expect(useCase.execute(baseParams)).rejects.toThrow("oracle stale");
  });
});
