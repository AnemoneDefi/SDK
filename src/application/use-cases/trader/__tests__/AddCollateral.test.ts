import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddCollateral } from "../AddCollateral";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      swapPosition: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111126"),
        bump: 253,
      }),
    },
  };
});

vi.mock("@solana/spl-token", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    TOKEN_PROGRAM_ID: new PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    ),
    getAssociatedTokenAddressSync: vi.fn(
      () => new PublicKey("So11111111111111111111111111111111111111127")
    ),
  };
});

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      addCollateral: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("AddCollateral", () => {
  const baseParams = {
    owner: new PublicKey("So11111111111111111111111111111111111111114"),
    market: new PublicKey("So11111111111111111111111111111111111111115"),
    underlyingMint: new PublicKey(
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    ),
    collateralVault: new PublicKey(
      "So11111111111111111111111111111111111111118"
    ),
    nonce: 0,
  };

  let rpcMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("addCollateralSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new AddCollateral(program);

    const result = await useCase.execute({
      ...baseParams,
      amount: BigInt(1_000_000),
    });

    expect(result.signature).toBe("addCollateralSig");
  });

  it("passes amount to program method as BN", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new AddCollateral(program);

    await useCase.execute({ ...baseParams, amount: BigInt(750_000) });

    expect(program.methods.addCollateral.mock.calls[0][0].toString()).toBe(
      "750000"
    );
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("position closed"));
    const program = buildProgramMock(rpcMock);
    const useCase = new AddCollateral(program);

    await expect(
      useCase.execute({ ...baseParams, amount: BigInt(1_000_000) })
    ).rejects.toThrow("position closed");
  });
});
