import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import {
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface UpdateRateIndexParams {
  keeper: PublicKey;
  underlyingReserve: PublicKey;
  tenorSeconds: bigint;
  kaminoReserve: PublicKey;
  /**
   * Instructions bundled BEFORE updateRateIndex in the same atomic tx.
   * Typical use: a Kamino `refresh_reserve` so `cumulative_borrow_rate_bsf`
   * is fresh — without this, the program reverts with `InvalidRateIndex`
   * because the rate didn't move since the previous update.
   */
  preInstructions?: TransactionInstruction[];
}

export interface UpdateRateIndexResult {
  signature: TransactionSignature;
}

export class UpdateRateIndex {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: UpdateRateIndexParams
  ): Promise<UpdateRateIndexResult> {
    const {
      keeper,
      underlyingReserve,
      tenorSeconds,
      kaminoReserve,
      preInstructions,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();
    const { address: market } = await PdaDeriver.market(
      underlyingReserve,
      tenorSeconds
    );

    let builder = this.program.methods.updateRateIndex().accountsStrict({
      protocolState,
      market,
      kaminoReserve,
      keeper,
    });
    if (preInstructions && preInstructions.length > 0) {
      builder = builder.preInstructions(preInstructions);
    }
    const signature = await builder.rpc();

    return { signature };
  }
}
