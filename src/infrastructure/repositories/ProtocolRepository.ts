import type { AnemoneProgram } from "../anchor/AnemoneProgram";
import { Protocol } from "../../domain/entities/Protocol";
import { IProtocolRepository } from "../../domain/repositories/IProtocolRepository";
import { PdaDeriver } from "../pda/PdaDeriver";

export class ProtocolRepository implements IProtocolRepository {
  constructor(private readonly program: AnemoneProgram) {}

  async fetch(): Promise<Protocol | null> {
    const { address } = await PdaDeriver.protocol();
    try {
      const raw = await (this.program.account as any).protocolState.fetch(
        address
      );
      return {
        publicKey: address.toBase58(),
        authority: raw.authority.toBase58(),
        keeperAuthority: raw.keeperAuthority.toBase58(),
        treasury: raw.treasury.toBase58(),
        totalMarkets: BigInt(raw.totalMarkets.toString()),
        protocolFeeBps: raw.protocolFeeBps,
        openingFeeBps: raw.openingFeeBps,
        liquidationFeeBps: raw.liquidationFeeBps,
        withdrawalFeeBps: raw.withdrawalFeeBps,
        earlyCloseFeeBps: raw.earlyCloseFeeBps,
        bump: raw.bump,
        paused: raw.paused,
      };
    } catch {
      return null;
    }
  }
}
