import { LpStatus } from "../enums";

export interface LpPosition {
  publicKey: string;
  isInitialized: boolean;
  owner: string;
  market: string;
  shares: bigint;
  depositedAmount: bigint;
  status: LpStatus;
  bump: number;
}
