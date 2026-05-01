// Main class — must be instantiated
export { Anemone } from "./Anemone";
export type { AnemoneConfig } from "./Anemone";
export type {
  AnchorWallet,
  AnemoneProgram,
} from "./infrastructure/anchor/AnemoneProgram";

// Anchor IDL type — for advanced consumers building custom transactions
export type { Anemone as AnemoneIdl } from "./idl/anemone";

// Constants — importable without instantiation
export * from "./constants";

// Domain types
export type { Protocol } from "./domain/entities/Protocol";
export type { Market } from "./domain/entities/Market";
export type { LpPosition } from "./domain/entities/LpPosition";
export type { SwapPosition } from "./domain/entities/SwapPosition";
export {
  SwapDirection,
  LpStatus,
  PositionStatus,
  MarketStatus,
} from "./domain/enums";

// Admin use-case types
export type {
  InitializeProtocolParams,
  InitializeProtocolResult,
} from "./application/use-cases/admin/InitializeProtocol";
export type {
  CreateMarketParams,
  CreateMarketResult,
} from "./application/use-cases/admin/CreateMarket";
export type {
  SetKeeperParams,
  SetKeeperResult,
} from "./application/use-cases/admin/SetKeeper";
export type {
  PauseProtocolParams,
  PauseProtocolResult,
} from "./application/use-cases/admin/PauseProtocol";

// LP use-case types
export type {
  DepositLiquidityParams,
  DepositLiquidityResult,
} from "./application/use-cases/lp/DepositLiquidity";
export type {
  RequestWithdrawalParams,
  RequestWithdrawalResult,
} from "./application/use-cases/lp/RequestWithdrawal";

// Keeper use-case types
export type {
  UpdateRateIndexParams,
  UpdateRateIndexResult,
} from "./application/use-cases/keeper/UpdateRateIndex";
export type {
  DepositToKaminoParams,
  DepositToKaminoResult,
} from "./application/use-cases/keeper/DepositToKamino";
export type {
  WithdrawFromKaminoParams,
  WithdrawFromKaminoResult,
} from "./application/use-cases/keeper/WithdrawFromKamino";
export type {
  SyncKaminoYieldParams,
  SyncKaminoYieldResult,
} from "./application/use-cases/keeper/SyncKaminoYield";

// Trader use-case types
export type {
  OpenSwapParams,
  OpenSwapResult,
} from "./application/use-cases/trader/OpenSwap";
export type {
  AddCollateralParams,
  AddCollateralResult,
} from "./application/use-cases/trader/AddCollateral";
export type {
  SettlePeriodParams,
  SettlePeriodResult,
} from "./application/use-cases/trader/SettlePeriod";
export type {
  ClosePositionEarlyParams,
  ClosePositionEarlyResult,
} from "./application/use-cases/trader/ClosePositionEarly";
export type {
  ClaimMaturedParams,
  ClaimMaturedResult,
} from "./application/use-cases/trader/ClaimMatured";
export type {
  LiquidatePositionParams,
  LiquidatePositionResult,
} from "./application/use-cases/trader/LiquidatePosition";

// PDA utilities
export { PdaDeriver } from "./infrastructure/pda/PdaDeriver";
export type { DerivedPda } from "./infrastructure/pda/PdaDeriver";
