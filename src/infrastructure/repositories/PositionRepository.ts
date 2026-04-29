import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { LpPosition } from "../../domain/entities/LpPosition";
import { SwapPosition } from "../../domain/entities/SwapPosition";
import { LpStatus, PositionStatus, SwapDirection } from "../../domain/enums";
import { IPositionRepository } from "../../domain/repositories/IPositionRepository";
import { PdaDeriver } from "../pda/PdaDeriver";

function rawToLpPosition(address: PublicKey, raw: any): LpPosition {
  return {
    publicKey: address.toBase58(),
    isInitialized: raw.isInitialized,
    owner: raw.owner.toBase58(),
    market: raw.market.toBase58(),
    shares: BigInt(raw.shares.toString()),
    depositedAmount: BigInt(raw.depositedAmount.toString()),
    status: raw.status as LpStatus,
    withdrawalRequestedAt: BigInt(raw.withdrawalRequestedAt.toString()),
    withdrawalAmount: BigInt(raw.withdrawalAmount.toString()),
    bump: raw.bump,
  };
}

function rawToSwapPosition(address: PublicKey, raw: any): SwapPosition {
  return {
    publicKey: address.toBase58(),
    owner: raw.owner.toBase58(),
    market: raw.market.toBase58(),
    direction: raw.direction as SwapDirection,
    notional: BigInt(raw.notional.toString()),
    fixedRateBps: BigInt(raw.fixedRateBps.toString()),
    leverage: raw.leverage,
    collateralDeposited: BigInt(raw.collateralDeposited.toString()),
    collateralRemaining: BigInt(raw.collateralRemaining.toString()),
    entryRateIndex: BigInt(raw.entryRateIndex.toString()),
    lastSettledRateIndex: BigInt(raw.lastSettledRateIndex.toString()),
    realizedPnl: BigInt(raw.realizedPnl.toString()),
    numSettlements: raw.numSettlements,
    openTimestamp: BigInt(raw.openTimestamp.toString()),
    maturityTimestamp: BigInt(raw.maturityTimestamp.toString()),
    nextSettlementTs: BigInt(raw.nextSettlementTs.toString()),
    lastSettlementTs: BigInt(raw.lastSettlementTs.toString()),
    status: raw.status as PositionStatus,
    nonce: raw.nonce,
    bump: raw.bump,
  };
}

export class PositionRepository implements IPositionRepository {
  constructor(private readonly program: Program) {}

  async fetchLpPosition(
    owner: string,
    market: string
  ): Promise<LpPosition | null> {
    const { address } = await PdaDeriver.lpPosition(
      new PublicKey(owner),
      new PublicKey(market)
    );
    try {
      const raw = await (this.program.account as any).lpPosition.fetch(address);
      return rawToLpPosition(address, raw);
    } catch {
      return null;
    }
  }

  async fetchLpPositionsByOwner(owner: string): Promise<LpPosition[]> {
    const ownerPk = new PublicKey(owner);
    const accounts = await (this.program.account as any).lpPosition.all([
      {
        memcmp: {
          offset: 9, // discriminator(8) + is_initialized(1)
          bytes: ownerPk.toBase58(),
        },
      },
    ]);
    return accounts.map(({ publicKey, account }: any) =>
      rawToLpPosition(publicKey, account)
    );
  }

  async fetchSwapPosition(address: string): Promise<SwapPosition | null> {
    try {
      const pk = new PublicKey(address);
      const raw = await (this.program.account as any).swapPosition.fetch(pk);
      return rawToSwapPosition(pk, raw);
    } catch {
      return null;
    }
  }

  async fetchSwapPositionsByOwner(owner: string): Promise<SwapPosition[]> {
    const ownerPk = new PublicKey(owner);
    const accounts = await (this.program.account as any).swapPosition.all([
      {
        memcmp: {
          offset: 8, // after discriminator
          bytes: ownerPk.toBase58(),
        },
      },
    ]);
    return accounts.map(({ publicKey, account }: any) =>
      rawToSwapPosition(publicKey, account)
    );
  }
}
