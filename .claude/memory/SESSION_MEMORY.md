# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current version:** `1.4.0` (user-facing — v1.5.0 pendente após confirmação do UX Round 2)
**Test suite:** 43 tests passing (Vitest + RTL + happy-dom)
**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Active Plans

| Priority | Item | Plan | Estado |
|----------|------|------|--------|
| **In review** | UX Improvements Round 2 (4 features) | `.claude/plans/completed/ux-improvements-round2.md` | Implementado em `feat/ux-improvements-round2` — migration 0006 pendente no Supabase |
| Deferred | Refactor de ficheiros grandes (5 fases) | `.claude/plans/large-file-refactors.md` | Planeado, não iniciado — branch `chore/structural-refactor` |
| Ongoing | Production Vercel finalization | `docs/DEPLOY_VERCEL.md` | Em aberto |

---

## Completed — UX Round 2 (2026-05-16, branch `feat/ux-improvements-round2`)

- **"O que a galera acha"**: self excluído da lista; badge `+Xpts`/`0pts` por amigo via `calculatePoints`
- **Modal do avatar**: Pontos + Rank visíveis no modal (não-admin), corrige ausência no mobile
- **Pull-to-refresh**: `usePullToRefresh` + `PullToRefreshIndicator`; chama `refetchMatches` + `refetchPredictions` (fix: palpites de outros membros não apareciam por gaps no Realtime)
- **tournament_predictions groupId**: migration 0006, PK `(userId, groupId)` — palpites especiais agora são por grupo

---

## Completed — Palpites Especiais + Structural (2026-05-11 / 2026-05-12)

- `TopScorerCard`: badge "Salvo", botão Save/Edit, `useEffect` hydration fix, times do DB
- Limpeza estrutural: `tsc_output.txt`, `scripts/`, `database/_archive/`, `GroupSelection.tsx` eliminados
- `constants.ts`: 4 exports mortas removidas; `utils/mergeUtils.ts` adicionado; 5 funções merge* deduplicadas em `DatabaseContext.tsx`

---

## Completed — Zebra Bonus + UX + "What's New" + Production (2026-05-11)

- Zebra bonus proporcional (0.03/floor), tag `+{n}pts` no MatchCard
- Modal "O que há de novo" via `data/releases.ts` + `changelog-updater` agent
- Fix registo + grupos (migration 0005); fix pontuação (`MatchDB` fields)

---

## Known Architectural Notes

| Note | Status |
|------|--------|
| Sync é user-triggered, não automático | Mitigado. Pull-to-refresh (F3) resolve palpites; Edge Functions + pg_cron para scores ainda viável. |
| Two sources of truth: auth metadata vs `user_roles.displayName` | Monitorar — ver `completed/profile-sync-investigation.md` |
| `AdminDashboard.tsx` ~1348 linhas, `DatabaseContext.tsx` ~1246 linhas | Plano em `.claude/plans/large-file-refactors.md` |

---

## Next Action

1. User confirma que as 4 features do UX Round 2 funcionam
2. Rodar migration `0006_tournament_predictions_group.sql` no Supabase (schema `dev`)
3. Merge `feat/ux-improvements-round2` → `main`
4. Mover `.claude/plans/ux-improvements-round2.md` → `completed/`
5. Invocar `changelog-updater` para bumpar versão para `1.5.0`

_Last updated: 2026-05-16_
