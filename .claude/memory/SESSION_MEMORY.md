# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current version:** `1.5.0`
**Test suite:** 112 tests passing / 2 pre-existing failures in `useLeaderboard.test.ts` (Vitest + RTL + happy-dom)
**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Active Plans

| Priority | Item | Plan | Status |
|----------|------|------|--------|
| Completed | Knockout score flat columns + full display | `.claude/plans/completed/knockout-score-columns.md` | DONE 2026-06-09 |
| Deferred | Specials components refactor | `.claude/plans/specials-components-refactor.md` | DEFERRED ("soon") — safety net DONE (chars. tests 67→109 green). Refactor not started. |
| Deferred | Large file refactor (5 phases) | `.claude/plans/large-file-refactors.md` | Planned, not started — branch `chore/structural-refactor` |
| Deferred | Production Vercel finalization | `docs/DEPLOY_VERCEL.md` | Deferred |
| Next | Sync call reduction (cadências desacopladas + gate por estado) | `.claude/plans/sync-call-reduction.md` | PLANEJADO — aguardando aprovação |
| In Progress | Sync performance investigation (latência 30–40s) | `.claude/plans/sync-performance-investigation.md` | Fix VALIDADO: total ~20s→~7.3s, `recalculateUserGroupPoints` 15.8s→3.9s (~4×, paralelização I/O). Recálculo ainda 53%; backlog opcional p/ reduzir mais |

---

## In Progress — Knockout Score Flat Columns (2026-06-09)

Branch: `feat/knockout-score-flat-columns` | Plan: `.claude/plans/knockout-score-columns.md`

### What was done this session

- **Phase 1 ✅** — Migration `0027_add_regular_extratime_cols.sql`: adds `regularHome`, `regularAway`, `extraTimeHome`, `extraTimeAway` (integer, nullable) to `v2_matches`. Includes SQL backfill from existing `score` JSONB. **Migration already applied to Supabase dev.**
- **Phase 2 ✅** — `hooks/useSyncSystem.ts`: `extractMatchResult` now returns all four flat cols. Both upsert paths (existing match + new match) write them. `hasChanged` guard forces re-sync if knockout match has null flat cols.
- **Phase 4 ✅** — `MatchCard.tsx`: all `match.score?.…` reads replaced with `getMatchDuration` / `getKnockoutAdvancingTeamId` / `getR1MatchScoringResult(match, …)`. Admin props (`isAdmin`, `onAdminSaveMatch`, `onAdminToggleSyncLock`) fully removed from MatchCard.
- **Phase 5 ✅** — New `AdminMatchCard.tsx`: dedicated admin card used in MatchesPage when isAdmin. Shows regularTime + ET + penalties inputs inline for LIVE/FINISHED knockout matches. Auto-derives `resultHome = regularHome + extraTimeHome` (5.a baked in). Deleted `AdminKnockoutScoreModal.tsx`, removed "Placar Mata-Mata" panel from AdminDashboard.
- **Phase 6 ✅** — `UserAuditModal.tsx`: expanded match row now shows sub-lines "Tempo Regular (R1)", "Após Prorrogação", "Pênaltis" when `getMatchDuration !== 'REGULAR'`.
- **Phase 7 ✅** — `StatsPage.tsx` `PredictionCard`: shows "Prorrog. X×Y" and "Pên. X×Y" sub-rows in the scores area for knockout matches.
- **Phase 8 ✅** — `TournamentStandings.tsx`: knockout match score block now shows "Prorr." and "Pên. X×Y" badges below the main score when applicable.
- **Phase 9 ✅** — Docs: `docs/features/scoring.md` updated — classifica bônus condition corrected (EXTRA_TIME + PENALTY_SHOOTOUT), display components table updated.
- **Phase 3 ✅** — `types.ts`: `MatchDB` + `Match` gain four new optional fields. `utils/scoring.ts`: three changes:
  - `getR1MatchScoringResult(match, fb_home, fb_away)` — new signature takes match object, reads flat cols first, JSONB fallback.
  - `getMatchDuration(match)` — new helper, infers `REGULAR/EXTRA_TIME/PENALTY_SHOOTOUT` from flat cols.
  - `getKnockoutAdvancingTeamId(match)` — new helper; covers **both** EXTRA_TIME (from `result`) and PENALTY_SHOOTOUT (from `penaltiesHome/Away`). Fixes the silent bug where +3 `whoClassifiesTeamId` bonus was never awarded for ET wins.
  - All call-sites updated: `useLeaderboard`, `usePointsProcessor` (×3), `UserAuditModal`.

### Completed — Knockout Score Flat Columns (2026-06-09)

All 9 phases shipped on branch `feat/knockout-score-flat-columns`. Changelog bump pending (invoke `changelog-updater`).

After Phase 6: Phase 7 (StatsPage), Phase 8 (TournamentStandings), Phase 9 (docs).

### Key design decisions (do not revisit)

- `score` JSONB column stays — audit trail, backward compat for rows not yet synced.
- Duration inferred from null checks: `penaltiesHome != null` → PENALTY_SHOOTOUT, `extraTimeHome != null` → EXTRA_TIME.
- `whoClassifiesTeamId` bonus applies to **both** EXTRA_TIME and PENALTY_SHOOTOUT (corrected from old PENALTY_SHOOTOUT-only logic).
- Pre-existing TS errors in `DatabaseContext.tsx` (lines 479, 555) — pre-date this branch, ignore.

---

## Completed — Players & Top Scorers / Artilharia Tab (2026-06-08)

- **`v2_players` + `v2_tournament_players` tables** (migrations 0020–0022): UUID PKs, FK from `tournament_predictions`
- **`usePlayerSync`**: `syncSquads`, `syncScorers`, `getTopScorers`, `fetchAllRows` pager (fixes Supabase 1000-row cap on 1248-player WC squads), `getPlayersByIds` gap-filler
- **`PlayerCombobox`**: debounced autocomplete with `isEditing` focus model, goalkeeper filter, out-of-order guard
- **`components/topscores/`**: `TopScoresPage` + `ScorerRow` (domain-colocation); "Artilharia" tab in BottomNav for all roles
- **Scorer sync wired into main pipeline** (FASE 1.6 in `useSyncSystem`) — zero new API calls per sync run
- **`specials/` extraction**: `PlayerCombobox`, `OtherUsersPredictions`, `TournamentPredictionsCard` moved to `components/specials/`

---

## Completed — R1 Scoring Fixes + "Quem se Classifica?" (2026-06-08)

- **R1 regularTime-only scoring**: R1 knockout matches now compare predictions against `regularTime` only (not `regularTime + extraTime`). New helper `getR1MatchScoringResult` in `utils/scoring.ts` extracts regularTime when `duration === EXTRA_TIME || PENALTY_SHOOTOUT`. Applied in `usePointsProcessor` (3 sites), `useLeaderboard`, `UserAuditModal`.
- **Rule 3 gap fixed (R1)**: `getScoreCategoryRegulamento1` was missing the draw guard present in R2. Added: when real result is a draw, category caps at `outcome` (5 pts) — no diff bonus even if predicted diff is 0. Fixes 7pts bug for draw predictions like 2-2 vs 1-1.
- **"Quem se classifica?" rename**: TypeScript layer uses `whoClassifiesTeamId`; DB column stays `tieWinnerTeamId` (no migration). UI: "Quem se classifica?" selector, "se classifica" badge, "+3 classifica" bonus. `POINTS_CLASSIFIES_BONUS = 3`.
- **MatchCard R1 display**: Added `displayResult` useMemo (R1→regularTime, R2→match.result). "Após Prorrogação" block shows full result for R1 knockout matches that went to extra time.
- **Tests**: `scoring.test.ts` updated — `classifiesBonus` rename + two draw tests corrected from 7→5 pts per Rule 3.

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

## Completed — Combobox bug fix + specials/ extraction (2026-06-06, uncommitted)

- **Bug fix:** `PlayerCombobox` display "ran away" on focus — `inputValue = isSearching ? query : displayName` + `handleFocus` set `isSearching=true`, so clicking the field showed empty `query`. Fixed with an `isEditing` model that seeds `query` with the current `displayName` on focus, so the selection stays visible while editable. Added out-of-order response guard (`reqIdRef`).
- **Goalkeeper filter fix:** was exact `position === "Goalkeeper"`; now `position.toLowerCase().includes('goalkeeper')` (defensive against coarse/detailed API position values).
- **Extraction:** created `components/specials/` — `PlayerCombobox.tsx`, `OtherUsersPredictions.tsx` (now uses `useDatabase` internally), and renamed `TopScorerCard` → `specials/TournamentPredictionsCard.tsx`. Old `components/TopScorerCard.tsx` deleted. `SpecialsPage.tsx` import updated.
- Code queries `players`/`tournament_players` (not `v2_*`) — this is CORRECT: `services/supabase.ts` has a Proxy on `.from()` that applies `VITE_DB_TABLE_PREFIX=v2_`. Do NOT "fix" this to `v2_*`; the prefix is automatic.
- **Saved-prediction names showing blank — FIXED:** root cause = `fetchPlayers` loaded the whole catalog with `.select('*')` and no pagination; Supabase caps at 1000 rows but WC squads = 48×26 = 1248, so ~250 players were dropped from `db.players` → name resolution failed for those. Fix: (a) `fetchAllRows` pager (1000/page) in `usePlayerSync` for both `players` + `tournament_players`; (b) new `getPlayersByIds(ids)` targeted resolver exposed via context; (c) `TournamentPredictionsCard` gap-fills its 3 names via `db.getPlayersByIds` when an id is absent from `db.players`. NOTE: autocomplete worked throughout because `searchPlayers` is a name-filtered query that never hit the 1000 cap.
- ⚠️ If names are still blank after this, the stored `topScorerPlayerId`/etc. are orphaned UUIDs from a `v2_players` re-creation (migration 0022 DROP+recreate regenerates UUIDs) — user must re-select. `getPlayersByIds` returns nothing for ids not in the current table.

## Completed — Players & Top Scorer Phase 5 / Artilharia tab (2026-06-06, uncommitted)

- **`getTopScorers(competitionCode, limit=30)`** added to `usePlayerSync` + exposed via `DatabaseContext`. Queries `tournament_players` scoped to the active competition (`.ilike` on code, `.gt('goals',0)`, ordered goals→assists→penalties), resolves names via `players`. Distinct from `db.players` (whose `tournamentEntry` is the best-across-competitions entry) so the ranking is competition-accurate.
- **New domain-colocation architecture** (per `specials-components-refactor.md` hybrid layout): created `components/topscores/TopScoresPage.tsx` + `components/topscores/ScorerRow.tsx` — NOT `components/pages/`. First page to live in its own domain folder.
- `"topscores"` added to `Tab` type; "Artilharia" tab (`Goal` icon) added to `BottomNav` visible to ALL roles (like Jogos/Tabela). Rendered in `App.tsx` with `competitionCode={activeCompetitionCode}`.
- ⚠️ `TopScoresPage` effect depends on `[competitionCode]` only — `db.getTopScorers` is a fresh closure each context render (not useCallback-wrapped, like all usePlayerSync fns), so depending on it would refetch/flicker on every poll. Do NOT "fix" the exhaustive-deps lint suppression.
- `tsc` clean, 67 tests green. No Tailwind `xs:` breakpoint exists (CDN config) — secondary stats use plain `flex`.

## Completed — Scorer persistence in main sync pipeline (2026-06-06, uncommitted)

- `syncMatchesAndStandings` (useSyncSystem) already fetched `scorersData` in FASE 1 (only used it for `competitions.topScorerName/Goals`). Now it ALSO persists the full list into `players` + `tournament_players` (FASE 1.6) so the Artilharia tab populates on every manual/automatic sync — **zero new external API calls**.
- Extracted module-level `persistScorers(competitionCode, scorersData)` from `usePlayerSync` (exported); both `usePlayerSync.syncScorers` and `useSyncSystem` reuse it. No duplicated upsert logic.
- Gated `(canWriteData || isBackgroundSync)` + try/catch (non-fatal). RLS (migration 0020) allows INSERT/UPDATE on `v2_players`/`v2_tournament_players` for any `authenticated` user → background sync by normal users writes scorers fine.
- **Sync external API call audit** (per-run): `/api/teams`, `/api/matches`, `/api/standings`, `/api/scorers` (always, parallel) + `/api/live-matches` (only when IN_PLAY/PAUSED matches exist). `team-ranking.json` is a local bundled file, not external. Admin "Sync Players" button still calls `/api/teams` (squads) separately.

## Next Action

Await user verification of the Artilharia tab (now auto-populated by normal sync). On confirmation: move plan to `completed/`, invoke `changelog-updater`. Then optionally specials refactor Phase A (`.claude/plans/specials-components-refactor.md`).

Commit all uncommitted Players/Artilharia work (combobox fix, specials/ extraction, scorer sync, TopScoresPage). Then optionally specials refactor Phase A (`.claude/plans/specials-components-refactor.md`).

## Completed — Players & Top Scorer Phases 1–4 (2026-06-06, commit `122f6ed`)

- **Migrations 0020–0022**: `v2_players` table (PK = UUID), FK from `tournament_predictions` → `v2_players`, `topScorerPlayerId`/`bestPlayerId`/`bestGoalkeeperId` columns replacing text fields.
- **`usePlayerSync`**: syncs squads from Football Data API into `v2_players` + `v2_tournament_players`; admin trigger in `AdminDashboard`.
- **`TopScorerCard` / `SpecialsPage`**: player autocomplete (`PlayerCombobox`) with 3-step search (name → IDs → tournament filter with `.ilike` for case-insensitive competition code).
- **`useUserSystem` / `usePointsProcessor`**: resolves player UUIDs → names at runtime for scoring; `db.players` loaded into context for client-side resolution.
- **`competitionCode` prop**: threaded from `App.tsx` `activeCompetitionCode` → `SpecialsPage` → `TopScorerCard` so search is scoped to the active competition.
- **Key bugs fixed**: `fetchPlayers` broken PostgREST FK join replaced with two separate queries; saved player names initialized from prediction prop (not just `db.players`); search fallback for players without tournament stats.

_Last updated: 2026-06-06_
