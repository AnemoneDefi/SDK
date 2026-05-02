import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import {
  DEFAULT_BASE_SPREAD_BPS,
  DEFAULT_MAX_UTILIZATION_BPS,
  SECONDS_PER_DAY,
} from "../../../constants";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface CreateMarketParams {
  authority: PublicKey;
  underlyingReserve: PublicKey;
  underlyingProtocol: PublicKey;
  underlyingMint: PublicKey;
  /** Kamino k-token mint (e.g. k-USDC). Used as mint for the kamino_deposit_account. */
  kaminoCollateralMint: PublicKey;
  tenorSeconds?: bigint;
  settlementPeriodSeconds?: bigint;
  maxUtilizationBps?: number;
  baseSpreadBps?: number;
}

export interface CreateMarketResult {
  signature: TransactionSignature;
  marketAddress: string;
  lpMintAddress: string;
  lpVaultAddress: string;
}

export class CreateMarket {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: CreateMarketParams): Promise<CreateMarketResult> {
    const {
      authority,
      underlyingReserve,
      underlyingProtocol,
      underlyingMint,
      kaminoCollateralMint,
      tenorSeconds = BigInt(30 * SECONDS_PER_DAY),
      settlementPeriodSeconds = BigInt(SECONDS_PER_DAY),
      maxUtilizationBps = DEFAULT_MAX_UTILIZATION_BPS,
      baseSpreadBps = DEFAULT_BASE_SPREAD_BPS,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();
    const { address: market } = await PdaDeriver.market(
      underlyingReserve,
      tenorSeconds
    );
    const { address: lpVault } = await PdaDeriver.lpVault(market);
    const { address: collateralVault } =
      await PdaDeriver.collateralVault(market);
    const { address: lpMint } = await PdaDeriver.lpMint(market);
    const { address: kaminoDepositAccount } =
      await PdaDeriver.kaminoDepositAccount(market);

    const signature = await this.program.methods
      .createMarket(
        new BN(tenorSeconds.toString()),
        new BN(settlementPeriodSeconds.toString()),
        maxUtilizationBps,
        baseSpreadBps
      )
      .accountsStrict({
        protocolState,
        market,
        lpVault,
        collateralVault,
        lpMint,
        kaminoDepositAccount,
        kaminoCollateralMint,
        underlyingReserve,
        underlyingProtocol,
        underlyingMint,
        authority,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return {
      signature,
      marketAddress: market.toBase58(),
      lpMintAddress: lpMint.toBase58(),
      lpVaultAddress: lpVault.toBase58(),
    };
  }
}
