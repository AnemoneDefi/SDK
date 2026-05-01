import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface SetRateIndexOracleParams {
  authority: PublicKey;
  market: PublicKey;
  rateIndex: bigint;
}

export interface SetRateIndexOracleResult {
  signature: TransactionSignature;
}

/**
 * Admin-only stub for environments without Kamino (devnet) or for forcing
 * specific rate-index state in tests. Mirrors `update_rate_index`'s rotate
 * pattern: current → previous, then sets new current to `rateIndex`.
 *
 * Production note: this instruction lets the admin push an arbitrary rate
 * index, which is a trust assumption that should not exist in mainnet. Gate
 * with a feature flag or remove before TVL goes live.
 */
export class SetRateIndexOracle {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: SetRateIndexOracleParams
  ): Promise<SetRateIndexOracleResult> {
    const { authority, market, rateIndex } = params;
    const { address: protocolState } = await PdaDeriver.protocol();

    const signature = await this.program.methods
      .setRateIndexOracle(new BN(rateIndex.toString()))
      .accountsStrict({
        protocolState,
        market,
        authority,
      })
      .rpc();

    return { signature };
  }
}
