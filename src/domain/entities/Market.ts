import { MarketStatus } from "../enums";

export interface Market {
  publicKey: string;
  protocolState: string;
  underlyingProtocol: string;
  underlyingReserve: string;
  underlyingMint: string;
  lpVault: string;
  kaminoDepositAccount: string;
  collateralVault: string;
  lpMint: string;
  tenorSeconds: bigint;
  settlementPeriodSeconds: bigint;
  maxUtilizationBps: number;
  baseSpreadBps: number;
  maxLeverage: number;
  totalLpDeposits: bigint;
  totalLpShares: bigint;
  totalFixedNotional: bigint;
  totalVariableNotional: bigint;
  pendingWithdrawals: bigint;
  currentRateIndex: bigint;
  lastRateUpdateTs: bigint;
  cumulativeFeesEarned: bigint;
  totalOpenPositions: bigint;
  status: MarketStatus;
  bump: number;
}
