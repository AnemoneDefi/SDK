/**
 * IDL conformance test — guards against drift between the on-chain program's
 * IDL and what the SDK use-cases actually send to `.accountsStrict()`.
 *
 * For each implemented use-case, this test:
 *   1. Builds a mock Anchor program that captures the accounts object passed
 *      to `.accountsStrict()`
 *   2. Runs the use-case with mock params (PDAs/SPL helpers stubbed)
 *   3. Compares the captured account keys to the IDL's expected account names
 *      (snake_case → camelCase)
 *
 * Coverage section also flags instructions in the IDL that have NO matching
 * use-case in the SDK — useful as a TODO list for incremental migration.
 */

import { PublicKey } from "@solana/web3.js";
import { describe, it, expect, vi, beforeEach } from "vitest";
import idl from "../../idl/anemone.json";

import { SwapDirection } from "../domain/enums";
import { CreateMarket } from "../application/use-cases/admin/CreateMarket";
import { InitializeProtocol } from "../application/use-cases/admin/InitializeProtocol";
import {
  PauseProtocol,
  UnpauseProtocol,
} from "../application/use-cases/admin/PauseProtocol";
import { SetKeeper } from "../application/use-cases/admin/SetKeeper";
import { SetRateIndexOracle } from "../application/use-cases/admin/SetRateIndexOracle";
import { DepositToKamino } from "../application/use-cases/keeper/DepositToKamino";
import { SyncKaminoYield } from "../application/use-cases/keeper/SyncKaminoYield";
import { UpdateRateIndex } from "../application/use-cases/keeper/UpdateRateIndex";
import { WithdrawFromKamino } from "../application/use-cases/keeper/WithdrawFromKamino";
import { DepositLiquidity } from "../application/use-cases/lp/DepositLiquidity";
import { RequestWithdrawal } from "../application/use-cases/lp/RequestWithdrawal";
import { AddCollateral } from "../application/use-cases/trader/AddCollateral";
import { ClaimMatured } from "../application/use-cases/trader/ClaimMatured";
import { ClosePositionEarly } from "../application/use-cases/trader/ClosePositionEarly";
import { LiquidatePosition } from "../application/use-cases/trader/LiquidatePosition";
import { OpenSwap } from "../application/use-cases/trader/OpenSwap";
import { SettlePeriod } from "../application/use-cases/trader/SettlePeriod";

// PDA mocks — every derived address resolves to a deterministic dummy PublicKey.
vi.mock("../infrastructure/pda/PdaDeriver", () => {
  const { PublicKey } = require("@solana/web3.js");
  const dummy = new PublicKey("So11111111111111111111111111111111111111112");
  const result = { address: dummy, bump: 254 };
  return {
    PdaDeriver: {
      protocol: vi.fn().mockResolvedValue(result),
      market: vi.fn().mockResolvedValue(result),
      lpVault: vi.fn().mockResolvedValue(result),
      collateralVault: vi.fn().mockResolvedValue(result),
      lpMint: vi.fn().mockResolvedValue(result),
      kaminoDepositAccount: vi.fn().mockResolvedValue(result),
      lpPosition: vi.fn().mockResolvedValue(result),
      swapPosition: vi.fn().mockResolvedValue(result),
    },
  };
});

vi.mock("@solana/spl-token", () => {
  const { PublicKey } = require("@solana/web3.js");
  const dummy = new PublicKey("So11111111111111111111111111111111111111113");
  return {
    TOKEN_PROGRAM_ID: new PublicKey(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    ),
    getAssociatedTokenAddressSync: vi.fn(() => dummy),
  };
});

// snake_case → camelCase: mirrors Anchor's TS client conversion.
const snakeToCamel = (s: string): string =>
  s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function expectedAccountsFor(instructionName: string): string[] {
  // instructionName is camelCase (TS client convention); IDL stores snake_case.
  const ix = idl.instructions.find(
    (i: any) => snakeToCamel(i.name) === instructionName
  );
  if (!ix) {
    throw new Error(`Instruction ${instructionName} not found in IDL`);
  }
  return ix.accounts.map((a: any) => snakeToCamel(a.name)).sort();
}

function buildProgramMock(instructionName: string) {
  const accountsStrictMock = vi.fn().mockReturnValue({
    rpc: vi.fn().mockResolvedValue("sig"),
  });
  const program = {
    methods: {
      [instructionName]: vi.fn().mockReturnValue({
        accountsStrict: accountsStrictMock,
      }),
    },
  } as any;
  return { program, accountsStrictMock };
}

const PK = (seed: string) => new PublicKey(seed);

const PK_AUTHORITY = PK("So11111111111111111111111111111111111111114");
const PK_TREASURY = PK("So11111111111111111111111111111111111111115");
const PK_OWNER = PK("So11111111111111111111111111111111111111114");
const PK_KEEPER = PK("So11111111111111111111111111111111111111114");
const PK_DEPOSITOR = PK("So11111111111111111111111111111111111111114");
const PK_MARKET = PK("So11111111111111111111111111111111111111112");
const PK_LP_VAULT = PK("So11111111111111111111111111111111111111117");
const PK_LP_MINT = PK("So11111111111111111111111111111111111111116");
const PK_UNDERLYING_MINT = PK("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const PK_UNDERLYING_RESERVE = PK("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59");
const PK_UNDERLYING_PROTOCOL = PK("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
const PK_KAMINO_RESERVE = PK("So11111111111111111111111111111111111111119");
const PK_KAMINO_LM = PK("So11111111111111111111111111111111111111121");
const PK_KAMINO_LM_AUTH = PK("So11111111111111111111111111111111111111122");
const PK_KAMINO_LIQ_SUPPLY = PK("So11111111111111111111111111111111111111123");
const PK_KAMINO_COL_MINT = PK("So11111111111111111111111111111111111111124");
const PK_TRADER = PK("So11111111111111111111111111111111111111114");
const PK_LIQUIDATOR = PK("So11111111111111111111111111111111111111125");
const PK_SWAP_POSITION = PK("So11111111111111111111111111111111111111126");
const PK_COLLATERAL_VAULT = PK("So11111111111111111111111111111111111111127");
const TOKEN_PROGRAM = PK("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const KAMINO_BLOCK = {
  kaminoReserve: PK_KAMINO_RESERVE,
  kaminoLendingMarket: PK_KAMINO_LM,
  kaminoLendingMarketAuthority: PK_KAMINO_LM_AUTH,
  reserveLiquidityMint: PK_UNDERLYING_MINT,
  reserveLiquiditySupply: PK_KAMINO_LIQ_SUPPLY,
  reserveCollateralMint: PK_KAMINO_COL_MINT,
  collateralTokenProgram: TOKEN_PROGRAM,
  liquidityTokenProgram: TOKEN_PROGRAM,
};

type CaseSpec = {
  instructionName: string;
  run: (program: any) => Promise<unknown>;
};

const IMPLEMENTED_CASES: CaseSpec[] = [
  {
    instructionName: "initializeProtocol",
    run: (program) =>
      new InitializeProtocol(program).execute({
        authority: PK_AUTHORITY,
        treasury: PK_TREASURY,
      }),
  },
  {
    instructionName: "createMarket",
    run: (program) =>
      new CreateMarket(program).execute({
        authority: PK_AUTHORITY,
        underlyingReserve: PK_UNDERLYING_RESERVE,
        underlyingProtocol: PK_UNDERLYING_PROTOCOL,
        underlyingMint: PK_UNDERLYING_MINT,
        kaminoCollateralMint: PK_KAMINO_COL_MINT,
      }),
  },
  {
    instructionName: "depositLiquidity",
    run: (program) =>
      new DepositLiquidity(program).execute({
        depositor: PK_DEPOSITOR,
        market: PK_MARKET,
        underlyingMint: PK_UNDERLYING_MINT,
        lpMint: PK_LP_MINT,
        lpVault: PK_LP_VAULT,
        amount: 1_000_000n,
      }),
  },
  {
    instructionName: "requestWithdrawal",
    run: (program) =>
      new RequestWithdrawal(program).execute({
        withdrawer: PK_OWNER,
        market: PK_MARKET,
        underlyingMint: PK_UNDERLYING_MINT,
        lpMint: PK_LP_MINT,
        lpVault: PK_LP_VAULT,
        treasury: PK_TREASURY,
        sharesToBurn: 100_000n,
        kaminoReserve: PK_KAMINO_RESERVE,
        kaminoLendingMarket: PK_KAMINO_LM,
        kaminoLendingMarketAuthority: PK_KAMINO_LM_AUTH,
        reserveLiquidityMint: PK_UNDERLYING_MINT,
        reserveLiquiditySupply: PK_KAMINO_LIQ_SUPPLY,
        reserveCollateralMint: PK_KAMINO_COL_MINT,
        collateralTokenProgram: PK("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        liquidityTokenProgram: PK("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      }),
  },
  {
    instructionName: "updateRateIndex",
    run: (program) =>
      new UpdateRateIndex(program).execute({
        keeper: PK_KEEPER,
        underlyingReserve: PK_UNDERLYING_RESERVE,
        tenorSeconds: 2_592_000n,
        kaminoReserve: PK_KAMINO_RESERVE,
      }),
  },
  {
    instructionName: "depositToKamino",
    run: (program) =>
      new DepositToKamino(program).execute({
        keeper: PK_KEEPER,
        underlyingReserve: PK_UNDERLYING_RESERVE,
        tenorSeconds: 2_592_000n,
        kaminoReserve: PK_KAMINO_RESERVE,
        kaminoLendingMarket: PK_KAMINO_LM,
        kaminoLendingMarketAuthority: PK_KAMINO_LM_AUTH,
        reserveLiquidityMint: PK_UNDERLYING_MINT,
        reserveLiquiditySupply: PK_KAMINO_LIQ_SUPPLY,
        reserveCollateralMint: PK_KAMINO_COL_MINT,
        collateralTokenProgram: PK("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        liquidityTokenProgram: PK("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        amount: 1_000_000n,
      }),
  },
  {
    instructionName: "setKeeper",
    run: (program) =>
      new SetKeeper(program).execute({
        authority: PK_AUTHORITY,
        newKeeper: PK_KEEPER,
      }),
  },
  {
    instructionName: "setRateIndexOracle",
    run: (program) =>
      new SetRateIndexOracle(program).execute({
        authority: PK_AUTHORITY,
        market: PK_MARKET,
        rateIndex: 1_000_000_000n,
      }),
  },
  {
    instructionName: "pauseProtocol",
    run: (program) =>
      new PauseProtocol(program).execute({ authority: PK_AUTHORITY }),
  },
  {
    instructionName: "unpauseProtocol",
    run: (program) =>
      new UnpauseProtocol(program).execute({ authority: PK_AUTHORITY }),
  },
  {
    instructionName: "syncKaminoYield",
    run: (program) =>
      new SyncKaminoYield(program).execute({
        underlyingReserve: PK_UNDERLYING_RESERVE,
        tenorSeconds: 2_592_000n,
        kaminoReserve: PK_KAMINO_RESERVE,
        kaminoLendingMarket: PK_KAMINO_LM,
        pythOracle: PublicKey.default,
        switchboardPriceOracle: PublicKey.default,
        switchboardTwapOracle: PublicKey.default,
        scopePrices: PublicKey.default,
      }),
  },
  {
    instructionName: "withdrawFromKamino",
    run: (program) =>
      new WithdrawFromKamino(program).execute({
        keeper: PK_KEEPER,
        underlyingReserve: PK_UNDERLYING_RESERVE,
        tenorSeconds: 2_592_000n,
        ...KAMINO_BLOCK,
        collateralAmount: 1_000_000n,
      }),
  },
  {
    instructionName: "openSwap",
    run: (program) =>
      new OpenSwap(program).execute({
        trader: PK_TRADER,
        market: PK_MARKET,
        underlyingMint: PK_UNDERLYING_MINT,
        treasury: PK_TREASURY,
        collateralVault: PK_COLLATERAL_VAULT,
        direction: SwapDirection.PayFixed,
        notional: 10_000_000n,
        nonce: 0,
        maxRateBps: 1_000n,
        minRateBps: 0n,
      }),
  },
  {
    instructionName: "addCollateral",
    run: (program) =>
      new AddCollateral(program).execute({
        owner: PK_TRADER,
        market: PK_MARKET,
        underlyingMint: PK_UNDERLYING_MINT,
        collateralVault: PK_COLLATERAL_VAULT,
        nonce: 0,
        amount: 500_000n,
      }),
  },
  {
    instructionName: "settlePeriod",
    run: (program) =>
      new SettlePeriod(program).execute({
        caller: PK_KEEPER,
        market: PK_MARKET,
        swapPosition: PK_SWAP_POSITION,
        underlyingMint: PK_UNDERLYING_MINT,
        lpVault: PK_LP_VAULT,
        collateralVault: PK_COLLATERAL_VAULT,
      }),
  },
  {
    instructionName: "closePositionEarly",
    run: (program) =>
      new ClosePositionEarly(program).execute({
        owner: PK_TRADER,
        market: PK_MARKET,
        swapPosition: PK_SWAP_POSITION,
        underlyingMint: PK_UNDERLYING_MINT,
        lpVault: PK_LP_VAULT,
        collateralVault: PK_COLLATERAL_VAULT,
        treasury: PK_TREASURY,
        ...KAMINO_BLOCK,
      }),
  },
  {
    instructionName: "claimMatured",
    run: (program) =>
      new ClaimMatured(program).execute({
        owner: PK_TRADER,
        market: PK_MARKET,
        swapPosition: PK_SWAP_POSITION,
        underlyingMint: PK_UNDERLYING_MINT,
        lpVault: PK_LP_VAULT,
        collateralVault: PK_COLLATERAL_VAULT,
        ...KAMINO_BLOCK,
      }),
  },
  {
    instructionName: "liquidatePosition",
    run: (program) =>
      new LiquidatePosition(program).execute({
        liquidator: PK_LIQUIDATOR,
        owner: PK_TRADER,
        market: PK_MARKET,
        swapPosition: PK_SWAP_POSITION,
        underlyingMint: PK_UNDERLYING_MINT,
        lpVault: PK_LP_VAULT,
        collateralVault: PK_COLLATERAL_VAULT,
        treasury: PK_TREASURY,
        ...KAMINO_BLOCK,
      }),
  },
];

describe("IDL conformance — coverage", () => {
  it("every IDL instruction is either implemented or explicitly tracked", () => {
    const idlInstructions = idl.instructions
      .map((i: any) => snakeToCamel(i.name))
      .sort();

    const implementedNames = IMPLEMENTED_CASES.map((c) => c.instructionName);

    const missing = idlInstructions.filter(
      (n: string) => !implementedNames.includes(n)
    );

    // These instructions are TRACKED but not yet implemented (Phase 4 of the
    // refactor plan). Update this list as use-cases land.
    // pauseMarket / unpauseMarket exist in the program but aren't yet wrapped
    // by the SDK. Per-market pause is operational tooling; protocol-wide
    // pauseProtocol covers the killswitch case for now.
    const TRACKED_MISSING: string[] = ["pauseMarket", "unpauseMarket"];

    expect(missing.sort()).toEqual(TRACKED_MISSING);
  });
});

describe("IDL conformance — accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  IMPLEMENTED_CASES.forEach(({ instructionName, run }) => {
    it(`${instructionName} sends the exact accounts the IDL declares`, async () => {
      const { program, accountsStrictMock } = buildProgramMock(instructionName);
      await run(program);

      expect(accountsStrictMock).toHaveBeenCalledTimes(1);
      const sentAccounts = Object.keys(
        accountsStrictMock.mock.calls[0][0]
      ).sort();
      const expected = expectedAccountsFor(instructionName);

      const missing = expected.filter((a) => !sentAccounts.includes(a));
      const extra = sentAccounts.filter((a) => !expected.includes(a));

      // Custom failure message lists the diff explicitly so the test output
      // is actionable — paste this into the use-case to fix.
      if (missing.length || extra.length) {
        const msg = [
          `Account mismatch for ${instructionName}:`,
          missing.length ? `  MISSING (in IDL, not sent): ${missing.join(", ")}` : "",
          extra.length ? `  EXTRA (sent but not in IDL): ${extra.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        throw new Error(msg);
      }

      expect(sentAccounts).toEqual(expected);
    });
  });
});
