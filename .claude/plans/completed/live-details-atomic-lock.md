# Plano — Lock atômico para a api-football (minuto-a-minuto)

_Status_: DONE — 2026-06-14

## Problema

A chamada à api-football (api-sports, `/api/live-details`, FASE 3.5 do `runSync`) é
gastadora de cota (orçamento ~20 chamadas/jogo). Hoje ela é "protegida" por:

1. **Lock distribuído do sync** (`acquire_sync_lock`) — atômico no Postgres, mas
   serializa o **sync inteiro**, não a chamada à api-football especificamente.
2. **Throttle do live-details** — `if (elapsedSinceLive >= live_details_interval_ms)`
   lendo `comp.liveDetailsLastSync` do **estado React local** (não atômico).

### Brechas (por que o lock não protege bem a api-football)

- **B1 — Throttle não-atômico:** o check lê estado local, não DB fresco. Dois clientes
  com `liveDetailsLastSync` desatualizado (Realtime atrasado) podem ambos decidir
  "já passou" e ambos chamar a api-sports. Não existe check-and-set atômico como no sync.
- **B2 — Escopo por-competição vs endpoint global:** `/api/live-details` busca sempre
  `league=1` (global), mas o throttle/loop são por-competição. >1 competição ativa =
  N chamadas para o mesmo dado. (Inofensivo p/ bolão de 1 competição.)
- **B3 — TTL do lock (60s) vs duração do sync:** se o sync passar de 60s, o lock expira
  no meio e outro cliente pode rodar concorrente → 2ª chamada à api-football.

## Solução

Dar à api-football o **mesmo tratamento atômico do sync**: uma RPC
`acquire_live_details_lock(code, interval_ms)` que faz check-and-set atômico em
`competitions."liveDetailsLastSync"` numa única operação no banco. Fecha B1 e B3.

> Escopo: mantém **por-competição** (igual ao `acquire_sync_lock`), conforme pedido
> ("igual temos pro sync"). B2 (dedupe global) fica como follow-up deferido.

## Arquivos afetados

- `database/migrations/0033_acquire_live_details_lock.sql` (novo) — RPC `acquire_live_details_lock`
  + `v2_acquire_live_details_lock` (espelha o padrão da 0026).
- `contexts/DatabaseContext.tsx` — novo método `acquireLiveDetailsLock(code, intervalMs): Promise<boolean>`
  (espelha `acquireSyncLock`, usa o prefixo `VITE_DB_TABLE_PREFIX`). Atualiza estado
  local de `competitions` no sucesso.
- `hooks/useSyncSystem.ts` (FASE 3.5) — substitui o `if (elapsedSinceLive >= ...)` +
  `updateCompetitionLiveDetailsSync` pós-fetch por `acquireLiveDetailsLock(...)`.

## Design da RPC

```sql
UPDATE competitions
SET "liveDetailsLastSync" = NOW()
WHERE code = p_competition_code
  AND ("liveDetailsLastSync" IS NULL
       OR "liveDetailsLastSync" < (NOW() - (p_interval_ms || ' milliseconds')::interval));
-- RETURN ROW_COUNT > 0
```

- Seta o timestamp **antes** do fetch (atômico). Se o fetch falhar, não re-tenta no
  intervalo — aceitável (dado cosmético, mesma filosofia do sync lock).
- `RETURN true` => este cliente ganhou o direito de chamar a api-football agora.

## Fases

1. Migration 0033 (backend).
2. `acquireLiveDetailsLock` no DatabaseContext.
3. Trocar FASE 3.5 do `useSyncSystem` para usar o lock atômico.
4. `tsc` limpo + invocar `test-runner` para cobrir a RPC/fluxo.

## Validação

- Logs: `[PROXY LIVE-DETAILS][QUOTA]` (Vercel) deve mostrar ≤1 chamada por intervalo;
  proporção `throttle ativo` vs `api-sports OK` no console do cliente.
- Confirmar que com 2 abas abertas só uma chama a api-football por intervalo.

## Riscos / rollback

- RPC precisa existir no schema em uso (`public` e/ou `dev`/`test` + variante `v2_`).
  Operacional: aplicar a migration nos schemas certos. Se a RPC faltar,
  `acquireLiveDetailsLock` retorna `false` (erro logado) → live-details simplesmente
  não atualiza (degradação graciosa, sem quebrar o sync principal).
- Rollback: reverter FASE 3.5 para o throttle local; dropar as funções.

## Follow-up deferido

- B2: dedupe **global** do live-details (endpoint é `league=1`, não por-competição).
- Limpeza: `updateCompetitionLiveDetailsSync` fica órfã após a troca — remover depois.
