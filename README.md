# Anemone SDK

TypeScript SDK for the [Anemone](https://github.com/AnemoneDefi) Interest Rate Swap protocol on Solana.

Anemone lets traders take fixed vs. variable rate positions on Kamino K-Lend yields, while LPs earn the base lending rate with their capital always deployed.

---

## Installation

```bash
npm install @anemone/sdk
```

---

## Quick start

```typescript
import { Connection } from "@solana/web3.js";
import { Anemone } from "@anemone/sdk";

const connection = new Connection("https://api.mainnet-beta.solana.com");

// Read-only (no wallet needed)
const sdk = new Anemone({ connection });

// With a wallet (required to send transactions)
const sdk = new Anemone({ connection, wallet });
```

The `wallet` can be any object that implements `signTransaction` and `signAllTransactions` — Phantom, a `Keypair`-based wallet, or any Wallet Adapter compatible wallet.

---

## Reading on-chain state

```typescript
// Protocol global config
const protocol = await sdk.query.protocol.fetch();

// All active markets
const markets = await sdk.query.markets.fetchAll();

// A specific market by address
const market = await sdk.query.markets.fetchByAddress("...");

// A market by its reserve + tenor
const market = await sdk.query.markets.fetchByReserveAndTenor(
  KAMINO_USDC_RESERVE,
  BigInt(30 * 86_400) // 30-day tenor
);

// LP position for a wallet
const position = await sdk.query.positions.fetchLpPosition(
  wallet.publicKey.toBase58(),
  market.publicKey
);

// All LP positions for a wallet
const positions = await sdk.query.positions.fetchLpPositionsByOwner(
  wallet.publicKey.toBase58()
);
```

---

## LP operations

### Deposit liquidity

```typescript
import { KAMINO_USDC_RESERVE, USDC_MINT, TENOR_30_DAYS } from "@anemone/sdk";

const market = await sdk.query.markets.fetchByReserveAndTenor(
  KAMINO_USDC_RESERVE,
  BigInt(TENOR_30_DAYS)
);

const { signature, lpPositionAddress } = await sdk.lp.depositLiquidity.execute({
  depositor:      wallet.publicKey,
  market:         new PublicKey(market.publicKey),
  underlyingMint: new PublicKey(USDC_MINT),
  lpMint:         new PublicKey(market.lpMint),
  lpVault:        new PublicKey(market.lpVault),
  amount:         BigInt(100 * 1_000_000), // 100 USDC (6 decimals)
});
```

### Request withdrawal

```typescript
const { signature } = await sdk.lp.requestWithdrawal.execute({
  owner:          wallet.publicKey,
  market:         new PublicKey(market.publicKey),
  underlyingMint: new PublicKey(USDC_MINT),
  lpMint:         new PublicKey(market.lpMint),
  lpVault:        new PublicKey(market.lpVault),
  treasury:       new PublicKey(protocol.treasury),
  sharesToBurn:   lpPosition.shares, // burn all shares
});
```

---

## Admin operations

### Initialize protocol

```typescript
const { signature, protocolStateAddress } = await sdk.admin.initializeProtocol.execute({
  authority: wallet.publicKey,
  treasury:  treasuryPublicKey,
  // fees are optional — defaults match the protocol spec
});
```

### Create a market

```typescript
import { KAMINO_PROGRAM_ID, KAMINO_USDC_RESERVE, USDC_MINT, TENOR_30_DAYS, SECONDS_PER_DAY } from "@anemone/sdk";

const { signature, marketAddress } = await sdk.admin.createMarket.execute({
  authority:          wallet.publicKey,
  underlyingReserve:  new PublicKey(KAMINO_USDC_RESERVE),
  underlyingProtocol: new PublicKey(KAMINO_PROGRAM_ID),
  underlyingMint:     new PublicKey(USDC_MINT),
  tenorSeconds:       BigInt(TENOR_30_DAYS),
  settlementPeriodSeconds: BigInt(SECONDS_PER_DAY),
  // maxUtilizationBps, baseSpreadBps, maxLeverage are optional
});
```

---

## Keeper operations

The keeper is a bot that keeps market state fresh and manages Kamino capital deployment.

```typescript
import { KAMINO_USDC_RESERVE, TENOR_30_DAYS } from "@anemone/sdk";

// Update the rate index from Kamino (run every ~5 minutes)
await sdk.keeper.updateRateIndex.execute({
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds:      BigInt(TENOR_30_DAYS),
  kaminoReserve:     new PublicKey(KAMINO_USDC_RESERVE),
});

// Deploy idle LP capital to Kamino
await sdk.keeper.depositToKamino.execute({
  keeper:            wallet.publicKey,
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds:      BigInt(TENOR_30_DAYS),
  amount:            amountToDeposit,
  // ...kamino account addresses
});

// Redeem k-tokens back to USDC
await sdk.keeper.withdrawFromKamino.execute({
  keeper:           wallet.publicKey,
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds:     BigInt(TENOR_30_DAYS),
  collateralAmount: kTokenAmount,
  // ...kamino account addresses
});
```

---

## Constants

All constants can be imported directly without instantiating `Anemone`:

```typescript
import {
  ANEMONE_PROGRAM_ID,
  KAMINO_PROGRAM_ID,
  KAMINO_USDC_RESERVE,
  USDC_MINT,
  USDC_DECIMALS,
  TENOR_30_DAYS,
  TENOR_90_DAYS,
  SECONDS_PER_DAY,
  DEFAULT_PROTOCOL_FEE_BPS,
  DEFAULT_OPENING_FEE_BPS,
  DEFAULT_WITHDRAWAL_FEE_BPS,
  BPS_DENOMINATOR,
  SEEDS,
} from "@anemone/sdk";
```

---

## PDA derivation

If you need to derive addresses manually:

```typescript
import { PdaDeriver } from "@anemone/sdk";
import { PublicKey } from "@solana/web3.js";

const { address: protocolState } = await PdaDeriver.protocol();

const { address: market } = await PdaDeriver.market(
  new PublicKey(KAMINO_USDC_RESERVE),
  BigInt(TENOR_30_DAYS)
);

const { address: lpPosition } = await PdaDeriver.lpPosition(
  ownerPublicKey,
  marketPublicKey
);
```

---

## Development

```bash
npm install
npm test           # run unit tests
npm run build      # compile to dist/
```

---

## Program

| Network | Program ID |
|---------|-----------|
| Mainnet | `KQs6ci5FtedFKPVJThAZSMMXyosK4TvnF7kcDSx5Jwd` |
