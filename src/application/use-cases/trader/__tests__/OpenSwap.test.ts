import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenSwap } from "../OpenSwap";
import { SwapDirection } from "../../../../domain/enums";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  return {
    PdaDeriver: {
      protocol: vi.fn().mockResolvedValue({
        address: new PublicKey("So11111111111111111111111111111111111111121"),
        bump: 254,
      }),
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
      openSwap: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({ rpc: rpcFn }),
      }),
    },
  } as any;
}

describe("OpenSwap", () => {
  const trader = new PublicKey("So11111111111111111111111111111111111111114");
  const market = new PublicKey("So11111111111111111111111111111111111111115");
  const underlyingMint = new PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  );
  const treasury = new PublicKey("So11111111111111111111111111111111111111117");
  const collateralVault = new PublicKey(
    "So11111111111111111111111111111111111111118"
  );

  const baseParams = {
    trader,
    market,
    underlyingMint,
    treasury,
    collateralVault,
    notional: BigInt(1_000_000),
    nonce: 0,
    maxRateBps: BigInt(1_000),
    minRateBps: BigInt(0),
  };

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue("openSwapSig");
  });

  it("returns signature and swapPositionAddress", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new OpenSwap(program);

    const result = await useCase.execute({
      ...baseParams,
      direction: SwapDirection.PayFixed,
    });

    expect(result.signature).toBe("openSwapSig");
    expect(result.swapPositionAddress).toBe(
      "So11111111111111111111111111111111111111126"
    );
  });

  it("encodes PayFixed direction as { payFixed: {} } for Anchor", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new OpenSwap(program);

    await useCase.execute({
      ...baseParams,
      direction: SwapDirection.PayFixed,
    });

    const args = program.methods.openSwap.mock.calls[0];
    expect(args[0]).toEqual({ payFixed: {} });
  });

  it("encodes ReceiveFixed direction as { receiveFixed: {} } for Anchor", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new OpenSwap(program);

    await useCase.execute({
      ...baseParams,
      direction: SwapDirection.ReceiveFixed,
    });

    const args = program.methods.openSwap.mock.calls[0];
    expect(args[0]).toEqual({ receiveFixed: {} });
  });

  it("passes notional/nonce/maxRateBps/minRateBps as positional args", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new OpenSwap(program);

    await useCase.execute({
      ...baseParams,
      direction: SwapDirection.PayFixed,
      notional: BigInt(50_000_000),
      nonce: 7,
      maxRateBps: BigInt(2_500),
      minRateBps: BigInt(100),
    });

    const args = program.methods.openSwap.mock.calls[0];
    expect(args[1].toString()).toBe("50000000");
    expect(args[2]).toBe(7);
    expect(args[3].toString()).toBe("2500");
    expect(args[4].toString()).toBe("100");
  });

  it("derives swapPosition PDA from market+trader+nonce", async () => {
    const { PdaDeriver } = await import(
      "../../../../infrastructure/pda/PdaDeriver"
    );
    const program = buildProgramMock(rpcMock);
    const useCase = new OpenSwap(program);

    await useCase.execute({
      ...baseParams,
      direction: SwapDirection.PayFixed,
      nonce: 42,
    });

    expect(PdaDeriver.swapPosition).toHaveBeenCalledWith(trader, market, 42);
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("paused protocol"));
    const program = buildProgramMock(rpcMock);
    const useCase = new OpenSwap(program);

    await expect(
      useCase.execute({ ...baseParams, direction: SwapDirection.PayFixed })
    ).rejects.toThrow("paused protocol");
  });
});
