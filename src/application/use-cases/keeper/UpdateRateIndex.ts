import { Program } from "@coral-xyz/anchor";
import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface UpdateRateIndexParams {
  underlyingReserve: PublicKey;
  tenorSeconds: bigint;
  kaminoReserve: PublicKey;
}

export interface UpdateRateIndexResult {
  signature: TransactionSignature;
}

export class UpdateRateIndex {
  constructor(private readonly program: Program) {}

  async execute(
    params: UpdateRateIndexParams
  ): Promise<UpdateRateIndexResult> {
    const { underlyingReserve, tenorSeconds, kaminoReserve } = params;

    const { address: market } = await PdaDeriver.market(
      underlyingReserve,
      tenorSeconds
    );

    const signature = await (this.program.methods as any)
      .updateRateIndex()
      .accountsStrict({
        market,
        kaminoReserve,
      })
      .rpc();

    return { signature };
  }
}
