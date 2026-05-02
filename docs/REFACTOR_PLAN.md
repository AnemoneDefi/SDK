# SDK Refactor Plan — alinhamento com o programa Anemone

**Data:** 2026-04-29
**Estado atual:** SDK compila (`tsc --noEmit` limpo) mas está severamente desatualizado em relação ao programa Anchor em `anemone/programs/anemone/`. A maioria das instruções vai falhar em runtime por contas/campos faltando.

## Causa raiz

A IDL em `SDK/idl/anemone.json` nunca foi regenerada desde a versão inicial. O programa evoluiu (16 instruções novas, campos novos em `ProtocolState` e `SwapMarket`, troca de signer `authority`→`keeper` em duas instruções keeper) e o SDK ficou para trás.

`tsc` não detecta isso porque os métodos do Anchor (`program.methods.X.accounts(Y).rpc()`) são tipados como `any`. Os erros só aparecem quando a instrução é enviada e o validator rejeita.

## Fora de escopo

- Wallet adapter / browser bundle (concern do frontend, não do SDK)
- Indexer / Postgres layer (Bucket 2 — outro módulo)
- Reescrever a arquitetura DDD existente (entities/repositories/use-cases) — apenas atualizar o conteúdo

## Fases

### Fase 1 — Fundação: IDL + tipos gerados

Sem isso nada mais funciona, porque os use-cases novos precisam dos tipos.

1. Copiar IDL canônica e tipos:
   ```
   cp anemone/target/idl/anemone.json SDK/idl/anemone.json
   cp anemone/target/types/anemone.ts SDK/src/idl/anemone.ts
   ```
2. Reexportar tipo `Anemone` em `SDK/src/index.ts`.
3. Trocar `Program<any>` por `Program<Anemone>` em:
   - `src/infrastructure/anchor/AnemoneProgram.ts`
   - todos os use-cases em `src/application/use-cases/**`
4. `npx tsc --noEmit` — agora deve quebrar nos use-cases que têm contas/args errados. **É esperado**. Lista esses erros como entrada da Fase 4.

### Fase 2 — Domain entities

Atualizar pra refletir os structs Rust atuais.

**`src/domain/entities/Protocol.ts`**
- ADD `keeperAuthority: string` (de `protocol.rs:6`)
- ADD `paused: boolean` (de `protocol.rs:24`)

**`src/domain/entities/Market.ts`**
- ADD `lpNav: bigint` (de `market.rs:46`)
- ADD `previousRateIndex: bigint` (de `market.rs:50`)
- ADD `previousRateUpdateTs: bigint` (de `market.rs:51`)
- ADD `totalKaminoCollateral: bigint` (de `market.rs:56`)
- ADD `lastKaminoSnapshotUsdc: bigint` (de `market.rs:62`)
- ADD `lastKaminoSyncTs: bigint` (de `market.rs:68`)
- REMOVE `maxLeverage` (não existe no programa)
- REMOVE `pendingWithdrawals` (não existe)
- REMOVE `totalLpDeposits` (substituído por `lpNav`)

**`src/domain/entities/LpPosition.ts`**
- REMOVE `withdrawalRequestedAt` (legacy — agora vive em event `LpWithdrawal`)
- REMOVE `withdrawalAmount` (idem)
- Confirmar que campos restantes batem com `state/lp.rs`

**`src/domain/entities/SwapPosition.ts`**
- ADD `unpaidPnl: bigint` (de `state/position.rs:48`)
- Trocar comentário "Phase 2 — not yet deployed" pra atual; struct agora existe e está em produção

### Fase 3 — Repositories

Atualizar mappers raw→entity:

**`src/infrastructure/repositories/ProtocolRepository.ts`** linhas 16-26: incluir `keeperAuthority` e `paused`.

**`src/infrastructure/repositories/MarketRepository.ts`** linhas 9-37: incluir os 6 campos novos, remover os 3 fantasma.

**`src/infrastructure/repositories/PositionRepository.ts`**: incluir `unpaidPnl` no mapping de SwapPosition; remover campos legacy do mapping de LpPosition.

### Fase 4 — Use-cases (ordem de prioridade)

Cada subseção lista o que *adicionar* no `.accountsStrict()` e qualquer mudança de signer. Fonte da verdade é o `#[derive(Accounts)]` da instrução em Rust.

#### 4.1 Atualizar use-cases existentes (CRITICAL)

**`UpdateRateIndex.ts`** — programa: `instructions/keeper/update_rate_index.rs`
- ADD `protocolState`
- ADD `keeper` (Signer; era omitido)
- Renomear arg do método se houver

**`DepositToKamino.ts`** — programa: `instructions/keeper/deposit_to_kamino.rs`
- ADD `protocolState`
- Trocar `authority` por `keeper` (signer)
- ADD `reserveLiquidityMint`
- ADD `collateralTokenProgram`
- ADD `liquidityTokenProgram`
- ADD `instructionSysvarAccount`

**`WithdrawFromKamino.ts`** — programa: `instructions/keeper/withdraw_from_kamino.rs`
- Mesmas mudanças do DepositToKamino (signer keeper + contas Kamino completas)

**`DepositLiquidity.ts`** — programa: `instructions/lp/deposit_liquidity.rs`
- ADD `protocolState` (necessário pra checagem `paused` e staleness NAV)
- ADD `underlyingMint`

**`RequestWithdrawal.ts`** — programa: `instructions/lp/request_withdrawal.rs`
- ADD `protocolState`
- ADD bloco completo de Kamino redeem-on-shortfall: `kaminoDepositAccount`, `kaminoReserve`, `kaminoLendingMarket`, `kaminoLendingMarketAuthority`, `reserveLiquidityMint`, `reserveLiquiditySupply`, `reserveCollateralMint`, `collateralTokenProgram`, `liquidityTokenProgram`, `instructionSysvarAccount`, `kaminoProgram`, `underlyingMint`

#### 4.2 Use-cases novos a criar (admin)

**`SetKeeper.ts`** — `instructions/admin/set_keeper.rs`
- Args: `newKeeper: PublicKey`
- Contas: `protocolState`, `authority` (Signer)

**`PauseProtocol.ts` / `UnpauseProtocol.ts`** — `instructions/admin/pause_protocol.rs` (e correspondente)
- Args: nenhum
- Contas: `protocolState`, `authority` (Signer)

**`PauseMarket.ts` / `UnpauseMarket.ts`** — admin
- Contas: `protocolState`, `market`, `authority` (Signer)

#### 4.3 Use-cases novos a criar (keeper)

**`SyncKaminoYield.ts`** — `instructions/keeper/sync_kamino_yield.rs`
- Args: nenhum
- Contas: `protocolState`, `market`, `keeper` (Signer), `kaminoReserve`, `kaminoDepositAccount`

#### 4.4 Use-cases novos a criar (trader) — SUITE COMPLETA

Hoje o SDK não tem **nada** de trader. Sem isso o SDK é inútil pro frontend.

**`OpenSwap.ts`** — `instructions/trader/open_swap.rs`
- Args: `direction`, `notional`, `nonce`, `maxRateBps`, `minRateBps`
- Contas: `protocolState`, `market`, `swapPosition`, `collateralVault`, `trader` (Signer), `traderTokenAccount`, `traderCollateralAccount`, `tokenProgram`, `systemProgram`, `treasury`

**`AddCollateral.ts`** — `instructions/trader/add_collateral.rs`
- Args: `amount`
- Contas: `market`, `swapPosition`, `collateralVault`, `trader` (Signer), `traderTokenAccount`, `tokenProgram`

**`SettlePeriod.ts`** — `instructions/trader/settle_period.rs`
- Args: nenhum
- Contas: `market`, `swapPosition`, `collateralVault`, `lpVault`, `treasury`, `caller` (Signer), `tokenProgram` (~9 contas)

**`ClosePositionEarly.ts`** — `instructions/trader/close_position_early.rs` (~22 contas)

**`ClaimMatured.ts`** — `instructions/trader/claim_matured.rs` (~19 contas)

**`LiquidatePosition.ts`** — `instructions/trader/liquidate_position.rs` (~23 contas — keeper recebe 3% de bounty)

### Fase 5 — Constants cleanup

`src/constants/protocol.ts`:
- REMOVE `DEFAULT_MAX_LEVERAGE` (não existe no programa)

Verificar `KAMINO_RATE_OFFSET = 296` contra `helpers/kamino.rs` — alguém precisa abrir o helper e confirmar.

### Fase 6 — Anemone.ts (fachada)

`src/Anemone.ts` precisa expor todos os use-cases novos. Adicionar:
- `admin.setKeeper`, `admin.pauseProtocol`, `admin.unpauseProtocol`, `admin.pauseMarket`, `admin.unpauseMarket`
- `keeper.syncKaminoYield`
- Bloco `trader.*` inteiro (6 use-cases)

### Fase 7 — Testes

Resposta direta da pergunta "SDK se testa?": **sim, em 3 camadas**.

#### Camada 1 — Unit puro (já existe parcialmente; manter)

Para lógica que não chama o programa:
- PDA derivers — verificar que `PdaDeriver.market(reserve, tenor)` retorna o address correto contra um conjunto de seeds conhecido
- Entity mappers — input raw account → output Protocol/Market/SwapPosition
- Helpers de margin/fee se forem espelhados em TS

Rápido (ms), zero infra.

#### Camada 2 — Mock-based use-case tests (apertar os existentes)

Os testes atuais (ex: `DepositLiquidity.test.ts`) só verificam que `rpc()` foi chamado e que `signature` retornou. **Não verificam quais contas foram passadas.** Isso é exatamente o que deixou o drift passar despercebido.

Apertar pra cada use-case:
```typescript
it("passes the exact accounts the program expects", async () => {
  await useCase.execute({...});
  const accountsArg = program.methods.depositLiquidity.mock.calls[0][...];
  expect(Object.keys(accountsArg).sort()).toEqual([
    "protocolState", "market", "lpPosition", "lpVault", "lpMint",
    "depositorTokenAccount", "depositorLpTokenAccount", "depositor",
    "underlyingMint", "systemProgram", "tokenProgram",
  ].sort());
});
```

Isso quebra automaticamente quando alguém adiciona/remove conta da instrução no programa.

#### Camada 3 — Conformidade de IDL (NOVO — recomendo adicionar)

Teste programático que carrega `idl/anemone.json` e, para cada use-case, valida que o conjunto de contas que o use-case envia bate com a lista de `accounts` da instrução na IDL.

```typescript
import idl from "../../idl/anemone.json";

describe("IDL conformance", () => {
  it.each(idl.instructions)("$name use-case sends all required accounts", (ix) => {
    const useCaseAccounts = collectAccountsFromUseCase(ix.name);
    const idlAccounts = ix.accounts.map(a => a.name);
    expect(useCaseAccounts.sort()).toEqual(idlAccounts.sort());
  });
});
```

Esse teste é a **rede de segurança** contra drift futuro. Quando o programa atualizar a IDL e o `cp` rodar, o teste quebra antes de chegar a runtime.

#### Camada 4 — E2E contra surfpool/localnet (recomendo pelo menos para fluxos críticos)

Setup já existe no `anemone/scripts/test-mainnet-sync.ts` e similares. Replicar em `SDK/tests/e2e/` ou rodar diretamente do anemone:

- **Lifecycle LP**: deposit → request_withdrawal → claim
- **Lifecycle swap**: open → settle (×2) → close_early
- **Liquidation**: open → drain colateral → liquidate

3 testes E2E cobrem 80% do valor. Cada um leva ~30s contra surfpool. Skip em CI rápido, rodar antes de cortar release.

#### Sugestão prática para hackathon

- Camada 1: já tem, manter
- Camada 2: apertar os 6 testes existentes para validar accounts (1-2h)
- Camada 3: 1 teste de conformidade que cobre todos (1h)
- Camada 4: 3 cenários E2E (meio dia)

Pular Camada 2 exaustiva (cada arg, cada erro) — Camada 3 + 4 já cobrem.

## Ordem de execução recomendada

1. **Fase 1** (foundation) — não pula. Sem IDL nova, nada mais compila.
2. **Fase 7 Camada 3** — escrever o teste de conformidade *primeiro*. Vai falhar com a lista exata do que precisa ser adicionado. Vira a checklist viva da Fase 4.
3. **Fase 2** (entities) e **Fase 3** (repositories) — em paralelo, são edits independentes.
4. **Fase 4.1** (5 use-cases existentes desalinhados) — corrigir um por um, rodando o teste de conformidade após cada um.
5. **Fase 4.2 + 4.3** (admin + keeper novos) — fáceis, ~30 min cada.
6. **Fase 4.4** (trader suite) — maior volume de trabalho. 6 use-cases. Estimativa 4-6h.
7. **Fase 5** (constants) e **Fase 6** (fachada) — cleanup final.
8. **Fase 7 Camada 4** (E2E) — última, depois que tudo compila.

## Checklist de verificação

- [ ] `tsc --noEmit` passa
- [ ] `vitest run` passa todos os testes (incluindo conformidade IDL)
- [ ] Cada instrução do programa tem use-case correspondente no SDK
- [ ] `Anemone.ts` fachada expõe todos os use-cases
- [ ] E2E contra surfpool: lifecycle LP funciona
- [ ] E2E contra surfpool: lifecycle swap funciona
- [ ] E2E contra surfpool: liquidation funciona
- [ ] README atualizado com lista completa de instruções suportadas

## Estimativa total

- Fase 1: 30min
- Fase 2-3: 1h
- Fase 4.1: 2h
- Fase 4.2-4.3: 1.5h
- Fase 4.4: 4-6h
- Fase 5-6: 1h
- Fase 7 (testes): 4h

**Total: ~14-16h de trabalho focado.**
