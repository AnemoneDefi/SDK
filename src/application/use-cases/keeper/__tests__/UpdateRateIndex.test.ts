import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpdateRateIndex } from "../UpdateRateIndex";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      market: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111112"),
        bump: 253,
      }),
    },
  };
});

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      updateRateIndex: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("UpdateRateIndex", () => {
  const underlyingReserve = new PublicKey(
    "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
  );
  const kaminoReserve = underlyingReserve;
  const tenorSeconds = BigInt(30 * 86_400);

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("updateRateSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new UpdateRateIndex(program);

    const result = await useCase.execute({
      underlyingReserve,
      tenorSeconds,
      kaminoReserve,
    });

    expect(result.signature).toBe("updateRateSig");
  });

  it("derives market PDA with correct reserve and tenor", async () => {
    const { PdaDeriver } = await import(
      "../../../../infrastructure/pda/PdaDeriver"
    );
    const program = buildProgramMock(rpcMock);
    const useCase = new UpdateRateIndex(program);

    await useCase.execute({ underlyingReserve, tenorSeconds, kaminoReserve });

    expect(PdaDeriver.market).toHaveBeenCalledWith(
      underlyingReserve,
      tenorSeconds
    );
  });

  it("calls updateRateIndex with no positional args (read-only instruction)", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new UpdateRateIndex(program);

    await useCase.execute({ underlyingReserve, tenorSeconds, kaminoReserve });

    expect(program.methods.updateRateIndex).toHaveBeenCalledWith();
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("stale oracle"));
    const program = buildProgramMock(rpcMock);
    const useCase = new UpdateRateIndex(program);

    await expect(
      useCase.execute({ underlyingReserve, tenorSeconds, kaminoReserve })
    ).rejects.toThrow("stale oracle");
  });
});
