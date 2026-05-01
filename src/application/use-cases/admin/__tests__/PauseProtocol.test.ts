import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PauseProtocol, UnpauseProtocol } from "../PauseProtocol";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      protocol: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111121"),
        bump: 254,
      }),
    },
  };
});

function buildProgramMock(method: string, rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      [method]: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

const authority = new PublicKey("So11111111111111111111111111111111111111114");

describe("PauseProtocol", () => {
  let rpcMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("pauseSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock("pauseProtocol", rpcMock);
    const useCase = new PauseProtocol(program);

    const result = await useCase.execute({ authority });

    expect(result.signature).toBe("pauseSig");
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("not authority"));
    const program = buildProgramMock("pauseProtocol", rpcMock);
    const useCase = new PauseProtocol(program);

    await expect(useCase.execute({ authority })).rejects.toThrow("not authority");
  });
});

describe("UnpauseProtocol", () => {
  let rpcMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("unpauseSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock("unpauseProtocol", rpcMock);
    const useCase = new UnpauseProtocol(program);

    const result = await useCase.execute({ authority });

    expect(result.signature).toBe("unpauseSig");
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("not paused"));
    const program = buildProgramMock("unpauseProtocol", rpcMock);
    const useCase = new UnpauseProtocol(program);

    await expect(useCase.execute({ authority })).rejects.toThrow("not paused");
  });
});
