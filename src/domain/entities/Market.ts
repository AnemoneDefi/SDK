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
  /** Net asset value of the LP pool in underlying-token decimals. */
  lpNav: bigint;
  totalLpShares: bigint;
  totalFixedNotional: bigint;
  totalVariableNotional: bigint;
  previousRateIndex: bigint;
  previousRateUpdateTs: bigint;
  currentRateIndex: bigint;
  lastRateUpdateTs: bigint;
  totalOpenPositions: bigint;
  totalKaminoCollateral: bigint;
  /** Last known USDC value of the k-tokens in `kaminoDepositAccount`. */
  lastKaminoSnapshotUsdc: bigint;
  /** Unix timestamp of the most recent `sync_kamino_yield` call. */
  lastKaminoSyncTs: bigint;
  status: MarketStatus;
  bump: number;
}
