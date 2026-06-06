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
| **Next** | Players & Top Scorers | `.claude/plans/players-and-top-scorers.md` | IN PROGRESS — Phases 1–4 done; Phase 5 (Top Scores tab + BottomNav entry) remaining |
| Deferred | Large file refactor (5 phases) | `.claude/plans/large-file-refactors.md` | Planned, not started — branch `chore/structural-refactor` |
| Ongoing | Production Vercel finalization | `docs/DEPLOY_VERCEL.md` | Open |

---

## Completed — Data Sync Reliability + Global PTR + predictions.points fix (2026-05-16, branch `fix/data-sync-and-ptr`)

- **Fix 1 — Other users' predictions not appearing:** `hydratedUsers` in `hooks/useUserSystem.ts` was filtering each user's predictions using their own `resolvedActiveGroupId`, computed from the viewer's device. Fix: added `viewerActiveGroupId` memo computed from the current user's data, used as the effective group filter for all other users.
- **Fix 2 — `user_groups` zeroing during sync:** `usePointsProcessor.recalculateUserGroupPoints` did sequential individual UPDATEs in a loop; if the predictions query returned empty, all members got 0 points, with N Realtime events showing intermediate state. Fix: (a) safety guard — if `preds` is empty but members already have points > 0, skip the update entirely; (b) batch `upsert` with `onConflict: "userId,groupId"` replaces the loop — one operation, one Realtime event.
- **Fix 3 — PTR global:** Moved `usePullToRefresh` + `PullToRefreshIndicator` from `MatchesPage.tsx` to `App.tsx` on the `<main>` container. `handleRefreshData` now calls all three: `refetchMatches + refetchPredictions + refetchTeamStandings`. Removed `onRefreshData` prop from `MatchesPage` entirely.
- **Fix 4 — `predictions.points` not written during sync:** `batchProcessPointsForMatches` called `upsertPrediction` which updated local state before the DB write; if the DB write failed silently, local state poisoned the idempotency check (`pred.points === pts`) so subsequent syncs skipped the write. Fix: removed the call from `batchProcessPointsForMatches`; moved the `predictions.points` update into `recalculateUserGroupPoints` using a direct `supabase.upsert` on fresh DB-sourced data (no local state side effect). StatsPage now shows correct pts after sync + hard reload.

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
| `hydratedUsers` predictions bug — **FIXED** | Root cause: `resolvedActiveGroupId` for other users computed on the viewer's device → predictions filtered out. Fix: `viewerActiveGroupId` memo. |
| `user_groups` zeroing during sync — **FIXED** | Root cause: sequential UPDATEs in a loop + empty predictions query zeroed everyone. Fix: safety guard + single batch upsert. |
| `predictions.points` not written during sync — **FIXED** | Root cause: `upsertPrediction` updated local state before DB write; if DB write failed (silenced), local state poisoned idempotency check → DB never corrected on retry. Fix: moved `predictions.points` update into `recalculateUserGroupPoints` using direct `supabase.upsert` (no local state side effect). |
| Two sources of truth: auth metadata vs `user_roles.displayName` | Monitor — see `completed/profile-sync-investigation.md` |
| `AdminDashboard.tsx` ~1348 lines, `DatabaseContext.tsx` ~1246 lines | Plan in `.claude/plans/large-file-refactors.md` |

---

## Specced — Players & Top Scorers (2026-06-05)

- Created `docs/features/players-and-top-scorers.md` — full spec for player squad ingestion and Top Scorers tab
- API verified via live calls: squad fields are `externalPlayerId/name/position/dateOfBirth/nationality`; scorers add `goals/assists/penalties/playedMatches`
- Proposed: new `players` table (PK = `externalPlayerId`), two-phase sync (squad on-demand + scorer periodic), autocomplete on `topScorerPlayer`, new "Artilharia" tab
- 5 open questions left for user review before implementation (column type for topScorerPlayer, tab name, sync frequency, competitions scope, scorers limit)

---

## Next Action

Phase 5: create `components/pages/TopScoresPage.tsx` (scorers list ordered by goals) + add tab to `BottomNav.tsx` + wire routing in `App.tsx`.

## Autocomplete — Fixed & Working (2026-06-05)

- `overflow-hidden` removed from outer card div (moved to header button) in [components/TopScorerCard.tsx](components/TopScorerCard.tsx).
- Player search scoped to `competitionCode` — threaded from `App.tsx` `activeCompetitionCode` → `SpecialsPage` → `TopScorerCard` → `PlayerCombobox` → `db.searchPlayers(val, competitionCode)`.
- **`fetchPlayers` fixed** in [hooks/usePlayerSync.ts](hooks/usePlayerSync.ts): was using a broken PostgREST FK join (`player:v2_players(*)`) that silently returned null, leaving `db.players` empty and preventing name hydration on load. Replaced with two separate queries.
- **`competitionCode` filter reverted**: added filter to `searchPlayers` at user request but it broke search because stored codes didn't match `activeCompetitionCode`. Fully removed — `competitionCode` prop stripped from `PlayerCombobox`, `TopScorerCard`, `SpecialsPage`, and `App.tsx`. `searchPlayers` signature now takes only `query: string`.

## Autocomplete — Two follow-up bugs fixed (2026-06-05)

- **Saved player names blank on load**: `tsPlayerName`/`bestPlayerName`/`bestGkName` were always initialized to `''` and only hydrated from `db.players`. The prediction prop already stores names (`topScorer.player`, `bestPlayer`, `bestGoalkeeper`). Fix: initialize states and the prediction-sync `useEffect` from those saved names. `db.players` hydration still overrides when available.
- **Search returning "Nenhum jogador encontrado"**: `searchPlayers` required a player to have an entry in both `v2_players` AND `v2_tournament_players`. Players synced only to `v2_players` (no tournament stats yet) were silently excluded. Fix: fetch full rows from `v2_players` first, then do a best-effort `v2_tournament_players` lookup; players with no tournament entry are still returned with an empty stub entry.

## Search scoped to competition (2026-06-06)

- Players still not appearing — threaded `competitionCode` through the full prop chain: `App.tsx` `activeCompetitionCode` → `SpecialsPage` → `TopScorerCard` → `PlayerCombobox` → `db.searchPlayers(val, competitionCode)`.
- `searchPlayers` updated to 3-step strategy: (1) find player IDs by name in `v2_players`, (2) filter `v2_tournament_players` by those IDs + `.ilike("competitionCode", competitionCode)` (case-insensitive — previous attempt used `.eq()` which broke on case mismatch), (3) fetch full player rows. Only returns players with a tournament entry for the active competition.
- Previous attempt to thread competition code was reverted because `.eq()` was case-sensitive vs `.toUpperCase()` in `activeCompetitionCode`. Fixed with `.ilike()`.

_Last updated: 2026-06-06_
