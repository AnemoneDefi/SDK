import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SettlePeriod } from "../SettlePeriod";

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      settlePeriod: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("SettlePeriod", () => {
  const baseParams = {
    caller: new PublicKey("So11111111111111111111111111111111111111114"),
    market: new PublicKey("So11111111111111111111111111111111111111115"),
    swapPosition: new PublicKey("So11111111111111111111111111111111111111126"),
    underlyingMint: new PublicKey(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    ),
    lpVault: new PublicKey("So11111111111111111111111111111111111111117"),
    collateralVault: new PublicKey(
      "So11111111111111111111111111111111111111118"
    ),
  };

  let rpcMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("settleSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new SettlePeriod(program);

    const result = await useCase.execute(baseParams);

    expect(result.signature).toBe("settleSig");
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("not yet due"));
    const program = buildProgramMock(rpcMock);
    const useCase = new SettlePeriod(program);

    await expect(useCase.execute(baseParams)).rejects.toThrow("not yet due");
  });
});
