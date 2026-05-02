import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClosePositionEarly } from "../ClosePositionEarly";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      protocol: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111121"),
        bump: 254,
      }),
      kaminoDepositAccount: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111123"),
        bump: 252,
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
      closePositionEarly: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

const tokenProgram = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const underlyingMint = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

describe("ClosePositionEarly", () => {
  const baseParams = {
    owner: new PublicKey("So11111111111111111111111111111111111111114"),
    market: new PublicKey("So11111111111111111111111111111111111111115"),
    swapPosition: new PublicKey("So11111111111111111111111111111111111111126"),
    underlyingMint,
    lpVault: new PublicKey("So11111111111111111111111111111111111111117"),
    collateralVault: new PublicKey(
      "So11111111111111111111111111111111111111118"
    ),
    treasury: new PublicKey("So11111111111111111111111111111111111111119"),
    kaminoReserve: new PublicKey("Sx11111111111111111111111111111111111111141"),
    kaminoLendingMarket: new PublicKey(
      "Sx11111111111111111111111111111111111111142"
    ),
    kaminoLendingMarketAuthority: new PublicKey(
      "Sx11111111111111111111111111111111111111143"
    ),
    reserveLiquidityMint: underlyingMint,
    reserveLiquiditySupply: new PublicKey(
      "Sx11111111111111111111111111111111111111144"
    ),
    reserveCollateralMint: new PublicKey(
      "Sx11111111111111111111111111111111111111145"
    ),
    collateralTokenProgram: tokenProgram,
    liquidityTokenProgram: tokenProgram,
  };

  let rpcMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("closeSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new ClosePositionEarly(program);

    const result = await useCase.execute(baseParams);

    expect(result.signature).toBe("closeSig");
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("matured"));
    const program = buildProgramMock(rpcMock);
    const useCase = new ClosePositionEarly(program);

    await expect(useCase.execute(baseParams)).rejects.toThrow("matured");
  });
});
