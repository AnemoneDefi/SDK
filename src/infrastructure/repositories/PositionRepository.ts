import type { AnemoneProgram } from "../anchor/AnemoneProgram";
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
    status: decodeLpStatus(raw.status),
    bump: raw.bump,
  };
}

function decodeSwapDirection(raw: any): SwapDirection {
  // Anchor encodes Rust enums as `{ variantName: {} }`. Some legacy paths
  // already supply the numeric enum directly — accept both.
  if (typeof raw === "number") return raw as SwapDirection;
  if (raw && typeof raw === "object") {
    if ("payFixed" in raw) return SwapDirection.PayFixed;
    if ("receiveFixed" in raw) return SwapDirection.ReceiveFixed;
  }
  throw new Error(`Unknown SwapDirection encoding: ${JSON.stringify(raw)}`);
}

function decodePositionStatus(raw: any): PositionStatus {
  if (typeof raw === "number") return raw as PositionStatus;
  if (raw && typeof raw === "object") {
    if ("open" in raw) return PositionStatus.Open;
    if ("matured" in raw) return PositionStatus.Matured;
    if ("liquidated" in raw) return PositionStatus.Liquidated;
    if ("closedEarly" in raw) return PositionStatus.ClosedEarly;
  }
  throw new Error(`Unknown PositionStatus encoding: ${JSON.stringify(raw)}`);
}

function decodeLpStatus(raw: any): LpStatus {
  if (typeof raw === "number") return raw as LpStatus;
  if (raw && typeof raw === "object") {
    if ("active" in raw) return LpStatus.Active;
    if ("withdrawn" in raw) return LpStatus.Withdrawn;
  }
  throw new Error(`Unknown LpStatus encoding: ${JSON.stringify(raw)}`);
}

function rawToSwapPosition(address: PublicKey, raw: any): SwapPosition {
  return {
    publicKey: address.toBase58(),
    owner: raw.owner.toBase58(),
    market: raw.market.toBase58(),
    direction: decodeSwapDirection(raw.direction),
    notional: BigInt(raw.notional.toString()),
    fixedRateBps: BigInt(raw.fixedRateBps.toString()),
    spreadBpsAtOpen: BigInt(raw.spreadBpsAtOpen.toString()),
    collateralDeposited: BigInt(raw.collateralDeposited.toString()),
    collateralRemaining: BigInt(raw.collateralRemaining.toString()),
    entryRateIndex: BigInt(raw.entryRateIndex.toString()),
    lastSettledRateIndex: BigInt(raw.lastSettledRateIndex.toString()),
    realizedPnl: BigInt(raw.realizedPnl.toString()),
    numSettlements: raw.numSettlements,
    unpaidPnl: BigInt(raw.unpaidPnl.toString()),
    openTimestamp: BigInt(raw.openTimestamp.toString()),
    maturityTimestamp: BigInt(raw.maturityTimestamp.toString()),
    nextSettlementTs: BigInt(raw.nextSettlementTs.toString()),
    lastSettlementTs: BigInt(raw.lastSettlementTs.toString()),
    status: decodePositionStatus(raw.status),
    nonce: raw.nonce,
    bump: raw.bump,
  };
}

export class PositionRepository implements IPositionRepository {
  constructor(private readonly program: AnemoneProgram) {}

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
