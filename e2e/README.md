# SDK E2E tests

These tests exercise the SDK against a **live Solana validator** with the
Anemone program deployed. Unlike the unit tests in [`src/`](../src), they
prove that the SDK's account ordering, BN encoding, and PDA seeds match what
the on-chain program expects — the kind of bug that conformance + mocked unit
tests can miss.

E2E tests are **excluded from `yarn test`** so they don't break CI when
surfpool isn't running. Run them explicitly with:

```bash
yarn test:e2e
```

## Setup

```bash
# 1. From anemone/, start a local validator with Kamino fixtures.
cd anemone
yarn surfpool        # or: solana-test-validator (without Kamino — read tests only)

# 2. Deploy the program and initialize protocol + market.
yarn setup-surfpool  # writes deployments/surfpool.json
                     # mints USDC to the deployer wallet

# 3. From SDK/, run E2E.
cd ../SDK
yarn test:e2e
```

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `RPC_URL` | `http://127.0.0.1:8899` | Validator endpoint |
| `DEPLOYER_KEYPAIR` | `~/.config/solana/id.json` | Wallet keypair path |
| `DEPLOYMENT_FILE` | auto-discovered | Override path to deployment JSON |

The helpers in [`helpers/connection.ts`](helpers/connection.ts) auto-discover
the deployment metadata at `anemone/deployments/{localnet,surfpool}.json`,
falling back to `$DEPLOYMENT_FILE` if neither exists.

## Tests

- [`protocol-read.e2e.test.ts`](protocol-read.e2e.test.ts) — read-only.
  Decodes protocol state and all markets via the SDK, asserts that every new
  field (lpNav, keeperAuthority, paused, etc.) round-trips with the right type.
  Catches IDL-mapper drift.

- [`lp-lifecycle.e2e.test.ts`](lp-lifecycle.e2e.test.ts) — write path. Submits
  `deposit_liquidity` for 1 USDC, asserts `lp_nav` grew by exactly the
  deposited amount. Proves end-to-end account ordering + BN encoding.

## Skip behavior

Each test starts with a `beforeAll` reachability check. When the validator is
down, the deployment file is missing, or the depositor lacks USDC, tests log a
clear `[E2E skip]` reason and pass without assertions. This is intentional —
keeping E2E checked in but harmless when the environment isn't ready beats
gating it behind a separate repository.

## What's NOT covered (and why)

- **Settle / claim_matured / liquidate** — need fresh rate snapshots, tenor
  expiry, or precise collateral drainage. Too brittle for hands-off CI. Cover
  via [`anemone/scripts/test-suite-c.ts`](../../anemone/scripts/test-suite-c.ts).
- **Open swap → close early lifecycle** — same reason; the existing
  [`anemone/scripts/test-mainnet-sync.ts`](../../anemone/scripts/test-mainnet-sync.ts)
  is the right venue.
- **Liquidation bounty math** — a unit test of `calculateMaintenanceMargin`
  would be more valuable than an integration test here.

The SDK E2E exists to verify *plumbing*, not protocol semantics.
