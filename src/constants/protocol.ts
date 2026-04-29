/** USDC token decimals */
export const USDC_DECIMALS = 6;

/** LP token decimals */
export const LP_MINT_DECIMALS = 6;

/** Byte offset of cumulative_borrow_rate_bsf in Kamino Reserve account data */
export const KAMINO_RATE_OFFSET = 296;

/** Maximum stale slots before Kamino reserve is considered stale (~5 min) */
export const KAMINO_MAX_STALE_SLOTS = 750;

/** Seconds in a day — default settlement period */
export const SECONDS_PER_DAY = 86_400;

/** Seconds in 30 days — default tenor */
export const TENOR_30_DAYS = 30 * SECONDS_PER_DAY;

/** Seconds in 90 days */
export const TENOR_90_DAYS = 90 * SECONDS_PER_DAY;

/** Max utilization (fixed+variable notional vs LP deposits): 60% */
export const DEFAULT_MAX_UTILIZATION_BPS = 6_000;

/** Base spread in bps: 0.5% */
export const DEFAULT_BASE_SPREAD_BPS = 50;

/** Default max leverage for traders */
export const DEFAULT_MAX_LEVERAGE = 20;

/** PDA seeds */
export const SEEDS = {
  PROTOCOL: "protocol",
  MARKET: "market",
  LP_VAULT: "lp_vault",
  COLLATERAL_VAULT: "collateral_vault",
  LP_MINT: "lp_mint",
  KAMINO_DEPOSIT: "kamino_deposit",
  LP_POSITION: "lp",
  POSITION: "position",
} as const;
