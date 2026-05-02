import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
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

export interface ClaimMaturedParams {
  owner: PublicKey;
  market: PublicKey;
  swapPosition: PublicKey;
  underlyingMint: PublicKey;
  lpVault: PublicKey;
  collateralVault: PublicKey;
  /** Kamino accounts — required for redeem-on-shortfall when lp_vault can't cover trader PnL. */
  kaminoReserve: PublicKey;
  kaminoLendingMarket: PublicKey;
  kaminoLendingMarketAuthority: PublicKey;
  reserveLiquidityMint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveCollateralMint: PublicKey;
  collateralTokenProgram: PublicKey;
  liquidityTokenProgram: PublicKey;
  /** Atomic preInstructions — typically a Kamino `refresh_reserve`. */
  preInstructions?: TransactionInstruction[];
}

export interface ClaimMaturedResult {
  signature: TransactionSignature;
}

export class ClaimMatured {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: ClaimMaturedParams): Promise<ClaimMaturedResult> {
    const {
      owner,
      market,
      swapPosition,
      underlyingMint,
      lpVault,
      collateralVault,
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

    const { address: kaminoDepositAccount } =
      await PdaDeriver.kaminoDepositAccount(market);

    const ownerTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      owner
    );

    let builder = this.program.methods
      .claimMatured()
      .accountsStrict({
        market,
        swapPosition,
        lpVault,
        collateralVault,
        ownerTokenAccount,
        underlyingMint,
        owner,
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
