import { Protocol } from "../entities/Protocol";

export interface IProtocolRepository {
  fetch(): Promise<Protocol | null>;
}
