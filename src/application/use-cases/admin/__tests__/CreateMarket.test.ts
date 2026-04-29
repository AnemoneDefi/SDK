import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateMarket } from "../CreateMarket";
import {
  DEFAULT_BASE_SPREAD_BPS,
  DEFAULT_MAX_LEVERAGE,
  DEFAULT_MAX_UTILIZATION_BPS,
  SECONDS_PER_DAY,
} from "../../../../constants";

// vi.mock is hoisted — must not reference outer const variables
vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      protocol: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111115"),
        bump: 254,
      }),
      market: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111112"),
        bump: 253,
      }),
      lpVault: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111117"),
        bump: 252,
      }),
      collateralVault: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111116"),
        bump: 251,
      }),
      lpMint: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111113"),
        bump: 250,
      }),
    },
  };
});

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      createMarket: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("CreateMarket", () => {
  const authority = new PublicKey("So11111111111111111111111111111111111111117");
  const underlyingReserve = new PublicKey(
    "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
  );
  const underlyingProtocol = new PublicKey(
    "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
  );
  const underlyingMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("txSig123");
  });

  it("returns market, lpMint, and lpVault addresses", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new CreateMarket(program);

    const result = await useCase.execute({
      authority,
      underlyingReserve,
      underlyingProtocol,
      underlyingMint,
    });

    expect(result.signature).toBe("txSig123");
    expect(result.marketAddress).toBe(
      "So11111111111111111111111111111111111111112"
    );
    expect(result.lpMintAddress).toBe(
      "So11111111111111111111111111111111111111113"
    );
    expect(result.lpVaultAddress).toBe(
      "So11111111111111111111111111111111111111117"
    );
  });

  it("uses default market parameters when not specified", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new CreateMarket(program);

    await useCase.execute({
      authority,
      underlyingReserve,
      underlyingProtocol,
      underlyingMint,
    });

    const args = program.methods.createMarket.mock.calls[0];
    expect(args[1]).toBe(BigInt(SECONDS_PER_DAY));
    expect(args[2]).toBe(DEFAULT_MAX_UTILIZATION_BPS);
    expect(args[3]).toBe(DEFAULT_BASE_SPREAD_BPS);
    expect(args[4]).toBe(DEFAULT_MAX_LEVERAGE);
  });

  it("uses custom market parameters when specified", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new CreateMarket(program);

    await useCase.execute({
      authority,
      underlyingReserve,
      underlyingProtocol,
      underlyingMint,
      tenorSeconds: BigInt(90 * SECONDS_PER_DAY),
      settlementPeriodSeconds: BigInt(SECONDS_PER_DAY * 7),
      maxUtilizationBps: 5000,
      baseSpreadBps: 100,
      maxLeverage: 10,
    });

    const args = program.methods.createMarket.mock.calls[0];
    expect(args[0]).toBe(BigInt(90 * SECONDS_PER_DAY));
    expect(args[1]).toBe(BigInt(SECONDS_PER_DAY * 7));
    expect(args[2]).toBe(5000);
    expect(args[3]).toBe(100);
    expect(args[4]).toBe(10);
  });
});
