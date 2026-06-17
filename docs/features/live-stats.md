# Estatísticas da partida ao vivo (api-sports)

Painel de estatísticas (posse de bola, finalizações, escanteios, faltas, cartões,
passes, xG…) por time, vindo do endpoint `fixtures/statistics?fixture=` da
api-sports. Como o minuto-a-minuto, é **puramente cosmético — NÃO entra em
nenhum cálculo de pontos/ranking**.

## Onde vive

- **Coluna:** `matches.liveStats jsonb` (migration `0035`, espelhos v2/v3). Mesmo
  padrão da `liveDetails` (`0031`).
- **Proxy:** `api/live-stats.ts` (Vercel edge) + rota `/api/live-stats` no
  `vite.config.ts` (dev). Recebe `?fixture=<id>` e repassa a api-sports com
  `x-apisports-key`. **Mesma chave/cota** do `/api/live-details`.
- **Service:** `services/liveScoreService.ts` — `fetchLiveStats(fixtureId, homeApiId,
  awayApiId)` + `parseLiveStats(...)`.
- **UI:** botão `BarChart3` no `MatchCard` (só aparece se `match.liveStats`) →
  `components/LiveMatchStats.tsx` (barras comparativas mandante verde × visitante azul).

## Como é alimentado (piggyback na FASE 3.5)

Não há throttle/lock próprios. As stats são buscadas **dentro da FASE 3.5** do
`useSyncSystem`, reusando toda a mecânica de parada do minuto-a-minuto:

1. Roda dentro do `acquire_sync_lock` (serializa por competição) + gate
   `hasLiveMatches && (canWriteData || isBackgroundSync)` + throttle simples por
   `liveDetailsLastSync` (default 50s).
2. Casa os fixtures ao vivo com os jogos internos (`matchLiveFixtureToInternal`).
3. Busca as stats dos jogos casados em **`Promise.all`** (paralelo).
4. Grava no **mesmo** `updateMatch` do `liveDetails`:
   `updateMatch(id, { liveDetails, ...(stats ? { liveStats } : {}) })`.

### Guardas implementadas (ver `.claude/plans/live-stats-panel.md`)

- **A — cota compartilhada:** só fixtures casados, só ao vivo, mesma cadência do
  live-details. Monitorar `[PROXY LIVE-STATS][QUOTA]`.
- **B — latência no lock:** fetch das stats em `Promise.all`, não em série.
- **C — isolamento de falha:** `fetchLiveStats` nunca lança (retorna `null`); falha
  de stats nunca derruba a persistência do `liveDetails`.
- **D — ordem migration→código:** chave `liveStats` só entra no `updateMatch` quando
  há valor (spread condicional); `undefined` não nula a coluna. Aplicar `0035` antes.
- **E — anti-regressão:** `parseLiveStats` retorna `null` em payload vazio → não
  sobrescreve stats boas com vazio.

## Alinhamento mandante/visitante

A resposta da api-sports é um array de 2 times sem marcar home/away. `parseLiveStats`
alinha por `team.id` (api-sports) contra `homeApiId`/`awayApiId` do fixture casado,
com fallback por ordem (`[home, away]`) quando os ids não batem.

## Preservação no sync (sem código extra)

`liveStats` é hidratado no boot via `select("*")` e preservado pela FASE 3 ao
espalhar `...pureMatch` no upsert de jogos existentes — mesmo mecanismo que protege
`liveDetails` (commit `a8437a1`). Nenhuma lógica de preservação adicional é necessária.
