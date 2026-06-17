# Sistema de Sync

> Detalhamento das chamadas externas e do fluxo Supabase (fase a fase) em
> `docs/architecture/external-api-calls.md`.
>
> **Fluxo end-to-end com diagramas** (gatilhos, endpoints, locks, condições de
> parada e a integração da api-football no minuto-a-minuto): ver
> **`documentacao/sync-flow.md`**.

## Funcionamento Atual

- `hooks/useSyncSystem.ts` (`syncMatchesAndStandings`) é o **pipeline único** de
  sync: busca 4 endpoints da Football-Data em paralelo (`teams`, `matches`,
  `standings`, `scorers`) + `live-matches` (condicional) e grava o resultado no
  Supabase.
- **Dois gatilhos** disparam o pipeline:
  - **Sync manual** — botão no Painel de Admin (`canWriteData`).
  - **Background sync** — `hooks/useBackgroundSync.ts`, que roda para **qualquer
    usuário logado** no intervalo `sync_interval_ms` (default 5 min), gateado pelo
    `lastSync` da competição.
- Um **lock distribuído** no banco (`acquire_sync_lock` / `sync_locked_at`)
  garante que **só um cliente** sincroniza por vez, mesmo com várias abas abertas.
- **FASE 3.5 — minuto-a-minuto (api-sports):** com jogo ao vivo, o pipeline também
  chama `/api/live-details` (`fetchLiveMatchDetails`) e grava `matches.liveDetails`
  (relógio, eventos, árbitro, estádio — **cosmético**, não pontua). É controlado por
  um **gate de throttle simples** (`competitions.liveDetailsLastSync`, default 50s)
  **dentro** do lock principal — não há lock próprio (o `acquire_live_details_lock`
  da migration `0033` foi revertido em `5711779` e está órfão). Detalhe end-to-end
  em `documentacao/sync-flow.md`.
- `hooks/usePollingRefresh.ts` (15 s) **não** chama a API externa — só relê o
  Supabase para refletir mudanças no placar/ranking.
- Supabase Realtime faz push das mudanças para os clientes conectados.

## Limitação Conhecida

**A automação só funciona enquanto há pelo menos uma aba do app aberta** por algum
usuário logado (admin para sync manual; qualquer usuário para background sync). Se
nenhum browser estiver aberto, as partidas não são atualizadas até que alguém abra
o app novamente. **Não há sync 24/7 independente de navegador.**

## Solução Futura

Para sync 24/7 independente do navegador:
- Migrar para **Supabase Edge Function**
- Agendar usando extensão **pg_cron** do PostgreSQL
- Ver `.claude/plans/edge-functions-migration.md`

## Proxy CORS

- Football Data API deve ser chamada pelo proxy (`/api/*`), nunca direto do frontend
- Dev: proxy do Vite (`vite.config.ts`); Produção: Vercel Edge Functions (`api/*.ts`)
- O token `FOOTBALL_DATA_TOKEN` é injetado no servidor — nunca vai ao browser
