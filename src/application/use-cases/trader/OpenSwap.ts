import type { AnemoneProgram } from "../../../infrastructure/anchor/AnemoneProgram";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  TransactionSignature,
} from "@solana/web3.js";
import { SwapDirection } from "../../../domain/enums";
import { PdaDeriver } from "../../../infrastructure/pda/PdaDeriver";

export interface OpenSwapParams {
  trader: PublicKey;
  market: PublicKey;
  underlyingMint: PublicKey;
  treasury: PublicKey;
  collateralVault: PublicKey;
  direction: SwapDirection;
  notional: bigint;
  /** Trader-chosen nonce — combine with trader+market to derive a unique position PDA. */
  nonce: number;
  /** Slippage caps quoted by frontend. open_swap rejects if the live rate is outside [min, max]. */
  maxRateBps: bigint;
  minRateBps: bigint;
}

export interface OpenSwapResult {
  signature: TransactionSignature;
  swapPositionAddress: string;
}

function directionToAnchor(
  d: SwapDirection
): { payFixed: Record<string, never> } | { receiveFixed: Record<string, never> } {
  return d === SwapDirection.PayFixed ? { payFixed: {} } : { receiveFixed: {} };
}

export class OpenSwap {
  constructor(private readonly program: AnemoneProgram) {}

  async execute(params: OpenSwapParams): Promise<OpenSwapResult> {
    const {
      trader,
      market,
      underlyingMint,
      treasury,
      collateralVault,
      direction,
      notional,
      nonce,
      maxRateBps,
      minRateBps,
    } = params;

    const { address: protocolState } = await PdaDeriver.protocol();
    const { address: swapPosition } = await PdaDeriver.swapPosition(
      trader,
      market,
      nonce
    );

    const traderTokenAccount = getAssociatedTokenAddressSync(
      underlyingMint,
      trader
    );

    const signature = await this.program.methods
      .openSwap(
        directionToAnchor(direction) as never,
        new BN(notional.toString()),
        nonce,
        new BN(maxRateBps.toString()),
        new BN(minRateBps.toString())
      )
      .accountsStrict({
        protocolState,
        market,
        swapPosition,
        collateralVault,
        treasury,
        underlyingMint,
        traderTokenAccount,
        trader,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, swapPositionAddress: swapPosition.toBase58() };
  }
}
