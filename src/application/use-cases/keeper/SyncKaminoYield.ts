import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PublicKey,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";
import { KAMINO_PROGRAM_ID } from "../../../constants";

export interface SyncKaminoYieldParams {
  underlyingReserve: PublicKey;
  tenorSeconds: bigint;
  kaminoReserve: PublicKey;
  kaminoLendingMarket: PublicKey;
  /** Pyth oracle. Pass kaminoProgram as placeholder when reserve uses Scope only. */
  pythOracle: PublicKey;
  /** Switchboard price oracle. Same placeholder convention as pythOracle. */
  switchboardPriceOracle: PublicKey;
  /** Switchboard TWAP oracle. Same placeholder convention. */
  switchboardTwapOracle: PublicKey;
  /** Scope prices account. Required for USDC reserve. */
  scopePrices: PublicKey;
  /**
   * Atomic preInstructions — typically a Kamino `refresh_reserve` to keep
   * `cumulative_borrow_rate_bsf` fresh before this op reads it.
   */
  preInstructions?: TransactionInstruction[];
}

export interface SyncKaminoYieldResult {
  signature: TransactionSignature;
}

export class SyncKaminoYield {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: SyncKaminoYieldParams
  ): Promise<SyncKaminoYieldResult> {
    const {
      underlyingReserve,
      tenorSeconds,
      kaminoReserve,
      kaminoLendingMarket,
      pythOracle,
      switchboardPriceOracle,
      switchboardTwapOracle,
      scopePrices,
      preInstructions,
    } = params;

    const { address: market } = await PdaDeriver.market(
      underlyingReserve,
      tenorSeconds
    );
    const { address: kaminoDepositAccount } =
      await PdaDeriver.kaminoDepositAccount(market);

    let builder = this.program.methods.syncKaminoYield().accountsStrict({
      market,
      kaminoReserve,
      kaminoDepositAccount,
      kaminoLendingMarket,
      pythOracle,
      switchboardPriceOracle,
      switchboardTwapOracle,
      scopePrices,
      kaminoProgram: new PublicKey(KAMINO_PROGRAM_ID),
      tokenProgram: TOKEN_PROGRAM_ID,
    });
    if (preInstructions && preInstructions.length > 0) {
      builder = builder.preInstructions(preInstructions);
    }
    const signature = await builder.rpc();

    return { signature };
  }
}
