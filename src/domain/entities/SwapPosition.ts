import { PositionStatus, SwapDirection } from "../enums";

/** Phase 2 — not yet deployed on-chain but typed for SDK completeness */
export interface SwapPosition {
  publicKey: string;
  owner: string;
  market: string;
  direction: SwapDirection;
  notional: bigint;
  fixedRateBps: bigint;
  leverage: number;
  collateralDeposited: bigint;
  collateralRemaining: bigint;
  entryRateIndex: bigint;
  lastSettledRateIndex: bigint;
  realizedPnl: bigint;
  numSettlements: number;
  openTimestamp: bigint;
  maturityTimestamp: bigint;
  nextSettlementTs: bigint;
  lastSettlementTs: bigint;
  status: PositionStatus;
  nonce: number;
  bump: number;
}
