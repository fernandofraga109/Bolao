# Plano — Painel de Estatísticas do Jogo (fixtures/statistics)

_Status_: DONE — 2026-06-16 (todas as 7 fases entregues; commits `3b7a1a6` + `467f657` na main + fork)
_Criado_: 2026-06-16

> ⚠️ Pendência operacional: aplicar a migration `0035` no Supabase antes/junto do
> deploy (guarda D — sem a coluna, o `updateMatch({ liveDetails, liveStats })` erra
> e derruba a escrita do `liveDetails`).

## Problema / Objetivo

Hoje o `MatchCard` mostra dois painéis colapsáveis ("O que a galera acha" e a
timeline de eventos via `Activity`). Queremos um **terceiro painel: Estatísticas
do jogo** (posse de bola, finalizações, escanteios, faltas, cartões, passes,
etc.) por time, alimentado pelo endpoint `fixtures/statistics?fixture={id}` da
api-sports.

Esses dados, como os de `liveDetails`, são **puramente informativos — NÃO entram
em nenhum cálculo de pontos/ranking**.

## Contexto técnico (o que já existe e reusamos)

- `matches.liveDetails.apiSportsFixtureId` já está **persistido** (migration 0031).
  O `fixtureId` necessário para o statistics já vem do `fixtures?live=all`.
- Padrão de coluna JSONB em `matches` (+ espelhos `v2_/v3_`) — migration 0031.
- Proxy edge seguro com token server-side + telemetria de cota: `api/live-details.ts`.
- **FASE 3.5 já tem TODA a mecânica de parada que precisamos** (revisão 2026-06-16):
  - roda **dentro** do `acquire_sync_lock` (serializa por competição → sem corrida);
  - gate `hasLiveMatches && (canWriteData || isBackgroundSync)`;
  - gate de throttle simples por `liveDetailsLastSync` (default 50s);
  - já **itera os fixtures ao vivo casados** (`matchLiveFixtureToInternal`) e faz
    `updateMatch(id, { liveDetails })`.
  - ⚠️ **NÃO** existe lock atômico próprio — o `acquire_live_details_lock` (0033)
    foi revertido (`5711779`) e está órfão. Não usar/replicar.
- Padrão de painel colapsável no `MatchCard`: `showFriends` / `showTimeline`.
- Padrão de normalização + tradução pt-BR: `DETAIL_PT` em `LiveMatchTimeline.tsx`.

## Decisões de design (REVISADO 2026-06-16 — abordagem simples do usuário)

1. **Piggyback na FASE 3.5 — NÃO criar throttle/lock próprios.** Dentro do mesmo
   loop que já casa os fixtures ao vivo, buscar também as estatísticas de cada
   fixture casado e gravar junto: `updateMatch(id, { liveDetails, liveStats })`.
   Reusa **as mesmas regras de parada e sequência** já existentes (lock principal +
   gate `liveDetailsLastSync` + gating ao-vivo). Menos código, menos superfície de
   bug, e como o pipeline já é serializado não há corrida a proteger.
   - ❌ Descartado: coluna `liveStatsLastSync` + RPC de lock próprios (complexidade
     desnecessária; o gate de 50s do live-details já controla a cadência).
2. **1 chamada por fixture ao vivo casado**, por ciclo do live-details (~50s). É o
   custo extra. Mitigado por: só fixtures **casados** com match interno; só enquanto
   há jogo ao vivo; mesma cadência já throttled do live-details. Se a cota apertar,
   subir o `live_details_interval_ms` (afeta os dois, aceitável).
3. **Fetch server-side no ciclo de sync, cacheado em `matches.liveStats`** (NÃO
   on-demand por usuário — isso multiplicaria chamadas por usuário). UI só lê do estado.
4. **Exibir todas as stats disponíveis**, traduzidas; ocultar as nulas.

> **Opcional (decisão do usuário):** se quisermos as stats numa cadência MAIS LENTA
> que os eventos (ex.: stats a cada 2–3 min, eventos a cada 50s), aí sim precisaria
> de um segundo gate `liveStatsLastSync`. Por ora o plano assume **mesma cadência**
> (mais simples). Reavaliar só se a cota incomodar.

## Formato do payload (fixtures/statistics?fixture=X)

```
response: [
  { team: {id,name,logo}, statistics: [ {type:"Ball Possession", value:"55%"},
                                         {type:"Total Shots", value: 12}, ... ] },
  { team: {id,name,logo}, statistics: [ ... ] }   // 2 times
]
```
Tipos comuns: Shots on Goal, Shots off Goal, Total Shots, Blocked Shots,
Shots insidebox, Shots outsidebox, Fouls, Corner Kicks, Offsides,
Ball Possession, Yellow Cards, Red Cards, Goalkeeper Saves, Total passes,
Passes accurate, Passes %, expected_goals.

## Side effects analisados & guardas (revisão 2026-06-16)

Análise de impacto nos fluxos de sync. **Seguro** (verificado): pontuação não lê
`liveStats`; boot faz `select("*")` → hidrata automático; FASE 3 preserva via
`...pureMatch` (mesmo mecanismo do `a8437a1`, **sem** código extra); gravar no
**mesmo** `updateMatch` = 1 write = 1 evento realtime; RLS já cobre o caminho.

Guardas **obrigatórias** na implementação (cada uma evita um side effect real):

| # | Side effect | Guarda |
|---|---|---|
| **A** | **Cota compartilhada** — statistics usa a MESMA chave/cota do live-details; abuso → `429` degrada o minuto-a-minuto existente | Só fixtures **casados** + só ao vivo + mesma cadência throttled (50s). Monitorar `[PROXY LIVE-STATS][QUOTA]`. |
| **B** | **Latência dentro do lock** — N awaits sequenciais seguram o `acquire_sync_lock` mais tempo | Buscar as stats dos fixtures casados em **`Promise.all`** (paralelo), não em await sequencial. |
| **C** | **Isolamento de falha** — um throw no statistics aborta o loop e para de persistir `liveDetails` dos jogos seguintes | **`try/catch` por fixture** isolando stats de eventos; falha de stats nunca derruba o live-details. |
| **D** | **Ordem migration→código** — escrever `liveStats` antes da 0035 erra coluna e, sendo o MESMO call, derruba o write de `liveDetails` | Aplicar **0035 antes** de subir a Fase 4. Incluir a chave `liveStats` no `updateMatch` **só quando houver valor** (spread condicional) — `undefined` não nula. |
| **E** | **Anti-regressão** — tick transitório com stats vazias sobrescreve stats boas (igual ao bug dos eventos, §8 sync-flow) | Só gravar `liveStats` quando o parse vier **não-vazio** (≥1 time com ≥1 stat). |

> **Acoplamento:** como reusamos o gate do live-details, subir
> `live_details_interval_ms` para aliviar a cota de stats **também** desacelera
> eventos/relógio. Se essa tensão aparecer, é o gatilho para promover o gate
> separado `liveStatsLastSync` (opcional descrito acima).

## Arquivos afetados

- **DB:** nova migration `0035_add_live_stats.sql` — **só** a coluna `liveStats jsonb`
  em matches (+ espelhos v2/v3). **SEM** `liveStatsLastSync` e **SEM** RPC de lock.
- **Proxy:** novo `api/live-stats.ts` (edge) — recebe `?fixture=` e repassa a
  api-sports (`/fixtures/statistics?fixture=`) com `x-apisports-key`. Mesma
  telemetria de cota do `live-details.ts`. + entrada `/api/live-stats` no `vite.config.ts`.
- **Types:** `types.ts` — `LiveTeamStat`, `LiveMatchStats`; campo opcional
  `liveStats` em `MatchDB` e `Match`.
- **Service:** `services/liveScoreService.ts` — `fetchLiveStats(fixtureId)` +
  `parseLiveStats(payload)`.
- **Sync:** `hooks/useSyncSystem.ts` — **dentro do loop existente da FASE 3.5**,
  para cada fixture casado: buscar stats e incluir no mesmo `updateMatch`
  (`{ liveDetails: fx.details, liveStats }`). Não-fatal (try/catch isolado por jogo
  para não derrubar o live-details se o statistics falhar).
- **Context:** `DatabaseContext.tsx` — nenhuma mudança de lock; `updateMatch` já
  aceita campos arbitrários.
- **UI:** `components/MatchCard.tsx` — novo botão (ícone `BarChart3`) + estado
  `showStats`; novo componente `components/LiveMatchStats.tsx` (barras
  comparativas home×away por estatística).
- **Docs:** novo `docs/features/live-stats.md` + índice em `docs/README.md` +
  atualizar a FASE 3.5 em `documentacao/sync-flow.md` (passa a buscar stats junto).

## Fases de execução

- **Fase 1 — Migration 0035** (backend agent): só a coluna `liveStats`. Usuário
  aplica no Supabase. Aditiva/segura.
- **Fase 2 — Proxy + Vite** (backend): `api/live-stats.ts` + entrada no vite.
- **Fase 3 — Types + Service** (backend): `parseLiveStats` + traduções pt-BR dos
  tipos de estatística (mapa análogo ao `DETAIL_PT`).
- **Fase 4 — Wiring na FASE 3.5** (backend): incluir o fetch de stats no loop que
  já existe; gravar junto no `updateMatch`. Try/catch por jogo. **Sem** novo
  throttle/lock. Degradação graciosa se a coluna faltar.
- **Fase 5 — UI** (frontend): botão + `LiveMatchStats.tsx` (barras comparativas).
- **Fase 6 — Docs** (incl. atualizar FASE 3.5) + release (changelog-updater) +
  commit/push + workflow fork.
- **Fase 7 — Testes** (test-runner): `parseLiveStats` + gating do fetch.

## Estratégia de validação

- Conferir nos logs da Vercel `[PROXY LIVE-STATS][QUOTA]`: ≤1 chamada por fixture
  por intervalo entre abas (lock funcionando).
- Comparar nº de chamadas/dia antes×depois (cota api-sports nos headers
  `x-ratelimit-*`).
- UI: abrir painel num jogo ao vivo e conferir stats coerentes com a partida.

## Riscos / rollback

- **Risco principal: cota da api-sports.** +1 call por fixture casado por ciclo do
  live-details (~50s). Mitigado por: só fixtures casados + só ao vivo + a mesma
  cadência já throttled do live-details (gate `liveDetailsLastSync`). Se apertar,
  subir `live_details_interval_ms` (afeta eventos+stats juntos) OU promover ao gate
  separado `liveStatsLastSync` (opcional descrito acima).
- **Rollback:** feature puramente aditiva. Remover o fetch dentro da FASE 3.5
  desliga as stats; a coluna pode ficar órfã sem efeito. UI esconde o botão se
  `liveStats` ausente.

## Deferido / follow-up

- Lineups (`fixtures/lineups`) — mesma mecânica, fora de escopo.
- Indicador de cota no Admin consumindo `x-quota-*` (já repassado no live-details).
- Dedupe global do fetch (endpoint é por-fixture, não por-competição) — avaliar
  se a competição-scoped lock basta.
