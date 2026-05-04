import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface DepositLiquidityParams {
  depositor: PublicKey;
  market: PublicKey;
  underlyingMint: PublicKey;
  lpMint: PublicKey;
  lpVault: PublicKey;
  amount: bigint;
  /**
   * Atomic preInstructions — caller bundles e.g. `createAssociatedTokenAccountIdempotent`
   * for the depositor's LP token ATA when it doesn't yet exist (the program does
   * not init it). Single signature, atomic.
   */
  preInstructions?: TransactionInstruction[];
}

export interface DepositLiquidityResult {
  signature: TransactionSignature;
  lpPositionAddress: string;
}

export class DepositLiquidity {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: DepositLiquidityParams): Promise<DepositLiquidityResult> {
    const {
      depositor,
      market,
      underlyingMint,
      lpMint,
      lpVault,
      amount,
      preInstructions,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();
    const { address: lpPosition } = await PdaDeriver.lpPosition(
      depositor,
      market
    );

    const depositorTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      depositor
    );
    const depositorLpTokenAccount = getAssociatedTokenAddressSync(
      lpMint,
      depositor
    );

    let builder = this.program.methods
      .depositLiquidity(new BN(amount.toString()))
      .accountsStrict({
        protocolState,
        market,
        lpPosition,
        lpVault,
        lpMint,
        underlyingMint,
        depositorTokenAccount,
        depositorLpTokenAccount,
        depositor,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      });
    if (preInstructions && preInstructions.length > 0) {
      builder = builder.preInstructions(preInstructions);
    }
    const signature = await builder.rpc();

    return { signature, lpPositionAddress: lpPosition.toBase58() };
  }
}
