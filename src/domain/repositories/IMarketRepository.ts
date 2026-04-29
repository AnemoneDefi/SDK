import { Market } from "../entities/Market";

export interface IMarketRepository {
  fetchByAddress(address: string): Promise<Market | null>;
  fetchAll(): Promise<Market[]>;
  fetchByReserveAndTenor(
    underlyingReserve: string,
    tenorSeconds: bigint
  ): Promise<Market | null>;
}
