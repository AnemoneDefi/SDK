import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { KAMINO_PROGRAM_ID } from "../../../constants";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface ClosePositionEarlyParams {
  owner: PublicKey;
  market: PublicKey;
  swapPosition: PublicKey;
  underlyingMint: PublicKey;
  lpVault: PublicKey;
  collateralVault: PublicKey;
  treasury: PublicKey;
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

export interface ClosePositionEarlyResult {
  signature: TransactionSignature;
}

export class ClosePositionEarly {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: ClosePositionEarlyParams
  ): Promise<ClosePositionEarlyResult> {
    const {
      owner,
      market,
      swapPosition,
      underlyingMint,
      lpVault,
      collateralVault,
      treasury,
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
    const { address: kaminoDepositAccount } =
      await PdaDeriver.kaminoDepositAccount(market);

    const ownerTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      owner
    );

    let builder = this.program.methods
      .closePositionEarly()
      .accountsStrict({
        protocolState,
        market,
        swapPosition,
        lpVault,
        collateralVault,
        treasury,
        underlyingMint,
        ownerTokenAccount,
        owner,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
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
