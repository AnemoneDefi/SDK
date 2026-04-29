import { Program } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface RequestWithdrawalParams {
  owner: PublicKey;
  market: PublicKey;
  underlyingMint: PublicKey;
  lpMint: PublicKey;
  lpVault: PublicKey;
  treasury: PublicKey;
  sharesToBurn: bigint;
}

export interface RequestWithdrawalResult {
  signature: TransactionSignature;
}

export class RequestWithdrawal {
  constructor(private readonly program: Program) {}

  async execute(
    params: RequestWithdrawalParams
  ): Promise<RequestWithdrawalResult> {
    const {
      owner,
      market,
      underlyingMint,
      lpMint,
      lpVault,
      treasury,
      sharesToBurn,
    } = params;

    const { address: lpPosition } = await PdaDeriver.lpPosition(owner, market);

    const ownerTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      owner
    );
    const ownerLpTokenAccount = getAssociatedTokenAddressSync(lpMint, owner);

    const signature = await (this.program.methods as any)
      .requestWithdrawal(sharesToBurn)
      .accountsStrict({
        market,
        lpPosition,
        lpVault,
        lpMint,
        ownerTokenAccount,
        ownerLpTokenAccount,
        treasury,
        owner,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { signature };
  }
}
