import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { describe, it, expect, vi } from "vitest";
import { ProtocolRepository } from "../ProtocolRepository";

vi.mock("../../pda/PdaDeriver", () => {
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

const RAW_OK = {
  authority: new PublicKey("So11111111111111111111111111111111111111114"),
  keeperAuthority: new PublicKey("So11111111111111111111111111111111111111115"),
  treasury: new PublicKey("So11111111111111111111111111111111111111116"),
  totalMarkets: new BN(2),
  protocolFeeBps: 1000,
  openingFeeBps: 20,
  liquidationFeeBps: 300,
  withdrawalFeeBps: 5,
  earlyCloseFeeBps: 500,
  bump: 254,
  paused: false,
};

function buildProgramMock(fetchImpl: () => Promise<unknown>) {
  return {
    account: {
      protocolState: { fetch: vi.fn(fetchImpl) },
    },
  } as any;
}

describe("ProtocolRepository", () => {
  it("maps raw account → Protocol entity", async () => {
    const program = buildProgramMock(() => Promise.resolve(RAW_OK));
    const repo = new ProtocolRepository(program);

    const got = await repo.fetch();

    expect(got).not.toBeNull();
    expect(got!.publicKey).toBe("So11111111111111111111111111111111111111121");
    expect(got!.authority).toBe("So11111111111111111111111111111111111111114");
    expect(got!.keeperAuthority).toBe(
      "So11111111111111111111111111111111111111115"
    );
    expect(got!.treasury).toBe("So11111111111111111111111111111111111111116");
    expect(got!.totalMarkets).toBe(BigInt(2));
    expect(got!.protocolFeeBps).toBe(1000);
    expect(got!.paused).toBe(false);
    expect(got!.bump).toBe(254);
  });

  it("returns null when account does not exist", async () => {
    const program = buildProgramMock(() =>
      Promise.reject(new Error("Account does not exist"))
    );
    const repo = new ProtocolRepository(program);

    const got = await repo.fetch();

    expect(got).toBeNull();
  });

  it("propagates paused=true correctly", async () => {
    const program = buildProgramMock(() =>
      Promise.resolve({ ...RAW_OK, paused: true })
    );
    const repo = new ProtocolRepository(program);

    const got = await repo.fetch();

    expect(got!.paused).toBe(true);
  });

  it("converts BN totalMarkets to bigint", async () => {
    const program = buildProgramMock(() =>
      Promise.resolve({ ...RAW_OK, totalMarkets: new BN("99999999999") })
    );
    const repo = new ProtocolRepository(program);

    const got = await repo.fetch();

    expect(typeof got!.totalMarkets).toBe("bigint");
    expect(got!.totalMarkets).toBe(BigInt("99999999999"));
  });
});
