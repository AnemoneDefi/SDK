import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InitializeProtocol } from "../InitializeProtocol";
import {
  DEFAULT_EARLY_CLOSE_FEE_BPS,
  DEFAULT_LIQUIDATION_FEE_BPS,
  DEFAULT_OPENING_FEE_BPS,
  DEFAULT_PROTOCOL_FEE_BPS,
  DEFAULT_WITHDRAWAL_FEE_BPS,
} from "../../../../constants";

vi.mock("../../../../infrastructure/pda/PdaDeriver", () => ({
  PdaDeriver: {
    protocol: vi.fn().mockResolvedValue({
      address: new PublicKey("11111111111111111111111111111112"),
      bump: 254,
    }),
  },
}));

function buildProgramMock(rpcFn: ReturnType<typeof vi.fn>) {
  return {
    methods: {
      initializeProtocol: vi.fn().mockReturnValue({
        accountsStrict: vi.fn().mockReturnValue({
          rpc: rpcFn,
        }),
      }),
    },
  } as any;
}

describe("InitializeProtocol", () => {
  const authority = new PublicKey("So11111111111111111111111111111111111111112");
  const treasury = new PublicKey("So11111111111111111111111111111111111111113");
  const expectedSig = "5xABCsig";

  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn().mockResolvedValue(expectedSig);
  });

  it("calls initializeProtocol with default fees", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new InitializeProtocol(program);

    const result = await useCase.execute({ authority, treasury });

    expect(result.signature).toBe(expectedSig);
    expect(result.protocolStateAddress).toBe(
      "11111111111111111111111111111112"
    );

    const methodCall = program.methods.initializeProtocol.mock.calls[0];
    expect(methodCall).toEqual([
      DEFAULT_PROTOCOL_FEE_BPS,
      DEFAULT_OPENING_FEE_BPS,
      DEFAULT_LIQUIDATION_FEE_BPS,
      DEFAULT_WITHDRAWAL_FEE_BPS,
      DEFAULT_EARLY_CLOSE_FEE_BPS,
    ]);
  });

  it("calls initializeProtocol with custom fees", async () => {
    const program = buildProgramMock(rpcMock);
    const useCase = new InitializeProtocol(program);

    await useCase.execute({
      authority,
      treasury,
      protocolFeeBps: 500,
      openingFeeBps: 10,
      liquidationFeeBps: 200,
      withdrawalFeeBps: 3,
      earlyCloseFeeBps: 300,
    });

    const methodCall = program.methods.initializeProtocol.mock.calls[0];
    expect(methodCall).toEqual([500, 10, 200, 3, 300]);
  });

  it("propagates RPC errors", async () => {
    rpcMock = vi.fn().mockRejectedValue(new Error("RPC failure"));
    const program = buildProgramMock(rpcMock);
    const useCase = new InitializeProtocol(program);

    await expect(useCase.execute({ authority, treasury })).rejects.toThrow(
      "RPC failure"
    );
  });
});
