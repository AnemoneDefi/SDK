import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { PublicKey, SystemProgram, TransactionSignature } from "@solana/web3.js";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";
import {
  DEFAULT_EARLY_CLOSE_FEE_BPS,
  DEFAULT_LIQUIDATION_FEE_BPS,
  DEFAULT_OPENING_FEE_BPS,
  DEFAULT_PROTOCOL_FEE_BPS,
  DEFAULT_WITHDRAWAL_FEE_BPS,
} from "../../../constants";

export interface InitializeProtocolParams {
  authority: PublicKey;
  treasury: PublicKey;
  protocolFeeBps?: number;
  openingFeeBps?: number;
  liquidationFeeBps?: number;
  withdrawalFeeBps?: number;
  earlyCloseFeeBps?: number;
}

export interface InitializeProtocolResult {
  signature: TransactionSignature;
  protocolStateAddress: string;
}

export class InitializeProtocol {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(
    params: InitializeProtocolParams
  ): Promise<InitializeProtocolResult> {
    const {
      authority,
      treasury,
      protocolFeeBps = DEFAULT_PROTOCOL_FEE_BPS,
      openingFeeBps = DEFAULT_OPENING_FEE_BPS,
      liquidationFeeBps = DEFAULT_LIQUIDATION_FEE_BPS,
      withdrawalFeeBps = DEFAULT_WITHDRAWAL_FEE_BPS,
      earlyCloseFeeBps = DEFAULT_EARLY_CLOSE_FEE_BPS,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();

    const signature = await (this.program.methods as any)
      .initializeProtocol(
        protocolFeeBps,
        openingFeeBps,
        liquidationFeeBps,
        withdrawalFeeBps,
        earlyCloseFeeBps
      )
      .accountsStrict({
        protocolState,
        authority,
        treasury,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, protocolStateAddress: protocolState.toBase58() };
  }
}
