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

`wallet` is an `AnchorWallet` (Phantom, Wallet Adapter, or anything that implements `signTransaction` + `signAllTransactions`).

The SDK groups instructions by role:

| Namespace | Instructions |
|---|---|
| `sdk.query` | `protocol`, `markets`, `positions` (read-only) |
| `sdk.admin` | `initializeProtocol`, `createMarket`, `setKeeper`, `pauseProtocol`, `unpauseProtocol`, `setRateIndexOracle` |
| `sdk.lp` | `depositLiquidity`, `requestWithdrawal` |
| `sdk.keeper` | `updateRateIndex`, `syncKaminoYield`, `depositToKamino`, `withdrawFromKamino` |
| `sdk.trader` | `openSwap`, `addCollateral`, `settlePeriod`, `closePositionEarly`, `claimMatured`, `liquidatePosition` |

---

## Reading on-chain state

```typescript
const protocol = await sdk.query.protocol.fetch();
const markets = await sdk.query.markets.fetchAll();

const market = await sdk.query.markets.fetchByReserveAndTenor(
  KAMINO_USDC_RESERVE,
  BigInt(TENOR_30_DAYS)
);

// LP position
const lpPosition = await sdk.query.positions.fetchLpPosition(
  wallet.publicKey.toBase58(),
  market.publicKey
);

// Swap position (trader+market+nonce)
const swap = await sdk.query.positions.fetchSwapPosition(swapPositionAddress);
```

---

## `preInstructions` — bundling Kamino refresh

Most Kamino-touching instructions accept an optional `preInstructions: TransactionInstruction[]`. The typical pattern is to bundle a Kamino `refresh_reserve` so the program reads post-accrual values:

```typescript
import { TransactionInstruction } from "@solana/web3.js";

// Build a Kamino refresh_reserve instruction (Anchor discriminator)
const refresh = refreshReserveIx({ /* reserve, lendingMarket, scopePrices, kaminoProgram */ });

await sdk.keeper.updateRateIndex.execute({
  keeper: wallet.publicKey,
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds: BigInt(TENOR_30_DAYS),
  kaminoReserve: new PublicKey(KAMINO_USDC_RESERVE),
  preInstructions: [refresh], // atomic: refresh then read
});
```

Use cases that accept `preInstructions`: `updateRateIndex`, `syncKaminoYield`, `depositToKamino`, `withdrawFromKamino`, `requestWithdrawal`, `closePositionEarly`, `claimMatured`, `liquidatePosition`.

Without a fresh refresh, the program may reject with `StaleOracle` or `InvalidRateIndex`.

---

## LP operations

### Deposit liquidity

```typescript
const { signature, lpPositionAddress } = await sdk.lp.depositLiquidity.execute({
  depositor:      wallet.publicKey,
  market:         new PublicKey(market.publicKey),
  underlyingMint: new PublicKey(USDC_MINT),
  lpMint:         new PublicKey(market.lpMint),
  lpVault:        new PublicKey(market.lpVault),
  amount:         100_000_000n, // 100 USDC
});
```

### Request withdrawal

Single-shot: burns shares, redeems Kamino shortfall if needed, sends USDC back. All Kamino accounts are required even when no shortfall fires.

```typescript
const { signature } = await sdk.lp.requestWithdrawal.execute({
  withdrawer:    wallet.publicKey,
  market:        new PublicKey(market.publicKey),
  underlyingMint: new PublicKey(USDC_MINT),
  lpMint:        new PublicKey(market.lpMint),
  lpVault:       new PublicKey(market.lpVault),
  treasury:      new PublicKey(protocol.treasury),
  sharesToBurn:  lpPosition.shares,
  // Kamino redeem-on-shortfall accounts:
  kaminoReserve, kaminoLendingMarket, kaminoLendingMarketAuthority,
  reserveLiquidityMint, reserveLiquiditySupply, reserveCollateralMint,
  collateralTokenProgram, liquidityTokenProgram,
  preInstructions: [refresh],
});
```

---

## Trader operations

### Open a swap

```typescript
import { SwapDirection } from "@anemone/sdk";

const { signature, swapPositionAddress } = await sdk.trader.openSwap.execute({
  trader:          wallet.publicKey,
  market:          new PublicKey(market.publicKey),
  underlyingMint:  new PublicKey(USDC_MINT),
  treasury:        new PublicKey(protocol.treasury),
  collateralVault: new PublicKey(market.collateralVault),
  direction:       SwapDirection.PayFixed, // or ReceiveFixed
  notional:        100_000_000n,            // 100 USDC
  nonce:           1,                        // unique per (trader, market)
  maxRateBps:      1500n,                    // PayFixed slippage cap
  minRateBps:      0n,                       // ReceiveFixed slippage floor
});
```

### Add collateral

```typescript
await sdk.trader.addCollateral.execute({
  owner:           wallet.publicKey,
  market:          new PublicKey(market.publicKey),
  underlyingMint:  new PublicKey(USDC_MINT),
  collateralVault: new PublicKey(market.collateralVault),
  nonce:           1,
  amount:          50_000_000n, // 50 USDC
});
```

### Settle period

Permissionless — anyone can call once `next_settlement_ts` has passed. Pays the period's PnL between `lp_vault` and `collateral_vault`.

```typescript
await sdk.trader.settlePeriod.execute({
  caller:          wallet.publicKey,
  market:          new PublicKey(market.publicKey),
  swapPosition:    swapPositionAddress,
  underlyingMint:  new PublicKey(USDC_MINT),
  lpVault:         new PublicKey(market.lpVault),
  collateralVault: new PublicKey(market.collateralVault),
});
```

### Close early

Pays the early-close fee + final MtM, releases remaining collateral.

```typescript
await sdk.trader.closePositionEarly.execute({
  owner:           wallet.publicKey,
  market:          new PublicKey(market.publicKey),
  swapPosition:    swapPositionAddress,
  underlyingMint:  new PublicKey(USDC_MINT),
  lpVault:         new PublicKey(market.lpVault),
  collateralVault: new PublicKey(market.collateralVault),
  treasury:        new PublicKey(protocol.treasury),
  // Kamino redeem-on-shortfall accounts:
  kaminoReserve, kaminoLendingMarket, kaminoLendingMarketAuthority,
  reserveLiquidityMint, reserveLiquiditySupply, reserveCollateralMint,
  collateralTokenProgram, liquidityTokenProgram,
  preInstructions: [refresh],
});
```

### Claim matured

Only valid after `maturity_timestamp`.

```typescript
await sdk.trader.claimMatured.execute({
  owner:           wallet.publicKey,
  market:          new PublicKey(market.publicKey),
  swapPosition:    swapPositionAddress,
  underlyingMint:  new PublicKey(USDC_MINT),
  lpVault:         new PublicKey(market.lpVault),
  collateralVault: new PublicKey(market.collateralVault),
  // ...Kamino accounts as in closePositionEarly
});
```

### Liquidate

Permissionless — any underwater position (collateral < maintenance margin) can be liquidated. Liquidation fee splits 1/3 to treasury, 2/3 to liquidator.

```typescript
await sdk.trader.liquidatePosition.execute({
  liquidator:      wallet.publicKey,
  owner:           positionOwner,
  market:          new PublicKey(market.publicKey),
  swapPosition:    swapPositionAddress,
  underlyingMint:  new PublicKey(USDC_MINT),
  lpVault:         new PublicKey(market.lpVault),
  collateralVault: new PublicKey(market.collateralVault),
  treasury:        new PublicKey(protocol.treasury),
  // ...Kamino accounts
});
```

---

## Admin operations

### Initialize protocol

```typescript
const { signature, protocolStateAddress } = await sdk.admin.initializeProtocol.execute({
  authority: wallet.publicKey,
  treasury:  treasuryAta,
  // fees are optional — defaults match the protocol spec
});
```

### Create market

```typescript
const { signature, marketAddress } = await sdk.admin.createMarket.execute({
  authority:           wallet.publicKey,
  underlyingReserve:   new PublicKey(KAMINO_USDC_RESERVE),
  underlyingProtocol:  new PublicKey(KAMINO_PROGRAM_ID),
  underlyingMint:      new PublicKey(USDC_MINT),
  kaminoCollateralMint: kaminoKUsdcMint, // = reserve.collateral.mint_pubkey
  tenorSeconds:        BigInt(TENOR_30_DAYS),
  settlementPeriodSeconds: BigInt(SECONDS_PER_DAY),
});
```

### Pause / unpause

`paused` blocks new `open_swap` and `deposit_liquidity`. Settlements and closes still work.

```typescript
await sdk.admin.pauseProtocol.execute({ authority: wallet.publicKey });
await sdk.admin.unpauseProtocol.execute({ authority: wallet.publicKey });
```

### Set keeper

Rotate the address allowed to call `update_rate_index`, `deposit_to_kamino`, `withdraw_from_kamino`.

```typescript
await sdk.admin.setKeeper.execute({
  authority: wallet.publicKey,
  newKeeper: keeperBotPubkey,
});
```

### Set rate index oracle (dev-tools only)

Forces `market.current_rate_index` to a specific value. Only available in builds with the `dev-tools` feature flag (devnet/localnet/surfpool); excluded from mainnet builds. Used by tests to drive specific rate states; production uses `update_rate_index` reading from Kamino.

```typescript
await sdk.admin.setRateIndexOracle.execute({
  authority:  wallet.publicKey,
  market:     new PublicKey(market.publicKey),
  rateIndex:  newIndexValue,
});
```

---

## Keeper operations

The keeper bot keeps market state fresh and manages Kamino capital deployment.

```typescript
// Pull Kamino's bsf into market.current_rate_index (cron every ~3 min)
await sdk.keeper.updateRateIndex.execute({
  keeper:            wallet.publicKey,
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds:      BigInt(TENOR_30_DAYS),
  kaminoReserve:     new PublicKey(KAMINO_USDC_RESERVE),
  preInstructions:   [refresh],
});

// Sync NAV — credits Kamino yield delta into lp_nav
await sdk.keeper.syncKaminoYield.execute({
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds:      BigInt(TENOR_30_DAYS),
  kaminoReserve, kaminoLendingMarket,
  pythOracle, switchboardPriceOracle, switchboardTwapOracle, scopePrices,
  preInstructions:   [refresh],
});

// Move idle lp_vault USDC into Kamino to earn yield
await sdk.keeper.depositToKamino.execute({
  keeper:            wallet.publicKey,
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds:      BigInt(TENOR_30_DAYS),
  amount:            500_000_000n,
  // ...Kamino accounts
  preInstructions:   [refresh],
});

// Redeem k-tokens back to USDC (refill lp_vault before settlements)
await sdk.keeper.withdrawFromKamino.execute({
  keeper:            wallet.publicKey,
  underlyingReserve: new PublicKey(KAMINO_USDC_RESERVE),
  tenorSeconds:      BigInt(TENOR_30_DAYS),
  collateralAmount:  kTokenAmount,
  // ...Kamino accounts
  preInstructions:   [refresh],
});
```

---

## Constants

```typescript
import {
  ANEMONE_PROGRAM_ID,
  KAMINO_PROGRAM_ID,
  KAMINO_USDC_RESERVE,
  USDC_MINT,
  USDC_DECIMALS,
  LP_MINT_DECIMALS,
  TENOR_30_DAYS,
  TENOR_90_DAYS,
  SECONDS_PER_DAY,
  DEFAULT_PROTOCOL_FEE_BPS,
  DEFAULT_OPENING_FEE_BPS,
  DEFAULT_LIQUIDATION_FEE_BPS,
  DEFAULT_WITHDRAWAL_FEE_BPS,
  DEFAULT_EARLY_CLOSE_FEE_BPS,
  DEFAULT_MAX_UTILIZATION_BPS,
  DEFAULT_BASE_SPREAD_BPS,
  BPS_DENOMINATOR,
  KAMINO_MAX_STALE_SLOTS,
  SEEDS,
} from "@anemone/sdk";
```

---

## PDA derivation

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

// Swap position: seeds are [b"swap", trader, market, nonce]
const { address: swapPosition } = await PdaDeriver.swapPosition(
  traderPublicKey,
  marketPublicKey,
  /* nonce */ 1
);

const { address: lpVault }         = await PdaDeriver.lpVault(marketPublicKey);
const { address: collateralVault } = await PdaDeriver.collateralVault(marketPublicKey);
const { address: lpMint }          = await PdaDeriver.lpMint(marketPublicKey);
const { address: kaminoDeposit }   = await PdaDeriver.kaminoDepositAccount(marketPublicKey);
```

---

## Development

```bash
npm install
npm test                # 99 unit tests (mocked program, IDL conformance)
npm run test:e2e        # 37 E2E tests against surfpool — see e2e/README.md
npm run build           # compile to dist/
npx tsc --noEmit        # type-check only
```

### E2E suite (surfpool)

The E2E suite runs against [surfpool](https://github.com/txtx/surfpool), a mainnet-fork validator that lazily forks Kamino's USDC reserve, lending market, and Scope prices. See [e2e/README.md](e2e/README.md) for setup; the short version:

```bash
# In anemone/
yarn surfpool          # start mainnet fork on 127.0.0.1:8899
yarn ts-node scripts/setup-surfpool.ts  # deploy program + init protocol/market

# In SDK/
npm run test:e2e
```

15 files, 37 tests, ~15 minutes total runtime. Coverage:

| Category | Files |
|---|---|
| Read-only queries | `protocol-read` |
| LP lifecycle | `lp-lifecycle`, `kamino-deposit` |
| Trader lifecycle | `swap-lifecycle`, `trader-collateral`, `settle-period`, `claim-matured`, `multi-settlement` |
| Liquidation | `liquidation` (plumbing), `liquidation-positive` (1/3 vs 2/3 split), `liquidation-organic` (no forged state) |
| Admin / keeper | `admin-lifecycle`, `keeper-ops` |
| Negative paths | `negative-paths` (6 reverts) |
| Pre-mainnet hardening | `pre-mainnet` (pause guards, keeper rotation, Token-2022, slippage) |

The organic liquidation, multi-settlement, and pre-mainnet tests need the on-chain program built with the `dev-tools` feature so `set_rate_index_oracle` is exposed. Mainnet builds (`--no-default-features`) omit it.

---

## Program

| Network | Program ID |
|---------|-----------|
| Mainnet | `KQs6ci5FtedFKPVJThAZSMMXyosK4TvnF7kcDSx5Jwd` |
