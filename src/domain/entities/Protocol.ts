export interface Protocol {
  publicKey: string;
  authority: string;
  keeperAuthority: string;
  treasury: string;
  totalMarkets: bigint;
  protocolFeeBps: number;
  openingFeeBps: number;
  liquidationFeeBps: number;
  withdrawalFeeBps: number;
  earlyCloseFeeBps: number;
  bump: number;
  paused: boolean;
}
