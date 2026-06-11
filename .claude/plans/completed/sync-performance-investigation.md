# Plano: Investigação de Performance do Sync (latência 30–40s)

**Status:** DONE — 2026-06-11. Fase 2 VALIDADA — total ~20s → ~7.3s; `user_groups_recalc` 15.85s → 3.90s (~4×). Recálculo ainda é a maior fase (53%); backlog opcional para ir além (deferido, ver `sync-call-reduction.md`).
**Branch sugerida:** `perf/sync-profiling`
**Complementa:** `.claude/plans/sync-call-reduction.md`
**Spec de referência:** `docs/architecture/external-api-calls.md` (§4 pipeline, §5 fluxo Supabase)

---

## Problema

A duração de uma execução de `syncMatchesAndStandings` **varia de ~30s a ~40s**,
sem causa óbvia. Antes de otimizar, precisamos **medir** onde o tempo é gasto:
chamada externa, escrita no banco, recálculo de pontos, etc.

> **Relação com `sync-call-reduction.md`:** aquele plano corta o número de
> **chamadas externas**. Este investiga o **tempo total** — incluindo o lado
> **Supabase** (muitos round-trips sequenciais). São complementares: um reduz
> *quantas* chamadas, o outro reduz *quanto tempo* cada fase leva.

---

## Hipóteses (a confirmar com dados)

O pipeline (ver spec §4) faz **muitas escritas sequenciais** no Supabase, cada uma
um round-trip de rede. Suspeitos de dominar/variar o tempo:

| # | Suspeito | Por quê | Como se manifesta no profiler |
|---|---|---|---|
| H1 | **Latência da API externa** (`api_fetch`) | Plano free + cold start do proxy/Edge na Vercel; 4 chamadas paralelas → a mais lenta dita o tempo | `api` alto/variável |
| H2 | **Adoção de times órfãos em loop** (Fase 2, "Passo 1") | Faz **1 `UPDATE` por payload** num `for` — N round-trips quando há muitos times novos | `teams_upsert` alto em alguns syncs |
| H3 | **Recálculo de pontos** (`batchProcessPointsForMatches`) | Processa **todos** os jogos `FINISHED` toda vez (idempotente, mas lê predictions + escreve) | `points_recalc` alto e crescente conforme o torneio avança |
| H4 | **Recálculo de `user_groups`** (`recalculateUserGroupPoints`) | Lê predictions (paginado 1000/linha) + upsert por grupo | `user_groups_recalc` alto |
| H5 | **Lock distribuído** (`acquire`/`release`) | 2 round-trips extra (RPC + update) | `lock` não-desprezível |
| H6 | **Variância de rede ao Supabase** | Muitos upserts pequenos sequenciais somam latência variável | `db_write` total alto e instável entre execuções |

---

## Fase 0 — Instrumentação ✅ (implementada nesta sessão)

- **`utils/syncProfiler.ts`** — classe `SyncProfiler` leve (`performance.now`),
  marca intervalos por fase e emite ao final:
  - `console.table` **por fase** (ms + %);
  - `console.table` **agregado por categoria** (`api` / `db_write` / `db_read` / `cpu` / `lock`);
  - linha `[SYNC PERF] <code> — total <ms>ms`.
- **`hooks/useSyncSystem.ts`** — marcações inseridas em todas as fronteiras de fase:
  `lock_acquire` → `setup` → `api_fetch` → `ranking_map` → `upsert_competition` →
  `persist_scorers` → `teams_upsert` → `goal_records` → `hydrate_matches` →
  `live_minutes` → `match_diff` → `matches_upsert` → `points_recalc` →
  `standings_upsert` → `user_groups_recalc` → `lock_release`.
- Custo desprezível, sem I/O. O resumo sai **sempre** (sucesso ou erro) via `finally`.

### Mapa fase → categoria (o que o usuário pediu: "busca api, carrega no banco, recalcula pontos, salva no banco")

| Categoria | Fases | Interpretação |
|---|---|---|
| `api` | `api_fetch`, `live_minutes` | **Busca na API externa** |
| `db_write` | `upsert_competition`, `persist_scorers`, `teams_upsert`, `goal_records`, `matches_upsert`, `standings_upsert` | **Salva no banco** |
| `db_write` (pontos) | `points_recalc`, `user_groups_recalc` | **Recalcula pontos** (lê + escreve) |
| `cpu` | `setup`, `ranking_map`, `hydrate_matches`, `match_diff` | Processamento local (diff, hidratação) |
| `lock` | `lock_acquire`, `lock_release` | Lock distribuído |

---

## Fase 1 — Resultados da coleta ✅ (gargalo identificado)

Bastou **1 sync** para o gargalo ficar inequívoco. Dados reais (sync sem jogo, total ~20s):

| Fase | Categoria | ms | % |
|---|---|---:|---:|
| **`user_groups_recalc`** | **db_write** | **15.849** | **79%** |
| `api_fetch` | api | 1.798 | 9% |
| `lock_acquire` + `lock_release` | lock | 1.235 | 6% |
| `standings_upsert` | db_write | 364 | 2% |
| `upsert_competition` | db_write | 346 | 2% |
| `ranking_map` | cpu | 320 | 2% |
| `match_diff` | cpu | 97 | 0% |
| demais (`persist_scorers`, `teams_upsert`, `goal_records`, `hydrate_matches`, `live_minutes`, `matches_upsert`, `points_recalc`, `setup`) | — | ~8 total | 0% |

Agregado por categoria: **`db_write` 83%** · `api` 9% · `lock` 6% · `cpu` 2%.

### Conclusão (culpado único e claro)

- **`recalculateUserGroupPoints` (Fase 5 do sync) = 79% do tempo total.** Tudo o
  mais é ruído. Não há necessidade de coletar mais amostras: a variação 30↔40s é
  função do número de grupos × round-trips dessa função.
- `points_recalc` (Fase 4b) deu ~0ms **neste** sync porque nenhum jogo mudou
  (`batchProcessPointsForMatches` não disparou recálculo interno). O custo medido
  é puramente a chamada da Fase 5 sobre **todos** os grupos da competição.

### Causa-raiz (lendo `hooks/usePointsProcessor.ts`)

`recalculateUserGroupPoints` era **duplamente sequencial**:
1. **Grupos em série** — `for (const groupId of uniqueGroupIds)` com `await` dentro.
2. **Dentro de cada grupo, ~6 round-trips sequenciais** ao Supabase:
   `predictions` → `tournament_predictions` → `extra_phase_predictions` →
   `competitions` → `user_groups` → (`players`) — um esperando o outro.
3. **`competitions` era buscada 1×POR grupo**, mesmo todos compartilhando a mesma
   competição (fetch redundante).

Custo ≈ `N_grupos × ~6 round-trips × latência`. Com ~10 grupos e ~250ms/round-trip,
chega aos ~15s medidos.

---

## Fase 2 — Otimização implementada (behavior-preserving) ✅

> ⚠️ **Nota de processo:** esta otimização foi implementada **antes** da revisão do
> usuário (deveria ter passado pelo gate da Fase 1). Mantida a pedido do usuário,
> documentada aqui para revisão. A lógica de pontuação **não** foi alterada — só I/O.

**Arquivo:** `hooks/usePointsProcessor.ts` → `recalculateUserGroupPoints`.

Mudanças (apenas reorganização de I/O, cálculo idêntico):
1. **Reads independentes em paralelo** dentro de cada grupo — `predictions`,
   `tournament_predictions`, `extra_phase_predictions`, `user_groups` e a
   competição num único `Promise.all` (era 5 round-trips em série).
2. **Cache da competição entre grupos** — `getCompetition(code)` cacheia a
   *Promise* por código; grupos da mesma competição dividem **1** requisição
   (era 1 fetch redundante por grupo).
3. **Grupos em paralelo com concorrência limitada** — novo helper
   `mapWithConcurrency(items, 6, fn)` substitui o `for ... await` sequencial
   (limite 6 para não inundar o Supabase).
4. `continue` → `return` na função extraída `processGroup`; `members` agora vem
   do `Promise.all` (removido o fetch duplicado do passo 8).

**Por que é seguro:** nenhuma fórmula de pontuação tocada; cada grupo escreve só
suas próprias linhas (`user_groups`/`predictions` por `groupId`), sem conflito
entre execuções paralelas; competição cacheada retorna o mesmo dado.

**Ganho esperado:** de `N × 6` round-trips sequenciais para `~ceil(N/6)` ondas de
~1–2 round-trips → estimativa **~15.8s → ~1–3s** (a confirmar com nova medição).

### Validação

- `tsc` limpo (apenas os 5 erros pré-existentes de `DatabaseContext.tsx`).
- Suíte: **177 passed**, 13 todo; as 2 falhas restantes são as **pré-existentes**
  de `useLeaderboard.test.ts` (não relacionadas a `usePointsProcessor`).
- **Medição confirmada ✅** — `[SYNC PERF]` antes vs depois (mesmo cenário, sem jogo):

| Fase | Antes | Depois | Δ |
|---|---:|---:|---:|
| **`user_groups_recalc`** | **15.849ms (79%)** | **3.903ms (53%)** | **−75% (~4×)** |
| `api_fetch` | 1.798ms (9%) | 2.023ms (28%) | ~igual (subiu de % por o total cair) |
| `lock` (acq+rel) | 1.235ms (6%) | 760ms (10%) | menor |
| `standings_upsert` | 364ms | 282ms | ~igual |
| **TOTAL** | **~20.0s** | **~7.3s** | **−63%** |

> O recálculo deixou de ser dominante em valor absoluto (15.8s → 3.9s), mas
> **ainda é a maior fase** (53%). `api_fetch` agora é o 2º (28%) — alvo natural do
> `sync-call-reduction.md`. Para reduzir os 3.9s restantes, ver backlog abaixo.

### Otimizações candidatas restantes (NÃO implementadas — backlog)

| Alvo | Otimização | Quando vale |
|---|---|---|
| H3 `points_recalc` / H4 redundância | `batchProcessPointsForMatches` chama `recalculateUserGroupPoints` e a Fase 5 chama de novo p/ todos os grupos → **recálculo potencialmente duplo**. Avaliar deduplicar. | Se aparecer custo em syncs com jogo finalizado |
| H4 escopo | Recalcular só grupos com prediction afetada, não todos da competição | Se `N_grupos` crescer muito |
| H1 `api_fetch` | Reduzir nº de chamadas (ver `sync-call-reduction.md`) | `api` passar a dominar após este fix |
| H5 `lock` | Skip/encurtar lock em sync no-op | `lock` (~6%) virar relevante |

---

## Estratégia de Validação

- Comparar medianas por fase **antes vs depois** de cada otimização (mesma
  instrumentação `SyncProfiler`).
- Garantir **paridade funcional**: placares, ranking, classificação, artilharia e
  prêmios idênticos antes/depois.
- Testes de regressão do pipeline via `test-runner` (os `it.todo` de
  `useSyncSystem.test.ts` cobrem ordem das fases e gates).

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Paralelizar escritas com dependência oculta (ex.: FK competição→times) | Alto | Mapear dependências da spec §4 antes; só paralelizar fases comprovadamente independentes |
| Otimização prematura sem dados | Médio | Fase 1 é **gate**: nada de otimizar antes de medir |
| Logs poluindo o console em produção | Baixo | `SyncProfiler.log()` é um resumo por sync; se incomodar, gatear por `import.meta.env.DEV` ou flag |

---

## Deferred / Follow-up

- [ ] Persistir métricas do `SyncProfiler` em telemetria (ex.: tabela `sync_metrics` ou audit log) para histórico além do console.
- [ ] Gatear o `profiler.log()` por env/flag se o ruído no console incomodar em prod.
- [ ] Portar instrumentação para a Edge Function quando `edge-functions-migration.md` avançar.

---

## Checklist de Conclusão

- [x] Fase 0 — `SyncProfiler` + marcações em todas as fases do pipeline
- [x] Fase 1 — gargalo identificado: `recalculateUserGroupPoints` = 79% (`db_write` 83%)
- [x] Fase 2 — otimização I/O implementada (paralelização + cache de competição); `tsc` limpo, 177 testes passando
- [x] **Revisão do usuário** da Fase 2 (mantida a pedido, documentada para revisão)
- [x] Validação antes/depois com nova medição `[SYNC PERF]` — total ~20s → ~7.3s; recálculo 15.8s → 3.9s
- [ ] (Opcional) Reduzir os 3.9s restantes do recálculo via backlog (dedup recálculo duplo / escopo por grupo afetado)
- [ ] Usuário confirma melhora percebida no uso real
