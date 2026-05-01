import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepositLiquidity } from "../DepositLiquidity";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      protocol: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111119"),
        bump: 254,
      }),
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
      depositLiquidity: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("DepositLiquidity", () => {
  const depositor = new PublicKey("So11111111111111111111111111111111111111114");
  const market = new PublicKey("So11111111111111111111111111111111111111115");
  const underlyingMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );
  const lpMint = new PublicKey("So11111111111111111111111111111111111111116");
  const lpVault = new PublicKey("So11111111111111111111111111111111111111117");

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("depositSig");
  });

  it("returns signature and lpPosition address", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new DepositLiquidity(program);

    const result = await useCase.execute({
      depositor,
      market,
      underlyingMint,
      lpMint,
      lpVault,
      amount: BigInt(1_000_000),
    });

    expect(result.signature).toBe("depositSig");
    expect(result.lpPositionAddress).toBe(
      "So11111111111111111111111111111111111111112"
    );
  });

  it("passes amount to program method", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new DepositLiquidity(program);

    await useCase.execute({
      depositor,
      market,
      underlyingMint,
      lpMint,
      lpVault,
      amount: BigInt(5_000_000),
    });

    expect(program.methods.depositLiquidity.mock.calls[0][0].toString()).toBe(
      "5000000"
    );
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("insufficient funds"));
    const program = buildProgramMock(rpcMock);
    const useCase = new DepositLiquidity(program);

    await expect(
      useCase.execute({
        depositor,
        market,
        underlyingMint,
        lpMint,
        lpVault,
        amount: BigInt(1_000_000),
      })
    ).rejects.toThrow("insufficient funds");
  });
});
