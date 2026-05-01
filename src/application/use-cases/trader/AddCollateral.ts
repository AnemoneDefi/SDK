import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface AddCollateralParams {
  owner: PublicKey;
  market: PublicKey;
  underlyingMint: PublicKey;
  collateralVault: PublicKey;
  /** Position nonce — same one used to derive the position when it was opened. */
  nonce: number;
  amount: bigint;
}

export interface AddCollateralResult {
  signature: TransactionSignature;
}

export class AddCollateral {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: AddCollateralParams): Promise<AddCollateralResult> {
    const {
      owner,
      market,
      underlyingMint,
      collateralVault,
      nonce,
      amount,
    } = params;

    const { address: swapPosition } = await PdaDeriver.swapPosition(
      owner,
      market,
      nonce
    );

    const ownerTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      owner
    );

    const signature = await this.program.methods
      .addCollateral(new BN(amount.toString()))
      .accountsStrict({
        market,
        swapPosition,
        collateralVault,
        underlyingMint,
        ownerTokenAccount,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { signature };
  }
}
