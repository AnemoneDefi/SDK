import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface SettlePeriodParams {
  caller: PublicKey;
  market: PublicKey;
  swapPosition: PublicKey;
  underlyingMint: PublicKey;
  lpVault: PublicKey;
  collateralVault: PublicKey;
  /** Treasury — receives the protocol fee skimmed from each settlement. */
  treasury: PublicKey;
}

export interface SettlePeriodResult {
  signature: TransactionSignature;
}

export class SettlePeriod {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: SettlePeriodParams): Promise<SettlePeriodResult> {
    const {
      caller,
      market,
      swapPosition,
      underlyingMint,
      lpVault,
      collateralVault,
      treasury,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();

    const signature = await this.program.methods
      .settlePeriod()
      .accountsStrict({
        protocolState,
        market,
        swapPosition,
        lpVault,
        collateralVault,
        treasury,
        underlyingMint,
        caller,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { signature };
  }
}
