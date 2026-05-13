# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current version:** `1.4.0` (user-facing — após Palpites Especiais completo)
**Test suite:** 43 tests passing (Vitest + RTL + happy-dom)

**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Active Plans

| Priority | Item | Plan | Estado |
|----------|------|------|--------|
| Deferred | Refactor de ficheiros grandes (5 fases) | `.claude/plans/large-file-refactors.md` | Planeado, não iniciado — branch `chore/structural-refactor` |
| Ongoing | Production Vercel finalization | `docs/DEPLOY_VERCEL.md` | Em aberto |

---

## Completed — Palpites Especiais UX (2026-05-12)

**Duas PRs combinadas:**

**PR colaborador (merged em main via #5):**
- `components/TopScorerCard.tsx` — dropdown de Seleção Campeã usa `db.teams` via `useDatabase()` em vez de constante estática; filtra por `ranking != null` + `allowedChampionTeamIds`
- `components/pages/MatchesPage.tsx` — calcula `currentGroupTeamIds` a partir dos matches e passa como `allowedChampionTeamIds` para `TopScorerCard`

**Branch `feat/prediction-ux-improvements` (aguarda merge):**
- `components/TopScorerCard.tsx` — `useEffect` sincroniza prop `prediction` com form state (fix hydration async); badge "Salvo" no header quando palpites existem; botão muda para "Editar Palpites Especiais" (ícone `Edit2`) quando `hasSavedPredictions`

---

## Completed — Structural Cleanup (2026-05-11)

- Eliminados: `tsc_output.txt`, `scripts/`, `database/_archive/`, `components/GroupSelection.tsx`, `data/matches.json`
- `constants.ts` — removidas 4 exports mortas; `utils/mergeUtils.ts` adicionado
- `contexts/DatabaseContext.tsx` — 5 funções merge* deduplicadas

---

## Completed — Zebra Bonus + UX + "What's New" + Production (2026-05-11)

- Zebra bonus proporcional (0.03/floor), tag `+{n}pts` no MatchCard
- Ranking FIFA nos cards; `RulesSection` dinâmica
- Modal "O que há de novo" via `data/releases.ts` + `changelog-updater` agent
- Fix registo + grupos (migration 0005); fix pontuação (`MatchDB` fields)

---

## Known Architectural Notes

| Note | Status |
|------|--------|
| Sync é user-triggered, não automático | Mitigado. Edge Functions + pg_cron ainda viável. |
| Two sources of truth: auth metadata vs `user_roles.displayName` | Monitorar — ver `completed/profile-sync-investigation.md` |
| `AdminDashboard.tsx` ~1348 linhas, `DatabaseContext.tsx` ~1246 linhas | Plano em `.claude/plans/large-file-refactors.md` |

---

## Next Action

Aguardar merge da branch `feat/prediction-ux-improvements` → main. Quando confirmado e funcionando, o plano `tournament-prediction-improvements` pode ser movido para `completed/`.

_Last updated: 2026-05-12_
