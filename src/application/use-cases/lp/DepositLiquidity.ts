import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface DepositLiquidityParams {
  depositor: PublicKey;
  market: PublicKey;
  underlyingMint: PublicKey;
  lpMint: PublicKey;
  lpVault: PublicKey;
  amount: bigint;
}

export interface DepositLiquidityResult {
  signature: TransactionSignature;
  lpPositionAddress: string;
}

export class DepositLiquidity {
  constructor(private readonly program: Program) {}

  async execute(params: DepositLiquidityParams): Promise<DepositLiquidityResult> {
    const { depositor, market, underlyingMint, lpMint, lpVault, amount } =
      params;

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

    const signature = await (this.program.methods as any)
      .depositLiquidity(amount)
      .accountsStrict({
        market,
        lpPosition,
        lpVault,
        lpMint,
        depositorTokenAccount,
        depositorLpTokenAccount,
        depositor,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { signature, lpPositionAddress: lpPosition.toBase58() };
  }
}
