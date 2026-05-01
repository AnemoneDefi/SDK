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

export interface DepositToKaminoParams {
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
  amount: bigint;
  /** Atomic preInstructions — typically a Kamino `refresh_reserve`. */
  preInstructions?: TransactionInstruction[];
}

export interface DepositToKaminoResult {
  signature: TransactionSignature;
}

export class DepositToKamino {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: DepositToKaminoParams): Promise<DepositToKaminoResult> {
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
      amount,
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
      .depositToKamino(new BN(amount.toString()))
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
