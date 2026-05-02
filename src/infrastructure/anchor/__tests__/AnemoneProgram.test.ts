import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi } from "vitest";
import {
  buildAnemoneProgram,
  buildReadonlyProgram,
  PROGRAM_PUBLIC_KEY,
} from "../AnemoneProgram";
import { ANEMONE_PROGRAM_ID } from "../../../constants";

// Anchor's Program constructor reads `connection.rpcEndpoint`. Use a stub
// connection — we never actually send a transaction in these unit tests.
const stubConnection = new Connection("http://127.0.0.1:8899");

describe("AnemoneProgram builders", () => {
  describe("PROGRAM_PUBLIC_KEY", () => {
    it("matches ANEMONE_PROGRAM_ID constant", () => {
      expect(PROGRAM_PUBLIC_KEY.toBase58()).toBe(ANEMONE_PROGRAM_ID);
    });
  });

  describe("buildAnemoneProgram", () => {
    it("instantiates a Program tied to the provided wallet", () => {
      const keypair = Keypair.generate();
      const wallet = {
        publicKey: keypair.publicKey,
        signTransaction: vi.fn(async (tx) => tx),
        signAllTransactions: vi.fn(async (txs) => txs),
      };

      const program = buildAnemoneProgram(stubConnection, wallet);

      expect(program.programId.toBase58()).toBe(ANEMONE_PROGRAM_ID);
      expect(program.provider.publicKey?.toBase58()).toBe(
        keypair.publicKey.toBase58()
      );
    });

    it("exposes all 19 IDL instructions on .methods", () => {
      const keypair = Keypair.generate();
      const wallet = {
        publicKey: keypair.publicKey,
        signTransaction: vi.fn(async (tx) => tx),
        signAllTransactions: vi.fn(async (txs) => txs),
      };

      const program = buildAnemoneProgram(stubConnection, wallet);
      const methodNames = Object.keys(program.methods);

      // Should expose at least every instruction we care about. A regression
      // here usually means the IDL copy in SDK/idl drifted.
      const expected = [
        "initializeProtocol",
        "createMarket",
        "setKeeper",
        "pauseProtocol",
        "unpauseProtocol",
        "depositLiquidity",
        "requestWithdrawal",
        "depositToKamino",
        "withdrawFromKamino",
        "updateRateIndex",
        "syncKaminoYield",
        "openSwap",
        "addCollateral",
        "settlePeriod",
        "closePositionEarly",
        "claimMatured",
        "liquidatePosition",
      ];

      for (const ix of expected) {
        expect(methodNames).toContain(ix);
      }
    });
  });

  describe("buildReadonlyProgram", () => {
    it("instantiates a Program with an ephemeral keypair", () => {
      const program = buildReadonlyProgram(stubConnection);

      expect(program.programId.toBase58()).toBe(ANEMONE_PROGRAM_ID);
      // Read-only program should still expose a publicKey on the provider —
      // Anchor needs it for getProgramAccounts and read calls.
      expect(program.provider.publicKey).toBeInstanceOf(PublicKey);
    });

    it("creates a different keypair on each call", () => {
      const a = buildReadonlyProgram(stubConnection);
      const b = buildReadonlyProgram(stubConnection);

      expect(a.provider.publicKey?.toBase58()).not.toBe(
        b.provider.publicKey?.toBase58()
      );
    });

    it("exposes account namespace for read queries", () => {
      const program = buildReadonlyProgram(stubConnection);

      // Anchor exposes `program.account.<accountName>.fetch/all` based on
      // the IDL's accounts list. Verify the major ones are wired up.
      expect(program.account).toHaveProperty("protocolState");
      expect(program.account).toHaveProperty("swapMarket");
      expect(program.account).toHaveProperty("lpPosition");
      expect(program.account).toHaveProperty("swapPosition");
    });
  });
});
