import { LpPosition } from "../entities/LpPosition";
import { SwapPosition } from "../entities/SwapPosition";

export interface IPositionRepository {
  fetchLpPosition(
    owner: string,
    market: string
  ): Promise<LpPosition | null>;
  fetchLpPositionsByOwner(owner: string): Promise<LpPosition[]>;
  fetchSwapPosition(address: string): Promise<SwapPosition | null>;
  fetchSwapPositionsByOwner(owner: string): Promise<SwapPosition[]>;
}
