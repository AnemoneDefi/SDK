import { Program } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";
import { KAMINO_PROGRAM_ID } from "../../../constants";

export interface DepositToKaminoParams {
  keeper: PublicKey;
  underlyingReserve: PublicKey;
  tenorSeconds: bigint;
  kaminoReserve: PublicKey;
  kaminoLendingMarket: PublicKey;
  kaminoLendingMarketAuthority: PublicKey;
  kaminoReserveLiquiditySupply: PublicKey;
  kaminoReserveCollateralMint: PublicKey;
  amount: bigint;
}

export interface DepositToKaminoResult {
  signature: TransactionSignature;
}

export class DepositToKamino {
  constructor(private readonly program: Program) {}

  async execute(params: DepositToKaminoParams): Promise<DepositToKaminoResult> {
    const {
      keeper,
      underlyingReserve,
      tenorSeconds,
      kaminoReserve,
      kaminoLendingMarket,
      kaminoLendingMarketAuthority,
      kaminoReserveLiquiditySupply,
      kaminoReserveCollateralMint,
      amount,
    } = params;

    const { address: market } = await PdaDeriver.market(
      underlyingReserve,
      tenorSeconds
    );
    const { address: lpVault } = await PdaDeriver.lpVault(market);
    const { address: kaminoDepositAccount } =
      await PdaDeriver.kaminoDepositAccount(market);

    const signature = await (this.program.methods as any)
      .depositToKamino(amount)
      .accountsStrict({
        market,
        lpVault,
        kaminoDepositAccount,
        kaminoReserve,
        kaminoLendingMarket,
        kaminoLendingMarketAuthority,
        kaminoReserveLiquiditySupply,
        kaminoReserveCollateralMint,
        kaminoProgram: new PublicKey(KAMINO_PROGRAM_ID),
        keeper,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { signature };
  }
}
