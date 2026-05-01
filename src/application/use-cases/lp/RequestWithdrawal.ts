import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { KAMINO_PROGRAM_ID } from "../../../constants";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface RequestWithdrawalParams {
  withdrawer: PublicKey;
  market: PublicKey;
  underlyingMint: PublicKey;
  lpMint: PublicKey;
  lpVault: PublicKey;
  treasury: PublicKey;
  sharesToBurn: bigint;
  /** Kamino accounts — required for redeem-on-shortfall when lp_vault is light. */
  kaminoReserve: PublicKey;
  kaminoLendingMarket: PublicKey;
  kaminoLendingMarketAuthority: PublicKey;
  reserveLiquidityMint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveCollateralMint: PublicKey;
  collateralTokenProgram: PublicKey;
  liquidityTokenProgram: PublicKey;
  /** Atomic preInstructions — typically `sync_kamino_yield` to keep NAV fresh. */
  preInstructions?: TransactionInstruction[];
}

export interface RequestWithdrawalResult {
  signature: TransactionSignature;
}

export class RequestWithdrawal {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: RequestWithdrawalParams
  ): Promise<RequestWithdrawalResult> {
    const {
      withdrawer,
      market,
      underlyingMint,
      lpMint,
      lpVault,
      treasury,
      sharesToBurn,
      kaminoReserve,
      kaminoLendingMarket,
      kaminoLendingMarketAuthority,
      reserveLiquidityMint,
      reserveLiquiditySupply,
      reserveCollateralMint,
      collateralTokenProgram,
      liquidityTokenProgram,
      preInstructions,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();
    const { address: lpPosition } = await PdaDeriver.lpPosition(
      withdrawer,
      market
    );
    const { address: kaminoDepositAccount } =
      await PdaDeriver.kaminoDepositAccount(market);

    const withdrawerTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      withdrawer
    );
    const withdrawerLpTokenAccount = getAssociatedTokenAddressSync(
      lpMint,
      withdrawer
    );

    let builder = this.program.methods
      .requestWithdrawal(new BN(sharesToBurn.toString()))
      .accountsStrict({
        protocolState,
        market,
        lpPosition,
        lpVault,
        lpMint,
        underlyingMint,
        withdrawerLpTokenAccount,
        withdrawerTokenAccount,
        treasury,
        withdrawer,
        tokenProgram: TOKEN_PROGRAM_ID,
        kaminoDepositAccount,
        kaminoReserve,
        kaminoLendingMarket,
        kaminoLendingMarketAuthority,
        reserveLiquidityMint,
        reserveLiquiditySupply,
        reserveCollateralMint,
        collateralTokenProgram,
        liquidityTokenProgram,
        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
        kaminoProgram: new PublicKey(KAMINO_PROGRAM_ID),
      });
    if (preInstructions && preInstructions.length > 0) {
      builder = builder.preInstructions(preInstructions);
    }
    const signature = await builder.rpc();

    return { signature };
  }
}
