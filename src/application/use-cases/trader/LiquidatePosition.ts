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

export interface LiquidatePositionParams {
  liquidator: PublicKey;
  /** Position owner — receives any leftover collateral after liquidation fee + bounty. */
  owner: PublicKey;
  market: PublicKey;
  swapPosition: PublicKey;
  underlyingMint: PublicKey;
  lpVault: PublicKey;
  collateralVault: PublicKey;
  /** Treasury — receives the protocol's 1/3 share of liquidation_fee_bps. Same address as protocol_state.treasury. */
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

export interface LiquidatePositionResult {
  signature: TransactionSignature;
}

export class LiquidatePosition {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: LiquidatePositionParams
  ): Promise<LiquidatePositionResult> {
    const {
      liquidator,
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
    const liquidatorTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      liquidator
    );

    let builder = this.program.methods
      .liquidatePosition()
      .accountsStrict({
        protocolState,
        market,
        swapPosition,
        lpVault,
        collateralVault,
        owner,
        ownerTokenAccount,
        liquidatorTokenAccount,
        treasury,
        underlyingMint,
        liquidator,
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
