import { PublicKey } from "@solana/web3.js";
import { Market } from "../../domain/entities/Market";
import { MarketStatus } from "../../domain/enums";
import { IMarketRepository } from "../../domain/repositories/IMarketRepository";
import {
  PROGRAM_PUBLIC_KEY,
  type AnemoneProgram,
} from "../anchor/AnemoneProgram";
import { PdaDeriver } from "../pda/PdaDeriver";

function rawToMarket(address: PublicKey, raw: any): Market {
  return {
    publicKey: address.toBase58(),
    protocolState: raw.protocolState.toBase58(),
    underlyingProtocol: raw.underlyingProtocol.toBase58(),
    underlyingReserve: raw.underlyingReserve.toBase58(),
    underlyingMint: raw.underlyingMint.toBase58(),
    lpVault: raw.lpVault.toBase58(),
    kaminoDepositAccount: raw.kaminoDepositAccount.toBase58(),
    collateralVault: raw.collateralVault.toBase58(),
    lpMint: raw.lpMint.toBase58(),
    tenorSeconds: BigInt(raw.tenorSeconds.toString()),
    settlementPeriodSeconds: BigInt(raw.settlementPeriodSeconds.toString()),
    maxUtilizationBps: raw.maxUtilizationBps,
    baseSpreadBps: raw.baseSpreadBps,
    lpNav: BigInt(raw.lpNav.toString()),
    totalLpShares: BigInt(raw.totalLpShares.toString()),
    totalFixedNotional: BigInt(raw.totalFixedNotional.toString()),
    totalVariableNotional: BigInt(raw.totalVariableNotional.toString()),
    previousRateIndex: BigInt(raw.previousRateIndex.toString()),
    previousRateUpdateTs: BigInt(raw.previousRateUpdateTs.toString()),
    currentRateIndex: BigInt(raw.currentRateIndex.toString()),
    lastRateUpdateTs: BigInt(raw.lastRateUpdateTs.toString()),
    totalOpenPositions: BigInt(raw.totalOpenPositions.toString()),
    totalKaminoCollateral: BigInt(raw.totalKaminoCollateral.toString()),
    lastKaminoSnapshotUsdc: BigInt(raw.lastKaminoSnapshotUsdc.toString()),
    lastKaminoSyncTs: BigInt(raw.lastKaminoSyncTs.toString()),
    status: raw.status as MarketStatus,
    bump: raw.bump,
  };
}

export class MarketRepository implements IMarketRepository {
  constructor(private readonly program: AnemoneProgram) {}

  async fetchByAddress(address: string): Promise<Market | null> {
    try {
      const pk = new PublicKey(address);
      const raw = await (this.program.account as any).swapMarket.fetch(pk);
      return rawToMarket(pk, raw);
    } catch {
      return null;
    }
  }

  async fetchAll(): Promise<Market[]> {
    const accounts = await (
      this.program.account as any
    ).swapMarket.all();
    return accounts.map(({ publicKey, account }: any) =>
      rawToMarket(publicKey, account)
    );
  }

  async fetchByReserveAndTenor(
    underlyingReserve: string,
    tenorSeconds: bigint
  ): Promise<Market | null> {
    const { address } = await PdaDeriver.market(
      new PublicKey(underlyingReserve),
      tenorSeconds
    );
    return this.fetchByAddress(address.toBase58());
  }
}
