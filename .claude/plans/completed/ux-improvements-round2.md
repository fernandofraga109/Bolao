# UX Improvements — Round 2

_Status: DONE — 2026-05-16 — branch `feat/ux-improvements-round2` — migration 0006 pendente no Supabase_

## Context

Four targeted UX improvements after v1.4.0. No new pages or routes.

---

## Feature 1 — "O que a galera acha": excluir self + badge de pontos

**Root cause:** `leaderboardData` incluía o próprio user (UUID, não 'me' — o check era dead code). Sem badge de pontos por amigo quando jogo estava ao vivo/finalizado.

**Files changed:**
- `components/MatchCard.tsx` — prop `currentUserId`, filter `f.id !== currentUserId`, badge `+Xpts`/`0pts` via `calculatePoints`, `max-h-48` → `max-h-64`
- `components/pages/MatchesPage.tsx` — `currentUserId` adicionado a `MatchGroupProps`, propagado nas 3 instâncias de `<MatchGroup>`

---

## Feature 2 — Pontos + Rank no modal do avatar

**Root cause:** `Header.tsx` recebia `userPoints`/`userRank` como props mas o modal não os usava. Stats só visíveis no desktop (`hidden sm:flex`).

**Files changed:**
- `components/Header.tsx` — bloco de Pontos + Rank adicionado no modal (não-admin), separado por `border-b`

---

## Feature 3 — Pull-to-Refresh

**Root cause:** Outros participantes faziam palpites mas não apareciam — Realtime pode perder eventos; não havia forma de forçar re-fetch manual sem ser admin.

**Fix:** Pull-to-refresh chama `refetchMatches()` + `refetchPredictions()` direto do Supabase (bypass cache + Realtime gaps). NÃO chama `onManualSync` (Football Data API — admin-only).

**Files changed/created:**
- `hooks/usePullToRefresh.ts` — novo hook com touch events (threshold 40px, damping 0.5x)
- `components/ui/PullToRefreshIndicator.tsx` — indicador visual com rotação e spinner
- `components/pages/MatchesPage.tsx` — integração via `onRefreshData` prop
- `App.tsx` — `handleRefreshData` adicionado, passado como `onRefreshData`

---

## Feature 4 — tournament_predictions com groupId

**Root cause:** PK era apenas `userId` — palpites especiais eram globais entre todos os grupos do user.

**Files changed/created:**
- `database/migrations/0006_tournament_predictions_group.sql` — PK muda de `userId` → `(userId, groupId)`; idempotente com `IF EXISTS`/`IF NOT EXISTS`
- `types.ts` — `groupId: string` adicionado a `TournamentPredictionDB`
- `contexts/DatabaseContext.tsx` — upsert usa `onConflict: "userId,groupId"`; realtime handler atualizado para match duplo
- `hooks/useUserSystem.ts` — hydration filtra por `activeGroupId`; `predictTournament` inclui `groupId`

---

## Verification (pending)

- **F1:** Na lista "O que a galera acha", o próprio user não aparece. Para jogos ao vivo, badge `+Xpts` aparece ao lado do palpite de cada amigo.
- **F2:** Clicar no avatar → modal mostra Pontos + Rank (não-admin apenas).
- **F3:** Arrastar para baixo na lista de jogos (mobile/DevTools touch) → indicador aparece → soltar → re-fetch do Supabase.
- **F4:** Rodar migration `0006` no Supabase (`dev` schema). Palpite especial no Grupo A ≠ Grupo B.
