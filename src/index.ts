// Main class — must be instantiated
export { Anemone } from "./Anemone";
export type { AnemoneConfig } from "./Anemone";
export type { AnchorWallet } from "./infrastructure/anchor/AnemoneProgram";

// Constants — importable without instantiation
export * from "./constants";

// Domain types
export type { Protocol } from "./domain/entities/Protocol";
export type { Market } from "./domain/entities/Market";
export type { LpPosition } from "./domain/entities/LpPosition";
export type { SwapPosition } from "./domain/entities/SwapPosition";
export { SwapDirection, LpStatus, PositionStatus, MarketStatus } from "./domain/enums";

// Use-case param/result types
export type {
  InitializeProtocolParams,
  InitializeProtocolResult,
} from "./application/use-cases/admin/InitializeProtocol";
export type {
  CreateMarketParams,
  CreateMarketResult,
} from "./application/use-cases/admin/CreateMarket";
export type {
  DepositLiquidityParams,
  DepositLiquidityResult,
} from "./application/use-cases/lp/DepositLiquidity";
export type {
  RequestWithdrawalParams,
  RequestWithdrawalResult,
} from "./application/use-cases/lp/RequestWithdrawal";
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

// PDA utilities
export { PdaDeriver } from "./infrastructure/pda/PdaDeriver";
export type { DerivedPda } from "./infrastructure/pda/PdaDeriver";
