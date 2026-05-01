import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetKeeper } from "../SetKeeper";

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

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      setKeeper: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("SetKeeper", () => {
  const authority = new PublicKey("So11111111111111111111111111111111111111114");
  const newKeeper = new PublicKey("So11111111111111111111111111111111111111115");

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("setKeeperSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new SetKeeper(program);

    const result = await useCase.execute({ authority, newKeeper });

    expect(result.signature).toBe("setKeeperSig");
  });

  it("passes newKeeper PublicKey as positional arg", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new SetKeeper(program);

    await useCase.execute({ authority, newKeeper });

    expect(program.methods.setKeeper.mock.calls[0][0]).toBe(newKeeper);
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("invalid authority"));
    const program = buildProgramMock(rpcMock);
    const useCase = new SetKeeper(program);

    await expect(useCase.execute({ authority, newKeeper })).rejects.toThrow(
      "invalid authority"
    );
  });
});
