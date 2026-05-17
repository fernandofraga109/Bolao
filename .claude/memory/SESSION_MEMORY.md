# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current version:** `1.5.0`
**Test suite:** 43 tests passing (Vitest + RTL + happy-dom)
**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Active Plans

| Priority | Item | Plan | Status |
|----------|------|------|--------|
| **Next** | StatsPage shows 0 pts (pred.points stale) | `.claude/plans/fix-stats-points-display.md` | Planned, not started |
| Deferred | Large file refactor (5 phases) | `.claude/plans/large-file-refactors.md` | Planned, not started — branch `chore/structural-refactor` |
| Ongoing | Production Vercel finalization | `docs/DEPLOY_VERCEL.md` | Open |

---

## Completed — Data Sync Reliability + Global PTR (2026-05-16, branch `fix/data-sync-and-ptr`)

- **Fix 1 — Other users' predictions not appearing:** `hydratedUsers` in `hooks/useUserSystem.ts` was filtering each user's predictions using their own `resolvedActiveGroupId`, computed from the viewer's device. Fix: added `viewerActiveGroupId` memo computed from the current user's data, used as the effective group filter for all other users.
- **Fix 2 — `user_groups` zeroing during sync:** `usePointsProcessor.recalculateUserGroupPoints` did sequential individual UPDATEs in a loop; if the predictions query returned empty, all members got 0 points, with N Realtime events showing intermediate state. Fix: (a) safety guard — if `preds` is empty but members already have points > 0, skip the update entirely; (b) batch `upsert` with `onConflict: "userId,groupId"` replaces the loop — one operation, one Realtime event.
- **Fix 3 — PTR global:** Moved `usePullToRefresh` + `PullToRefreshIndicator` from `MatchesPage.tsx` to `App.tsx` on the `<main>` container. `handleRefreshData` now calls all three: `refetchMatches + refetchPredictions + refetchTeamStandings`. Removed `onRefreshData` prop from `MatchesPage` entirely.

---

## Completed — UX Round 2 (2026-05-16, branch `feat/ux-improvements-round2`)

- **"What the crew thinks"**: current user excluded from the list; `+Xpts`/`0pts` badge per friend via `calculatePoints`
- **Avatar modal**: Points + Rank visible in modal (non-admin), fixes missing data on mobile
- **Pull-to-refresh**: `usePullToRefresh` + `PullToRefreshIndicator`; calls `refetchMatches` + `refetchPredictions` (fix: other members' predictions not appearing due to Realtime gaps)
- **tournament_predictions groupId**: migration 0006, PK `(userId, groupId)` — special predictions are now per-group

---

## Completed — Special Predictions + Structural (2026-05-11 / 2026-05-12)

- `TopScorerCard`: "Saved" badge, Save/Edit button, `useEffect` hydration fix, teams from DB
- Structural cleanup: `tsc_output.txt`, `scripts/`, `database/_archive/`, `GroupSelection.tsx` removed
- `constants.ts`: 4 dead exports removed; `utils/mergeUtils.ts` added; 5 merge* functions deduplicated in `DatabaseContext.tsx`

---

## Completed — Zebra Bonus + UX + "What's New" + Production (2026-05-11)

- Proportional zebra bonus (0.03/floor), `+{n}pts` tag in MatchCard
- "What's New" modal via `data/releases.ts` + `changelog-updater` agent
- Registration + groups fix (migration 0005); scoring fix (`MatchDB` fields)

---

## Known Architectural Notes

| Note | Status |
|------|--------|
| Sync is user-triggered, not automatic | Mitigated. PTR resolves predictions; Edge Functions + pg_cron for scores still viable. |
| `hydratedUsers` predictions bug — **FIXED** | Root cause: `resolvedActiveGroupId` for other users computed on the viewer's device where their localStorage doesn't exist → predictions filtered out. Fix: separate `viewerActiveGroupId` memo used for all other users. |
| `user_groups` zeroing during sync — **FIXED** | Root cause: `usePointsProcessor` looped individual UPDATEs; empty predictions query zeroed everyone. Fix: safety guard + single batch upsert. |
| `predictions.points` never written during sync — **PENDING FIX** | Root cause: `batchProcessPointsForMatches` calls `upsertPrediction` which updates local state first, then tries DB write. If DB write fails (silenced error), local state shows correct pts → next sync sees `pred.points === pts` → skips DB write → loop. Fix: move `predictions.points` update into `recalculateUserGroupPoints` which reads from DB directly (no poisoning). Plan: `.claude/plans/fix-stats-points-display.md`. |
| Two sources of truth: auth metadata vs `user_roles.displayName` | Monitor — see `completed/profile-sync-investigation.md` |
| `AdminDashboard.tsx` ~1348 lines, `DatabaseContext.tsx` ~1246 lines | Plan in `.claude/plans/large-file-refactors.md` |

---

## Next Action

Implement fix for StatsPage 0 pts bug (`.claude/plans/fix-stats-points-display.md`):
- `StatsPage.tsx` — import `calculatePoints`, add `minRankDiff` prop, replace `pred.points` reads
- `App.tsx` — pass `minRankDiff` to `<StatsPage>`

Then: commit + merge `fix/data-sync-and-ptr` → `main` and invoke `changelog-updater` agent.

_Last updated: 2026-05-16_
