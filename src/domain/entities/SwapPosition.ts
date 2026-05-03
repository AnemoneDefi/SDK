import { PositionStatus, SwapDirection } from "../enums";

export interface SwapPosition {
  publicKey: string;
  owner: string;
  market: string;
  direction: SwapDirection;
  notional: bigint;
  fixedRateBps: bigint;
  /** Spread bps charged at open — needed to compute the protocol fee skim on each settle. */
  spreadBpsAtOpen: bigint;
  collateralDeposited: bigint;
  collateralRemaining: bigint;
  entryRateIndex: bigint;
  lastSettledRateIndex: bigint;
  realizedPnl: bigint;
  numSettlements: number;
  /** Trader PnL credit the lp_vault could not cover at settle/close/liquidation. */
  unpaidPnl: bigint;
  openTimestamp: bigint;
  maturityTimestamp: bigint;
  nextSettlementTs: bigint;
  lastSettlementTs: bigint;
  status: PositionStatus;
  nonce: number;
  bump: number;
}
