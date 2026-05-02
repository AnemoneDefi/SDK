import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface PauseProtocolParams {
  authority: PublicKey;
}

export interface PauseProtocolResult {
  signature: TransactionSignature;
}

export class PauseProtocol {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: PauseProtocolParams): Promise<PauseProtocolResult> {
    const { authority } = params;
    const { address: protocolState } = await PdaDeriver.protocol();

    const signature = await this.program.methods
      .pauseProtocol()
      .accountsStrict({
        protocolState,
        authority,
      })
      .rpc();

    return { signature };
  }
}

export class UnpauseProtocol {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: PauseProtocolParams): Promise<PauseProtocolResult> {
    const { authority } = params;
    const { address: protocolState } = await PdaDeriver.protocol();

    const signature = await this.program.methods
      .unpauseProtocol()
      .accountsStrict({
        protocolState,
        authority,
      })
      .rpc();

    return { signature };
  }
}
