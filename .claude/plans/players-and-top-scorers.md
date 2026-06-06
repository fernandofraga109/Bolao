# Plan: Players & Top Scorers

_Status: **IN PROGRESS** — Phases 1–5 implemented; awaiting user verification of the Artilharia tab_

## Problem Summary

Need to:
1. Persist squad data from Football Data API into a `players` table
2. Use that table as an autocomplete source for the `topScorerPlayer` (all player even goalkeepers), `bestPlayer` (all player even goalkeepers) and `bestGoalkeeper` (only players with position goalkeeper) tournament prediction field
3. Migrate `topScorerPlayer text` → `topScorerPlayerId integer FK`
4. Show a "Top Scores" tab with players ordered by goals

All API proxy endpoints and fetch functions already exist. No new API plumbing needed.

## Root Cause / Context

- `tournament_predictions.topScorerPlayer` is a free-text field — no validation, no autocomplete
- No `players` table exists yet
- `/api/scorers` + `/api/teams` + `fetchCompetitionScorers` + `fetchCompetitionTeams` are all already implemented

## Affected Systems

- `database/migrations/` (2 new files)
- `types.ts`
- `hooks/useSyncSystem.ts` (add scorer sync)
- `hooks/usePlayerSync.ts` (new)
- `contexts/DatabaseContext.tsx`
- Tournament prediction form component
- `components/pages/TopScoresPage.tsx` (new)
- `components/BottomNav.tsx`
- `AdminDashboard.tsx`

---

## Execution Phases

### Phase 1 — Database migrations

- [x] Write `0020_create_players.sql`: table + indexes + RLS
- [x] Write `0021_tournament_predictions_top_scorer_fk.sql`: add `topScorerPlayerId`, `bestPlayerId`, `bestGoalkeeperId` integer FKs, name-match migration for all three, drop old text columns + `topScorerGoals`
- [ ] Run 0020 in Supabase (dev schema first)
- [ ] Run squad sync manually to populate players
- [ ] Run 0021 (name match migration)

### Phase 2 — Types + hook

- [x] Add `PlayerDB` type to `types.ts`
- [x] Update `TournamentPredictionDB`: replaced text fields with `topScorerPlayerId?`, `bestPlayerId?`, `bestGoalkeeperId?` integer FKs
- [x] Create `hooks/usePlayerSync.ts`: `syncSquads`, `syncScorers`, `searchPlayers`, `players`, `isSyncingPlayers`
- [x] Expose all five from `DatabaseContext`
- [ ] Wire `syncScorers` into match sync cycle (deferred — can be called from App.tsx post-sync)

### Phase 3 — Admin sync button

- [x] Add "Sync Players" button in `AdminDashboard.tsx` that calls `db.syncSquads(activeCompetitions)`
- [x] Loading state via `db.isSyncingPlayers` + inline success/error result panel

### Phase 4 — Tournament prediction autocomplete

- [x] Find the `topScorerPlayer` (all player even goalkeepers), `bestPlayer` (all player even goalkeepers) and `bestGoalkeeper` (only players with position goalkeeper) input in the tournament prediction form
- [x] Replace with `PlayerCombobox`: debounced `searchPlayers` + dropdown with team crest + clear button
- [x] On select: write player UUID to DB via `topScorerPlayerId`, `bestPlayerId`, `bestGoalkeeperId`
- [x] On load: hydrate display names from `db.players` list via `useEffect` in `TopScorerCard`
- [x] Graceful degradation: "Sincronize os elencos no Painel Admin" hint when `db.players` is empty
- [x] Updated `types.ts`: `TournamentPredictions` has both ID fields and text fields (text derived from IDs)
- [x] Updated `useUserSystem.ts`: hydration resolves player names from `db.players`; `predictTournament` saves IDs
- [x] Fixed `usePointsProcessor.ts`: resolves player names from v2_players UUIDs for scoring
- [x] Fixed `PendingPredictionsBanner.tsx`: checks `topScorerPlayerId`/`bestPlayerId`/`bestGoalkeeperId`
- [x] Fixed `UserAuditModal.tsx`: rateio count uses player IDs when available

### Phase 5 — Top Scores tab

- [x] `getTopScorers(competitionCode, limit)` added to `usePlayerSync` + exposed via `DatabaseContext` (queries `tournament_players` scoped to the active competition, ordered by goals→assists→penalties; resolves names from `players`)
- [x] Created `components/topscores/TopScoresPage.tsx` + `components/topscores/ScorerRow.tsx` — **new domain-colocation architecture** (per specials-components-refactor hybrid layout), not `components/pages/`
- [x] Added `"topscores"` to `Tab` type (`types.ts`)
- [x] Added "Artilharia" tab to `BottomNav.tsx` (`Goal` icon, visible to all roles like Jogos/Tabela)
- [x] Wired render in `App.tsx` (`competitionCode={activeCompetitionCode}`)
- [x] `tsc` clean + 67 tests green
- [ ] User verification (empty state pre-tournament; real data after scorer sync)

---

## Validation Strategy

1. After Phase 1: confirm `players` table exists in dev, confirm migration 0021 runs cleanly
2. After Phase 2: confirm `syncSquads()` populates the table with correct data
3. After Phase 3: trigger "Sync Players" from admin, check Supabase table viewer
4. After Phase 4: open tournament predictions, type a player name, confirm autocomplete shows correct suggestions
5. After Phase 5: confirm "Top Scores" tab renders (empty state before first match, real data after scorer sync)

---

## Risks

| Risk | Mitigation |
|---|---|
| Name-match data migration misses existing values | Acceptable — the field was free-text so matches were already imprecise. Users can re-select. |
| WC 2026 scorers endpoint returns empty until Jun 11 | Expected. Empty state message covers this. Sync will auto-populate once matches start. |
| `topScorerGoals` removal breaks scoring logic | Check `hooks/usePointsProcessor.ts` for references before dropping |
| pg_trgm not enabled in Supabase | Use `text_pattern_ops` index as fallback for ILIKE prefix search |

## Deferred / Follow-up

- Realtime subscription for scorer updates during live matches (nice-to-have)
- `bestPlayer` / `bestGoalkeeper` fields could get the same autocomplete treatment later

---

_Created: 2026-06-05_
