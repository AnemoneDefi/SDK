import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface SetKeeperParams {
  authority: PublicKey;
  newKeeper: PublicKey;
}

export interface SetKeeperResult {
  signature: TransactionSignature;
}

export class SetKeeper {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: SetKeeperParams): Promise<SetKeeperResult> {
    const { authority, newKeeper } = params;
    const { address: protocolState } = await PdaDeriver.protocol();

    const signature = await this.program.methods
      .setKeeper(newKeeper)
      .accountsStrict({
        protocolState,
        authority,
      })
      .rpc();

    return { signature };
  }
}
