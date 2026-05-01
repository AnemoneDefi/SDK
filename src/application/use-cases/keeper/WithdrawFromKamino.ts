import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";
import { KAMINO_PROGRAM_ID } from "../../../constants";

export interface WithdrawFromKaminoParams {
  keeper: PublicKey;
  underlyingReserve: PublicKey;
  tenorSeconds: bigint;
  kaminoReserve: PublicKey;
  kaminoLendingMarket: PublicKey;
  kaminoLendingMarketAuthority: PublicKey;
  reserveLiquidityMint: PublicKey;
  reserveLiquiditySupply: PublicKey;
  reserveCollateralMint: PublicKey;
  collateralTokenProgram: PublicKey;
  liquidityTokenProgram: PublicKey;
  /** Amount of k-token (collateral) to redeem. */
  collateralAmount: bigint;
  /** Atomic preInstructions — typically a Kamino `refresh_reserve`. */
  preInstructions?: TransactionInstruction[];
}

export interface WithdrawFromKaminoResult {
  signature: TransactionSignature;
}

export class WithdrawFromKamino {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: WithdrawFromKaminoParams
  ): Promise<WithdrawFromKaminoResult> {
    const {
      keeper,
      underlyingReserve,
      tenorSeconds,
      kaminoReserve,
      kaminoLendingMarket,
      kaminoLendingMarketAuthority,
      reserveLiquidityMint,
      reserveLiquiditySupply,
      reserveCollateralMint,
      collateralTokenProgram,
      liquidityTokenProgram,
      collateralAmount,
      preInstructions,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();
    const { address: market } = await PdaDeriver.market(
      underlyingReserve,
      tenorSeconds
    );
    const { address: lpVault } = await PdaDeriver.lpVault(market);
    const { address: kaminoDepositAccount } =
      await PdaDeriver.kaminoDepositAccount(market);

    let builder = this.program.methods
      .withdrawFromKamino(new BN(collateralAmount.toString()))
      .accountsStrict({
        protocolState,
        keeper,
        market,
        lpVault,
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
