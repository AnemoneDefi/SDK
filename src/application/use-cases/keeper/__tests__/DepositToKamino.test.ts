import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepositToKamino } from "../DepositToKamino";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
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

vi.mock("@solana/spl-token", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    TOKEN_PROGRAM_ID: new PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    ),
  };
});

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      depositToKamino: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("DepositToKamino", () => {
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
  const kaminoReserveLiquiditySupply = new PublicKey(
    "So11111111111111111111111111111111111111118"
  );
  const kaminoReserveCollateralMint = new PublicKey(
    "So11111111111111111111111111111111111111119"
  );
  const tenorSeconds = BigInt(30 * 86_400);

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("kaminoDepositSig");
  });

  it("returns the transaction signature", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new DepositToKamino(program);

    const result = await useCase.execute({
      keeper,
      underlyingReserve,
      tenorSeconds,
      kaminoReserve,
      kaminoLendingMarket,
      kaminoLendingMarketAuthority,
      kaminoReserveLiquiditySupply,
      kaminoReserveCollateralMint,
      amount: BigInt(10_000_000),
    });

    expect(result.signature).toBe("kaminoDepositSig");
  });

  it("passes amount to program method", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new DepositToKamino(program);

    await useCase.execute({
      keeper,
      underlyingReserve,
      tenorSeconds,
      kaminoReserve,
      kaminoLendingMarket,
      kaminoLendingMarketAuthority,
      kaminoReserveLiquiditySupply,
      kaminoReserveCollateralMint,
      amount: BigInt(99_000_000),
    });

    expect(program.methods.depositToKamino.mock.calls[0][0]).toBe(
      BigInt(99_000_000)
    );
  });
});
