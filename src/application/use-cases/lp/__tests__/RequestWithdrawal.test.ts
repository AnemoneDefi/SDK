import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestWithdrawal } from "../RequestWithdrawal";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      lpPosition: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111112"),
        bump: 254,
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
      () => new PublicKey("So11111111111111111111111111111111111111113")
    ),
  };
});

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      requestWithdrawal: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("RequestWithdrawal", () => {
  const owner = new PublicKey("So11111111111111111111111111111111111111114");
  const market = new PublicKey("So11111111111111111111111111111111111111115");
  const underlyingMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );
  const lpMint = new PublicKey("So11111111111111111111111111111111111111116");
  const lpVault = new PublicKey("So11111111111111111111111111111111111111117");
  const treasury = new PublicKey("So11111111111111111111111111111111111111118");

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("withdrawSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new RequestWithdrawal(program);

    const result = await useCase.execute({
      owner,
      market,
      underlyingMint,
      lpMint,
      lpVault,
      treasury,
      sharesToBurn: BigInt(500_000),
    });

    expect(result.signature).toBe("withdrawSig");
  });

  it("passes sharesToBurn to program method", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new RequestWithdrawal(program);

    await useCase.execute({
      owner,
      market,
      underlyingMint,
      lpMint,
      lpVault,
      treasury,
      sharesToBurn: BigInt(250_000),
    });

    expect(program.methods.requestWithdrawal.mock.calls[0][0]).toBe(
      BigInt(250_000)
    );
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("pool undercollateralized"));
    const program = buildProgramMock(rpcMock);
    const useCase = new RequestWithdrawal(program);

    await expect(
      useCase.execute({
        owner,
        market,
        underlyingMint,
        lpMint,
        lpVault,
        treasury,
        sharesToBurn: BigInt(500_000),
      })
    ).rejects.toThrow("pool undercollateralized");
  });
});
