import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WithdrawFromKamino } from "../WithdrawFromKamino";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      protocol: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111121"),
        bump: 254,
      }),
      market: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111112"),
        bump: 253,
      }),
      lpVault: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111113"),
        bump: 252,
      }),
      kaminoDepositAccount: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111114"),
        bump: 251,
      }),
    },
  };
});

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      withdrawFromKamino: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("WithdrawFromKamino", () => {
  const keeper = new PublicKey("So11111111111111111111111111111111111111115");
  const underlyingReserve = new PublicKey(
    "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
  );
  const kaminoReserve = underlyingReserve;
  const kaminoLendingMarket = new PublicKey(
    "So11111111111111111111111111111111111111116"
  );
  const kaminoLendingMarketAuthority = new PublicKey(
    "So11111111111111111111111111111111111111117"
  );
  const reserveLiquidityMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );
  const reserveLiquiditySupply = new PublicKey(
    "So11111111111111111111111111111111111111118"
  );
  const reserveCollateralMint = new PublicKey(
    "So11111111111111111111111111111111111111119"
  );
  const tokenProgram = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  );
  const tenorSeconds = BigInt(30 * 86_400);

  const baseParams = {
    keeper,
    underlyingReserve,
    tenorSeconds,
    kaminoReserve,
    kaminoLendingMarket,
    kaminoLendingMarketAuthority,
    reserveLiquidityMint,
    reserveLiquiditySupply,
    reserveCollateralMint,
    collateralTokenProgram: tokenProgram,
    liquidityTokenProgram: tokenProgram,
  };

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("kaminoWithdrawSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new WithdrawFromKamino(program);

    const result = await useCase.execute({
      ...baseParams,
      collateralAmount: BigInt(8_000_000),
    });

    expect(result.signature).toBe("kaminoWithdrawSig");
  });

  it("passes collateralAmount to program method as BN", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new WithdrawFromKamino(program);

    await useCase.execute({
      ...baseParams,
      collateralAmount: BigInt(3_500_000),
    });

    expect(
      program.methods.withdrawFromKamino.mock.calls[0][0].toString()
    ).toBe("3500000");
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("insufficient collateral"));
    const program = buildProgramMock(rpcMock);
    const useCase = new WithdrawFromKamino(program);

    await expect(
      useCase.execute({
        ...baseParams,
        collateralAmount: BigInt(3_500_000),
      })
    ).rejects.toThrow("insufficient collateral");
  });
});
