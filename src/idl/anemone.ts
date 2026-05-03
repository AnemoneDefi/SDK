/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/anemone.json`.
 */
export type Anemone = {
  "address": "KQs6ci5FtedFKPVJThAZSMMXyosK4TvnF7kcDSx5Jwd",
  "metadata": {
    "name": "anemone",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addCollateral",
      "discriminator": [
        127,
        82,
        121,
        42,
        161,
        176,
        249,
        206
      ],
      "accounts": [
        {
          "name": "market",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "swapPosition",
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault — destination of the added USDC"
          ],
          "writable": true
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC)"
          ]
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "Owner's token account — source of the added collateral"
          ],
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimMatured",
      "discriminator": [
        153,
        42,
        194,
        25,
        118,
        63,
        215,
        10
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "swapPosition",
          "writable": true
        },
        {
          "name": "lpVault",
          "docs": [
            "LP vault — source of any unpaid_pnl catchup before claim."
          ],
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault — source of the matured collateral"
          ],
          "writable": true
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "Owner's token account — receives collateral_remaining"
          ],
          "writable": true
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC)"
          ]
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "kaminoDepositAccount",
          "writable": true
        },
        {
          "name": "kaminoReserve",
          "docs": [
            "Kamino reserve — typed as AccountLoader so we can read live exchange",
            "rate fields needed to convert the USDC shortfall into a k-USDC",
            "collateral amount before invoking `redeem_reserve_collateral`",
            "(Finding 10 fix). The CPI also writes to it, hence `mut`."
          ],
          "writable": true
        },
        {
          "name": "kaminoLendingMarket"
        },
        {
          "name": "kaminoLendingMarketAuthority"
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "liquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "kaminoProgram"
        }
      ],
      "args": []
    },
    {
      "name": "closePositionEarly",
      "discriminator": [
        43,
        56,
        118,
        28,
        75,
        211,
        91,
        172
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "swapPosition",
          "writable": true
        },
        {
          "name": "lpVault",
          "docs": [
            "LP vault — source/dest for mark-to-market PnL settlement"
          ],
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault — holds the trader margin"
          ],
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury — receives the 5% early close fee"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC)"
          ]
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "Owner's token account — receives remainder after fee"
          ],
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "kaminoDepositAccount",
          "writable": true
        },
        {
          "name": "kaminoReserve",
          "docs": [
            "Kamino reserve — typed as AccountLoader so the handler can read the",
            "live exchange rate to convert USDC shortfall into k-USDC collateral",
            "before invoking `redeem_reserve_collateral` (Finding 10 fix)."
          ],
          "writable": true
        },
        {
          "name": "kaminoLendingMarket"
        },
        {
          "name": "kaminoLendingMarketAuthority"
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "liquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "kaminoProgram"
        }
      ],
      "args": []
    },
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "underlyingReserve"
              },
              {
                "kind": "arg",
                "path": "tenorSeconds"
              }
            ]
          }
        },
        {
          "name": "lpVault",
          "docs": [
            "LP vault: holds USDC in transit during settlements"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault: holds trader collateral"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  108,
                  108,
                  97,
                  116,
                  101,
                  114,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "lpMint",
          "docs": [
            "LP token mint: receipt tokens for liquidity providers"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "kaminoDepositAccount",
          "docs": [
            "Kamino deposit account: holds k-tokens (collateral from Kamino deposits)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  107,
                  97,
                  109,
                  105,
                  110,
                  111,
                  95,
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "kaminoCollateralMint",
          "docs": [
            "The Kamino collateral mint (k-token, e.g. k-USDC)"
          ]
        },
        {
          "name": "underlyingReserve",
          "docs": [
            "The lending protocol's reserve account (e.g. Kamino USDC Reserve)"
          ]
        },
        {
          "name": "underlyingProtocol",
          "docs": [
            "The lending protocol's program ID (e.g. Kamino K-Lend program)"
          ]
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The token mint for this market (e.g. USDC mint)"
          ]
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "tenorSeconds",
          "type": "i64"
        },
        {
          "name": "settlementPeriodSeconds",
          "type": "i64"
        },
        {
          "name": "maxUtilizationBps",
          "type": "u16"
        },
        {
          "name": "baseSpreadBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "depositLiquidity",
      "discriminator": [
        245,
        99,
        59,
        25,
        151,
        71,
        233,
        249
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "lpPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "depositor"
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "lpVault",
          "docs": [
            "LP vault — PDA-controlled token account that holds USDC"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "LP token mint — program mints shares to depositor"
          ],
          "writable": true
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC) — needed for transfer_checked"
          ]
        },
        {
          "name": "depositorTokenAccount",
          "docs": [
            "Depositor's USDC token account (source of funds)"
          ],
          "writable": true
        },
        {
          "name": "depositorLpTokenAccount",
          "docs": [
            "Depositor's LP token account (receives minted shares)"
          ],
          "writable": true
        },
        {
          "name": "depositor",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "depositToKamino",
      "discriminator": [
        107,
        90,
        118,
        214,
        59,
        19,
        144,
        80
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "keeper",
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "lpVault",
          "docs": [
            "Our LP vault — source of USDC"
          ],
          "writable": true
        },
        {
          "name": "kaminoDepositAccount",
          "docs": [
            "Our kamino deposit account — receives k-tokens"
          ],
          "writable": true
        },
        {
          "name": "kaminoReserve",
          "docs": [
            "Kamino Reserve (e.g. USDC Reserve)"
          ],
          "writable": true
        },
        {
          "name": "kaminoLendingMarket",
          "docs": [
            "Kamino LendingMarket"
          ]
        },
        {
          "name": "kaminoLendingMarketAuthority",
          "docs": [
            "Kamino LendingMarket authority PDA"
          ]
        },
        {
          "name": "reserveLiquidityMint",
          "docs": [
            "USDC mint (reserve liquidity mint)"
          ]
        },
        {
          "name": "reserveLiquiditySupply",
          "docs": [
            "Kamino's USDC vault"
          ],
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "docs": [
            "k-USDC mint (reserve collateral mint)"
          ],
          "writable": true
        },
        {
          "name": "collateralTokenProgram",
          "docs": [
            "Token program for k-tokens"
          ]
        },
        {
          "name": "liquidityTokenProgram",
          "docs": [
            "Token program for USDC"
          ]
        },
        {
          "name": "instructionSysvarAccount",
          "docs": [
            "Instructions sysvar"
          ]
        },
        {
          "name": "kaminoProgram",
          "docs": [
            "Kamino K-Lend program — must match market.underlying_protocol"
          ]
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeProtocol",
      "discriminator": [
        188,
        233,
        252,
        106,
        134,
        146,
        202,
        91
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury token account. Anchor validates it deserializes as a token",
            "account here so admin typos surface at init instead of at the first",
            "fee transfer (Finding 8). Mint isn't checked at init because the",
            "protocol's underlying mint is set per-market — downstream handlers",
            "(open_swap, request_withdrawal, etc.) enforce",
            "`token::mint = underlying_mint` against this same address."
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "protocolFeeBps",
          "type": "u16"
        },
        {
          "name": "openingFeeBps",
          "type": "u16"
        },
        {
          "name": "liquidationFeeBps",
          "type": "u16"
        },
        {
          "name": "withdrawalFeeBps",
          "type": "u16"
        },
        {
          "name": "earlyCloseFeeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "liquidatePosition",
      "discriminator": [
        187,
        74,
        229,
        149,
        102,
        81,
        221,
        68
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "swapPosition",
          "writable": true
        },
        {
          "name": "lpVault",
          "docs": [
            "LP vault — source/dest for mark-to-market PnL settled on liquidation"
          ],
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault — source of fee + remainder, and dest/source for MtM"
          ],
          "writable": true
        },
        {
          "name": "owner",
          "docs": [
            "Owner of the position — receives rent on close, no signer required"
          ],
          "writable": true
        },
        {
          "name": "ownerTokenAccount",
          "docs": [
            "Owner's token account — receives remainder after liquidation fee"
          ],
          "writable": true
        },
        {
          "name": "liquidatorTokenAccount",
          "docs": [
            "Liquidator's token account — receives the liquidator's share of the",
            "liquidation fee (2/3 of the total)."
          ],
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury — receives the protocol's share of the liquidation fee",
            "(1/3 of the total). Same address as `protocol_state.treasury`."
          ],
          "writable": true
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC)"
          ]
        },
        {
          "name": "liquidator",
          "docs": [
            "Anyone can liquidate (permissionless — earns the liquidator's 2/3",
            "share of liquidation_fee_bps as incentive; the remaining 1/3 goes",
            "to treasury)."
          ],
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "kaminoDepositAccount",
          "writable": true
        },
        {
          "name": "kaminoReserve",
          "docs": [
            "Kamino reserve — typed as AccountLoader so the handler can read the",
            "live exchange rate to convert USDC shortfall into k-USDC collateral",
            "before invoking `redeem_reserve_collateral` (Finding 10 fix)."
          ],
          "writable": true
        },
        {
          "name": "kaminoLendingMarket"
        },
        {
          "name": "kaminoLendingMarketAuthority"
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "liquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "kaminoProgram"
        }
      ],
      "args": []
    },
    {
      "name": "openSwap",
      "discriminator": [
        109,
        109,
        21,
        132,
        201,
        76,
        67,
        113
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "swapPosition",
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault — holds trader margin deposits"
          ],
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury — receives opening fee"
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC)"
          ]
        },
        {
          "name": "traderTokenAccount",
          "docs": [
            "Trader's token account (source of collateral + fee)"
          ],
          "writable": true
        },
        {
          "name": "trader",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "direction",
          "type": {
            "defined": {
              "name": "swapDirection"
            }
          }
        },
        {
          "name": "notional",
          "type": "u64"
        },
        {
          "name": "nonce",
          "type": "u8"
        },
        {
          "name": "maxRateBps",
          "type": "u64"
        },
        {
          "name": "minRateBps",
          "type": "u64"
        }
      ]
    },
    {
      "name": "pauseMarket",
      "discriminator": [
        216,
        238,
        4,
        164,
        65,
        11,
        162,
        91
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "pauseProtocol",
      "discriminator": [
        144,
        95,
        0,
        107,
        119,
        39,
        248,
        141
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "requestWithdrawal",
      "discriminator": [
        251,
        85,
        121,
        205,
        56,
        201,
        12,
        177
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "lpPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "withdrawer"
              },
              {
                "kind": "account",
                "path": "market"
              }
            ]
          }
        },
        {
          "name": "lpVault",
          "docs": [
            "LP vault that holds USDC"
          ],
          "writable": true
        },
        {
          "name": "lpMint",
          "docs": [
            "LP token mint — program burns shares"
          ],
          "writable": true
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC)"
          ]
        },
        {
          "name": "withdrawerLpTokenAccount",
          "docs": [
            "Withdrawer's LP token account (source — burns from here)"
          ],
          "writable": true
        },
        {
          "name": "withdrawerTokenAccount",
          "docs": [
            "Withdrawer's USDC token account (destination)"
          ],
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury token account — receives withdrawal fee, must match protocol"
          ],
          "writable": true
        },
        {
          "name": "withdrawer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "kaminoDepositAccount",
          "writable": true
        },
        {
          "name": "kaminoReserve",
          "docs": [
            "Kamino reserve — must match `market.underlying_reserve`. Typed as",
            "AccountLoader so we can read the live exchange rate fields needed to",
            "convert the requested USDC shortfall into a k-USDC collateral amount",
            "before invoking `redeem_reserve_collateral`. The CPI also writes back",
            "to the reserve, hence `mut`."
          ],
          "writable": true
        },
        {
          "name": "kaminoLendingMarket"
        },
        {
          "name": "kaminoLendingMarketAuthority"
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "liquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "kaminoProgram"
        }
      ],
      "args": [
        {
          "name": "sharesToBurn",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setKeeper",
      "discriminator": [
        102,
        94,
        23,
        78,
        157,
        222,
        243,
        214
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": [
        {
          "name": "newKeeper",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setRateIndexOracle",
      "docs": [
        "Admin-only utility for clusters where Kamino K-Lend is not deployed",
        "(localnet/devnet) and for surfpool E2E that need to drive rate-index",
        "state to specific values (e.g. organic-liquidation tests). Feature-",
        "gated so mainnet builds do NOT include it — see [features] in",
        "programs/anemone/Cargo.toml. On mainnet, rate index comes exclusively",
        "from `update_rate_index` reading Kamino state."
      ],
      "discriminator": [
        150,
        13,
        37,
        93,
        3,
        206,
        73,
        171
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": [
        {
          "name": "rateIndex",
          "type": "u128"
        }
      ]
    },
    {
      "name": "settlePeriod",
      "discriminator": [
        115,
        57,
        95,
        16,
        21,
        107,
        129,
        130
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "swapPosition",
          "writable": true
        },
        {
          "name": "lpVault",
          "docs": [
            "LP vault — pays trader profits / receives trader losses"
          ],
          "writable": true
        },
        {
          "name": "collateralVault",
          "docs": [
            "Collateral vault — holds trader margin and the protocol-fee source"
          ],
          "writable": true
        },
        {
          "name": "treasury",
          "docs": [
            "Treasury — receives the per-period protocol fee on the spread leg.",
            "Same address as `protocol_state.treasury`; mint must match the",
            "market's underlying mint."
          ],
          "writable": true,
          "relations": [
            "protocolState"
          ]
        },
        {
          "name": "underlyingMint",
          "docs": [
            "The underlying token mint (e.g. USDC) — needed for transfer_checked"
          ]
        },
        {
          "name": "caller",
          "docs": [
            "Anyone can call settlement (permissionless — incentivizes keepers)"
          ],
          "signer": true
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "syncKaminoYield",
      "discriminator": [
        128,
        113,
        51,
        252,
        183,
        226,
        166,
        35
      ],
      "accounts": [
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "kaminoReserve",
          "docs": [
            "Kamino Reserve — must match the market's underlying_reserve. The",
            "AccountLoader handles deserialization for the post-refresh read."
          ],
          "writable": true
        },
        {
          "name": "kaminoDepositAccount",
          "docs": [
            "Our k-token balance — the input to the USDC-value math."
          ]
        },
        {
          "name": "kaminoLendingMarket"
        },
        {
          "name": "pythOracle",
          "docs": [
            "is configured for a different price source."
          ]
        },
        {
          "name": "switchboardPriceOracle"
        },
        {
          "name": "switchboardTwapOracle"
        },
        {
          "name": "scopePrices",
          "docs": [
            "configured price source)."
          ]
        },
        {
          "name": "kaminoProgram"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "unpauseMarket",
      "discriminator": [
        219,
        203,
        199,
        170,
        212,
        45,
        170,
        80
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "unpauseProtocol",
      "discriminator": [
        183,
        154,
        5,
        183,
        105,
        76,
        87,
        18
      ],
      "accounts": [
        {
          "name": "protocolState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "protocolState"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "updateRateIndex",
      "discriminator": [
        191,
        173,
        63,
        26,
        197,
        186,
        0,
        246
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "kaminoReserve",
          "docs": [
            "Kamino Reserve account — must match what the market was created with."
          ]
        },
        {
          "name": "keeper",
          "docs": [
            "Layer 1 of the rate-index-collapse defense (see SECURITY.md Finding 2).",
            "Permissionless update_rate_index lets an attacker bundle two calls in",
            "a single tx so both reads see the same Kamino bsf — the rotation then",
            "collapses `previous_rate_index == current_rate_index`, and the next",
            "open_swap quotes apy = 0 against PayFixed for ~spread bps. Gating to",
            "the keeper closes the trivial path; layer 2 (no-op rotation reject)",
            "and layer 3 (open_swap apy=0 reject) cover keeper-bot misfires and",
            "future regressions."
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "withdrawFromKamino",
      "discriminator": [
        177,
        144,
        191,
        109,
        204,
        151,
        38,
        176
      ],
      "accounts": [
        {
          "name": "protocolState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  116,
                  111,
                  99,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "keeper",
          "docs": [
            "Keeper-only. After PRs #26+#27 added internal Kamino redeem to every",
            "user-facing exit path (claim_matured, close_position_early,",
            "liquidate_position, claim_withdrawal/request_withdrawal), the",
            "trader/LP no longer needs this ix as a self-rescue lane. Leaving it",
            "permissionless would let an attacker spam-call to keep funds parked",
            "in lp_vault instead of earning Kamino yield (SECURITY.md Finding 3).",
            "Keeper-gated mirrors the existing constraint on deposit_to_kamino."
          ],
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "market.underlying_reserve",
                "account": "swapMarket"
              },
              {
                "kind": "account",
                "path": "market.tenor_seconds",
                "account": "swapMarket"
              }
            ]
          }
        },
        {
          "name": "lpVault",
          "docs": [
            "Our LP vault — receives USDC back from Kamino"
          ],
          "writable": true
        },
        {
          "name": "kaminoDepositAccount",
          "docs": [
            "Our kamino deposit account — source of k-tokens to redeem"
          ],
          "writable": true
        },
        {
          "name": "kaminoReserve",
          "writable": true
        },
        {
          "name": "kaminoLendingMarket"
        },
        {
          "name": "kaminoLendingMarketAuthority"
        },
        {
          "name": "reserveLiquidityMint"
        },
        {
          "name": "reserveLiquiditySupply",
          "writable": true
        },
        {
          "name": "reserveCollateralMint",
          "writable": true
        },
        {
          "name": "collateralTokenProgram"
        },
        {
          "name": "liquidityTokenProgram"
        },
        {
          "name": "instructionSysvarAccount"
        },
        {
          "name": "kaminoProgram",
          "docs": [
            "Kamino K-Lend program — must match market.underlying_protocol"
          ]
        }
      ],
      "args": [
        {
          "name": "collateralAmount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "lpPosition",
      "discriminator": [
        105,
        241,
        37,
        200,
        224,
        2,
        252,
        90
      ]
    },
    {
      "name": "protocolState",
      "discriminator": [
        33,
        51,
        173,
        134,
        35,
        140,
        195,
        248
      ]
    },
    {
      "name": "reserve",
      "discriminator": [
        43,
        242,
        204,
        202,
        26,
        247,
        59,
        127
      ]
    },
    {
      "name": "swapMarket",
      "discriminator": [
        1,
        225,
        114,
        244,
        211,
        158,
        72,
        82
      ]
    },
    {
      "name": "swapPosition",
      "discriminator": [
        65,
        203,
        85,
        175,
        129,
        154,
        6,
        152
      ]
    }
  ],
  "events": [
    {
      "name": "lpWithdrawal",
      "discriminator": [
        252,
        217,
        243,
        187,
        155,
        99,
        164,
        209
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidReserve",
      "msg": "Kamino reserve does not match market's underlying_reserve"
    },
    {
      "code": 6001,
      "name": "invalidRateIndex",
      "msg": "Rate index cannot be zero"
    },
    {
      "code": 6002,
      "name": "invalidElapsedTime",
      "msg": "Elapsed time must be positive"
    },
    {
      "code": 6003,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6004,
      "name": "marketPaused",
      "msg": "Market is paused"
    },
    {
      "code": 6005,
      "name": "invalidVault",
      "msg": "Invalid vault address"
    },
    {
      "code": 6006,
      "name": "invalidMint",
      "msg": "Invalid mint address"
    },
    {
      "code": 6007,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6008,
      "name": "insufficientShares",
      "msg": "Insufficient shares for withdrawal"
    },
    {
      "code": 6009,
      "name": "poolUndercollateralized",
      "msg": "Withdrawal would leave pool undercollateralized"
    },
    {
      "code": 6010,
      "name": "staleOracle",
      "msg": "Reserve data is stale — refresh before updating rate"
    },
    {
      "code": 6011,
      "name": "utilizationExceeded",
      "msg": "Pool utilization would exceed maximum allowed"
    },
    {
      "code": 6012,
      "name": "insufficientCollateral",
      "msg": "Insufficient collateral for required initial margin"
    },
    {
      "code": 6013,
      "name": "rateIndexNotInitialized",
      "msg": "Rate index not initialized — keeper must update rate first"
    },
    {
      "code": 6014,
      "name": "settlementNotDue",
      "msg": "Settlement period has not elapsed yet"
    },
    {
      "code": 6015,
      "name": "positionNotOpen",
      "msg": "Position is not open"
    },
    {
      "code": 6016,
      "name": "slippageExceeded",
      "msg": "Offered rate exceeds trader's slippage tolerance"
    },
    {
      "code": 6017,
      "name": "positionNotMatured",
      "msg": "Position is not matured — cannot claim yet"
    },
    {
      "code": 6018,
      "name": "aboveMaintenanceMargin",
      "msg": "Position is above maintenance margin — cannot liquidate"
    },
    {
      "code": 6019,
      "name": "invalidAuthority",
      "msg": "Invalid authority — caller is not the protocol keeper"
    },
    {
      "code": 6020,
      "name": "insufficientVaultLiquidity",
      "msg": "LP vault liquidity is insufficient for this claim — keeper must rebalance"
    },
    {
      "code": 6021,
      "name": "rateMoveTooLarge",
      "msg": "Rate index growth between settlements exceeds the circuit-breaker cap"
    },
    {
      "code": 6022,
      "name": "paramOutOfRange",
      "msg": "Parameter exceeds its protocol-level safety cap"
    },
    {
      "code": 6023,
      "name": "unsupportedMintExtensions",
      "msg": "Mint uses an unsupported token program (only classic SPL Token allowed in v1)"
    },
    {
      "code": 6024,
      "name": "staleNav",
      "msg": "LP NAV snapshot is stale — bundle sync_kamino_yield in the same transaction"
    },
    {
      "code": 6025,
      "name": "unpaidPnlOutstanding",
      "msg": "Position has unpaid PnL owed by the LP vault — wait for keeper to refill and settle again"
    },
    {
      "code": 6026,
      "name": "protocolPaused",
      "msg": "Protocol is paused — admin has blocked new swaps and LP deposits"
    }
  ],
  "types": [
    {
      "name": "bigFractionBytes",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "value",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                2
              ]
            }
          }
        ]
      }
    },
    {
      "name": "borrowRateCurve",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "points",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "curvePoint"
                  }
                },
                11
              ]
            }
          }
        ]
      }
    },
    {
      "name": "curvePoint",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "utilizationRateBps",
            "type": "u32"
          },
          {
            "name": "borrowRateBps",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "lastUpdate",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "stale",
            "type": "u8"
          },
          {
            "name": "priceStatus",
            "type": "u8"
          },
          {
            "name": "placeholder",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          }
        ]
      }
    },
    {
      "name": "lpPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isInitialized",
            "type": "bool"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "depositedAmount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "lpStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "lpStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "withdrawn"
          }
        ]
      }
    },
    {
      "name": "lpWithdrawal",
      "docs": [
        "Audit-trail event for every LP withdrawal. Indexers subscribe to this",
        "via Anchor's event listener (or parse program logs by tx) to build the",
        "historical record. Replaces the on-chain `withdrawal_requested_at` /",
        "`withdrawal_amount` fields that the queued path used to keep — events",
        "give a richer log per withdrawal at zero on-chain cost."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "withdrawer",
            "type": "pubkey"
          },
          {
            "name": "sharesBurned",
            "type": "u64"
          },
          {
            "name": "grossAmount",
            "type": "u64"
          },
          {
            "name": "netAmount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "kaminoRedeemedUsdc",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "positionStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "matured"
          },
          {
            "name": "liquidated"
          },
          {
            "name": "closedEarly"
          }
        ]
      }
    },
    {
      "name": "priceHeuristic",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lower",
            "type": "u64"
          },
          {
            "name": "upper",
            "type": "u64"
          },
          {
            "name": "exp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "protocolState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "keeperAuthority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "totalMarkets",
            "type": "u64"
          },
          {
            "name": "protocolFeeBps",
            "docs": [
              "10% performance fee on LP spread (1000 = 10%)"
            ],
            "type": "u16"
          },
          {
            "name": "openingFeeBps",
            "docs": [
              "0.05% on notional when opening swap (5 = 0.05%)"
            ],
            "type": "u16"
          },
          {
            "name": "liquidationFeeBps",
            "docs": [
              "3% on remaining margin at liquidation (300 = 3%)"
            ],
            "type": "u16"
          },
          {
            "name": "withdrawalFeeBps",
            "docs": [
              "0.05% on LP withdrawal (5 = 0.05%)"
            ],
            "type": "u16"
          },
          {
            "name": "earlyCloseFeeBps",
            "docs": [
              "5% on collateral returned when trader closes early (500 = 5%)"
            ],
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "paused",
            "docs": [
              "Global kill switch. When true, `open_swap` and `deposit_liquidity`",
              "reject — no new capital enters the system. Settlement, liquidation,",
              "Kamino sync, early close, claim, and LP withdrawals stay live so",
              "admin cannot freeze user funds in-flight."
            ],
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "pythConfiguration",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "price",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "reserve",
      "docs": [
        "Account: Reserve"
      ],
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u64"
          },
          {
            "name": "lastUpdate",
            "type": {
              "defined": {
                "name": "lastUpdate"
              }
            }
          },
          {
            "name": "lendingMarket",
            "type": "pubkey"
          },
          {
            "name": "farmCollateral",
            "type": "pubkey"
          },
          {
            "name": "farmDebt",
            "type": "pubkey"
          },
          {
            "name": "liquidity",
            "type": {
              "defined": {
                "name": "reserveLiquidity"
              }
            }
          },
          {
            "name": "reserveLiquidityPadding",
            "type": {
              "array": [
                "u64",
                150
              ]
            }
          },
          {
            "name": "collateral",
            "type": {
              "defined": {
                "name": "reserveCollateral"
              }
            }
          },
          {
            "name": "reserveCollateralPadding",
            "type": {
              "array": [
                "u64",
                150
              ]
            }
          },
          {
            "name": "config",
            "type": {
              "defined": {
                "name": "reserveConfig"
              }
            }
          },
          {
            "name": "configPadding",
            "type": {
              "array": [
                "u64",
                116
              ]
            }
          },
          {
            "name": "borrowedAmountOutsideElevationGroup",
            "type": "u64"
          },
          {
            "name": "borrowedAmountsAgainstThisReserveInElevationGroups",
            "type": {
              "array": [
                "u64",
                32
              ]
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                207
              ]
            }
          }
        ]
      }
    },
    {
      "name": "reserveCollateral",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mintPubkey",
            "type": "pubkey"
          },
          {
            "name": "mintTotalSupply",
            "type": "u64"
          },
          {
            "name": "supplyVault",
            "type": "pubkey"
          },
          {
            "name": "padding1",
            "type": {
              "array": [
                "u128",
                32
              ]
            }
          },
          {
            "name": "padding2",
            "type": {
              "array": [
                "u128",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "reserveConfig",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "assetTier",
            "type": "u8"
          },
          {
            "name": "hostFixedInterestRateBps",
            "type": "u16"
          },
          {
            "name": "reserved2",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          },
          {
            "name": "reserved3",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          },
          {
            "name": "protocolTakeRatePct",
            "type": "u8"
          },
          {
            "name": "protocolLiquidationFeePct",
            "type": "u8"
          },
          {
            "name": "loanToValuePct",
            "type": "u8"
          },
          {
            "name": "liquidationThresholdPct",
            "type": "u8"
          },
          {
            "name": "minLiquidationBonusBps",
            "type": "u16"
          },
          {
            "name": "maxLiquidationBonusBps",
            "type": "u16"
          },
          {
            "name": "badDebtLiquidationBonusBps",
            "type": "u16"
          },
          {
            "name": "deleveragingMarginCallPeriodSecs",
            "type": "u64"
          },
          {
            "name": "deleveragingThresholdDecreaseBpsPerDay",
            "type": "u64"
          },
          {
            "name": "fees",
            "type": {
              "defined": {
                "name": "reserveFees"
              }
            }
          },
          {
            "name": "borrowRateCurve",
            "type": {
              "defined": {
                "name": "borrowRateCurve"
              }
            }
          },
          {
            "name": "borrowFactorPct",
            "type": "u64"
          },
          {
            "name": "depositLimit",
            "type": "u64"
          },
          {
            "name": "borrowLimit",
            "type": "u64"
          },
          {
            "name": "tokenInfo",
            "type": {
              "defined": {
                "name": "tokenInfo"
              }
            }
          },
          {
            "name": "depositWithdrawalCap",
            "type": {
              "defined": {
                "name": "withdrawalCaps"
              }
            }
          },
          {
            "name": "debtWithdrawalCap",
            "type": {
              "defined": {
                "name": "withdrawalCaps"
              }
            }
          },
          {
            "name": "elevationGroups",
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "disableUsageAsCollOutsideEmode",
            "type": "u8"
          },
          {
            "name": "utilizationLimitBlockBorrowingAbovePct",
            "type": "u8"
          },
          {
            "name": "autodeleverageEnabled",
            "type": "u8"
          },
          {
            "name": "reserved1",
            "type": {
              "array": [
                "u8",
                1
              ]
            }
          },
          {
            "name": "borrowLimitOutsideElevationGroup",
            "type": "u64"
          },
          {
            "name": "borrowLimitAgainstThisCollateralInElevationGroup",
            "type": {
              "array": [
                "u64",
                32
              ]
            }
          },
          {
            "name": "deleveragingBonusIncreaseBpsPerDay",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "reserveFees",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "borrowFeeSf",
            "type": "u64"
          },
          {
            "name": "flashLoanFeeSf",
            "type": "u64"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          }
        ]
      }
    },
    {
      "name": "reserveLiquidity",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mintPubkey",
            "type": "pubkey"
          },
          {
            "name": "supplyVault",
            "type": "pubkey"
          },
          {
            "name": "feeVault",
            "type": "pubkey"
          },
          {
            "name": "availableAmount",
            "type": "u64"
          },
          {
            "name": "borrowedAmountSf",
            "type": "u128"
          },
          {
            "name": "marketPriceSf",
            "type": "u128"
          },
          {
            "name": "marketPriceLastUpdatedTs",
            "type": "u64"
          },
          {
            "name": "mintDecimals",
            "type": "u64"
          },
          {
            "name": "depositLimitCrossedTimestamp",
            "type": "u64"
          },
          {
            "name": "borrowLimitCrossedTimestamp",
            "type": "u64"
          },
          {
            "name": "cumulativeBorrowRateBsf",
            "type": {
              "defined": {
                "name": "bigFractionBytes"
              }
            }
          },
          {
            "name": "accumulatedProtocolFeesSf",
            "type": "u128"
          },
          {
            "name": "accumulatedReferrerFeesSf",
            "type": "u128"
          },
          {
            "name": "pendingReferrerFeesSf",
            "type": "u128"
          },
          {
            "name": "absoluteReferralRateSf",
            "type": "u128"
          },
          {
            "name": "tokenProgram",
            "type": "pubkey"
          },
          {
            "name": "padding2",
            "type": {
              "array": [
                "u64",
                51
              ]
            }
          },
          {
            "name": "padding3",
            "type": {
              "array": [
                "u128",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "scopeConfiguration",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "priceFeed",
            "type": "pubkey"
          },
          {
            "name": "priceChain",
            "type": {
              "array": [
                "u16",
                4
              ]
            }
          },
          {
            "name": "twapChain",
            "type": {
              "array": [
                "u16",
                4
              ]
            }
          }
        ]
      }
    },
    {
      "name": "swapDirection",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "payFixed"
          },
          {
            "name": "receiveFixed"
          }
        ]
      }
    },
    {
      "name": "swapMarket",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "protocolState",
            "type": "pubkey"
          },
          {
            "name": "underlyingProtocol",
            "type": "pubkey"
          },
          {
            "name": "underlyingReserve",
            "type": "pubkey"
          },
          {
            "name": "underlyingMint",
            "type": "pubkey"
          },
          {
            "name": "lpVault",
            "type": "pubkey"
          },
          {
            "name": "kaminoDepositAccount",
            "type": "pubkey"
          },
          {
            "name": "collateralVault",
            "type": "pubkey"
          },
          {
            "name": "lpMint",
            "type": "pubkey"
          },
          {
            "name": "tenorSeconds",
            "type": "i64"
          },
          {
            "name": "settlementPeriodSeconds",
            "type": "i64"
          },
          {
            "name": "maxUtilizationBps",
            "docs": [
              "6000 = 60%"
            ],
            "type": "u16"
          },
          {
            "name": "baseSpreadBps",
            "type": "u16"
          },
          {
            "name": "lpNav",
            "docs": [
              "Net asset value of the LP pool in underlying-token decimals. Tracks",
              "\"how much USDC the LPs collectively have claim to\", including yield",
              "accrued via sync_kamino_yield and PnL settled against the lp_vault.",
              "`shares * lp_nav / total_lp_shares` is the redeemable USDC per share."
            ],
            "type": "u64"
          },
          {
            "name": "totalLpShares",
            "type": "u64"
          },
          {
            "name": "totalFixedNotional",
            "type": "u64"
          },
          {
            "name": "totalVariableNotional",
            "type": "u64"
          },
          {
            "name": "previousRateIndex",
            "type": "u128"
          },
          {
            "name": "previousRateUpdateTs",
            "type": "i64"
          },
          {
            "name": "currentRateIndex",
            "type": "u128"
          },
          {
            "name": "lastRateUpdateTs",
            "type": "i64"
          },
          {
            "name": "totalOpenPositions",
            "type": "u64"
          },
          {
            "name": "totalKaminoCollateral",
            "type": "u64"
          },
          {
            "name": "lastKaminoSnapshotUsdc",
            "docs": [
              "Last known USDC value of the k-tokens in `kamino_deposit_account`.",
              "Updated by `sync_kamino_yield`; the diff since this snapshot becomes",
              "credited yield in lp_nav. Separate from `total_kamino_collateral`",
              "(which tracks the raw k-token balance, not the USDC value)."
            ],
            "type": "u64"
          },
          {
            "name": "lastKaminoSyncTs",
            "docs": [
              "Unix timestamp of the most recent `sync_kamino_yield` call. User-facing",
              "LP handlers require this to be recent via MAX_NAV_STALENESS_SECS so",
              "deposits and withdrawals always price against a fresh NAV. On devnet",
              "(stub-oracle mode) this is bumped by a no-op sync — there is no Kamino",
              "yield to accrue, but the timestamp still marks \"fresh enough\"."
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "swapPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "direction",
            "type": {
              "defined": {
                "name": "swapDirection"
              }
            }
          },
          {
            "name": "notional",
            "type": "u64"
          },
          {
            "name": "fixedRateBps",
            "type": "u64"
          },
          {
            "name": "spreadBpsAtOpen",
            "docs": [
              "Spread component locked into `fixed_rate_bps` at open time. The",
              "quoted rate is `current_apy_bps ± spread_bps`; storing the spread",
              "separately lets `settle_period` charge the protocol fee against the",
              "deterministic spread payment regardless of which direction the",
              "variable rate moved (Finding 11 follow-up — protocol_fee_bps wiring)."
            ],
            "type": "u64"
          },
          {
            "name": "collateralDeposited",
            "type": "u64"
          },
          {
            "name": "collateralRemaining",
            "type": "u64"
          },
          {
            "name": "entryRateIndex",
            "type": "u128"
          },
          {
            "name": "lastSettledRateIndex",
            "type": "u128"
          },
          {
            "name": "realizedPnl",
            "type": "i64"
          },
          {
            "name": "numSettlements",
            "type": "u16"
          },
          {
            "name": "unpaidPnl",
            "docs": [
              "Trader PnL credit that the lp_vault could not cover at the moment of",
              "settlement/close/liquidation. Kept as i64 for symmetry but in practice",
              "only takes values >= 0 — the trader-loss path is capped by",
              "`collateral_remaining`, so shortfalls only arise when the trader is",
              "*owed* money and the vault is drained. Next settle_period tries to",
              "drain this first (catchup), and claim_matured / close_position_early",
              "refuse to finalize while it's non-zero. Addressed together with the",
              "keeper's pendingWithdrawals job extension that refills the vault",
              "whenever sum(unpaid_pnl) + pending LP withdrawals exceeds what the",
              "vault holds."
            ],
            "type": "i64"
          },
          {
            "name": "openTimestamp",
            "type": "i64"
          },
          {
            "name": "maturityTimestamp",
            "type": "i64"
          },
          {
            "name": "nextSettlementTs",
            "type": "i64"
          },
          {
            "name": "lastSettlementTs",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "positionStatus"
              }
            }
          },
          {
            "name": "nonce",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "switchboardConfiguration",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "priceAggregator",
            "type": "pubkey"
          },
          {
            "name": "twapAggregator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tokenInfo",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "heuristic",
            "type": {
              "defined": {
                "name": "priceHeuristic"
              }
            }
          },
          {
            "name": "maxTwapDivergenceBps",
            "type": "u64"
          },
          {
            "name": "maxAgePriceSeconds",
            "type": "u64"
          },
          {
            "name": "maxAgeTwapSeconds",
            "type": "u64"
          },
          {
            "name": "scopeConfiguration",
            "type": {
              "defined": {
                "name": "scopeConfiguration"
              }
            }
          },
          {
            "name": "switchboardConfiguration",
            "type": {
              "defined": {
                "name": "switchboardConfiguration"
              }
            }
          },
          {
            "name": "pythConfiguration",
            "type": {
              "defined": {
                "name": "pythConfiguration"
              }
            }
          },
          {
            "name": "blockPriceUsage",
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                7
              ]
            }
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                19
              ]
            }
          }
        ]
      }
    },
    {
      "name": "withdrawalCaps",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "configCapacity",
            "type": "i64"
          },
          {
            "name": "currentTotal",
            "type": "i64"
          },
          {
            "name": "lastIntervalStartTimestamp",
            "type": "u64"
          },
          {
            "name": "configIntervalLengthSeconds",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
