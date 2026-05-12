# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current branch:** `feature/03/claude-code`  
**Test suite:** 43 tests passing (Vitest + RTL + happy-dom)

**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Current Sprint: Feature Resumption — COMPLETE

Production stabilization sprint completed 2026-05-11.  
"What's New" modal + changelog-updater agent completed 2026-05-11.  
UX improvements completed 2026-05-11.

---

## Active Plans

| Priority | Item | Plan |
|----------|------|------|
| Ongoing | Production Vercel finalization | `docs/DEPLOY_VERCEL.md` |

---

## Completed — "What's New" Modal (2026-05-11)

- `data/releases.ts` — static release history, `CURRENT_VERSION = "1.1.0"`
- `components/ui/WhatsNewModal.tsx` — modal using `ModalShell`, shows latest release, closes with "Entendido!" button
- `App.tsx` — wired: `showWhatsNew` state + `useEffect` checking `bolao_last_seen_version` in localStorage, renders modal only when user is authenticated
- `.claude/agents/changelog-updater.md` — new agent, only authorized to edit `data/releases.ts`
- `CLAUDE.md` — "Changelog Rules" section added alongside Testing Rules

**Show condition:** `localStorage.getItem("bolao_last_seen_version") !== CURRENT_VERSION`  
**Single source of truth:** `CURRENT_VERSION` in `data/releases.ts`

---

## Completed — Production Stabilization (2026-05-11)

All archived in `.claude/plans/completed/`.

**Phase 1 — Registration fix:**  
Anon RLS on `groups` (migration 0005) + fallback DB query in `register()` + `resumePendingGroupJoin()` to complete group join after email confirmation redirect.

**Phase 2 — Points sync fix:**  
Root cause: `MatchDB` (flat `resultHome`/`resultAway`) was cast as `Match` (nested `result`) — guard was always false, `finishedMatchesMap` permanently empty, all users got 0 pts. Fixed in `hooks/usePointsProcessor.ts`: use `MatchDB` fields + hydrate teams; also added `.select()` write validation + `successfulUpdates[]` accumulator.

**Phase 3 — Profile name:**  
Verified working in production without code changes.

---

## Previously Completed

### 2026-05-11 — Migrations aplicadas + tabela funcionando
- Todas as migrations SQL (`0001`–`0005`) aplicadas no Supabase
- `TournamentStandings` exibindo corretamente

### 2026-05-10–11 — Sprint 3 infrastructure
- Test suite: Vitest + RTL + happy-dom; 43 tests
- Code splitting, `DEPLOY_VERCEL.md`, agents, memory system overhaul

---

## Known Architectural Notes

| Note | Status |
|------|--------|
| Two sources of truth: auth metadata vs `user_roles.displayName` | Monitor — if name revert resurfaces, see `completed/profile-sync-investigation.md` |
| Sync is user-triggered, not automatic | Mitigated — any user can trigger. Edge Functions + pg_cron still viable upgrade. |

---

## Completed — UX Improvements (2026-05-11)

- `components/MatchCard.tsx` — FIFA ranking (`#{n}`) rendered below each team name, conditionally when truthy
- `components/RulesSection.tsx` — `minRankDiff` prop added (default 10); Zebra Bonus rule text now dynamic
- `components/pages/MatchesPage.tsx` — passes `minRankDiff` down to `RulesSection`
- Value chain already existed: `App.tsx` computes `currentGroup?.underdog_min_rank_diff ?? db.systemConfig.underdog_min_rank_diff ?? 10` and passes it through
- `data/releases.ts` bumped to **v1.2.0** — modal "O que há de novo" aparecerá para todos os usuários

## Next Action

No planned features remain. Next step is production Vercel finalization (`docs/DEPLOY_VERCEL.md`).

_Last updated: 2026-05-11_

## Completed — Special Predictions Update (2026-05-12)

- `components/TopScorerCard.tsx` — The "Champion Team" dropdown now fetches teams from the database (`db.teams`) instead of static data. The list is filtered to include only national teams with a ranking and, additionally, only teams from the active group.
- `components/pages/MatchesPage.tsx` — Calculates the active group's team IDs (`currentGroupTeamIds`) and passes them to `TopScorerCard` via the new `allowedChampionTeamIds` prop.

_Last updated: 2026-05-12_
