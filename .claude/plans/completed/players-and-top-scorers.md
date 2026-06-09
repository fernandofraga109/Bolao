# Plan: Players & Top Scorers

_Status: DONE — 2026-06-08_

## Problem Summary

1. Persist squad data from Football Data API into a `players` table
2. Use that table as autocomplete source for `topScorerPlayer`, `bestPlayer`, `bestGoalkeeper` tournament prediction fields
3. Migrate `topScorerPlayer text` → `topScorerPlayerId UUID FK`
4. Show an "Artilharia" tab with players ordered by goals

## Phases Completed

### Phase 1 — Database migrations
- `0020_create_players.sql`: `v2_players` + `v2_tournament_players` tables + RLS
- `0021_tournament_predictions_top_scorer_fk.sql`: `topScorerPlayerId`, `bestPlayerId`, `bestGoalkeeperId` UUID FKs
- `0022_*`: drop old text columns

### Phase 2 — Types + hook
- `PlayerDB` type in `types.ts`
- `hooks/usePlayerSync.ts`: `syncSquads`, `syncScorers`, `searchPlayers`, `getTopScorers`, `fetchAllRows` pager (fixes 1000-row Supabase cap for 1248 WC players)
- `getPlayersByIds(ids)` targeted resolver for gap-filling names

### Phase 3 — Admin sync button
- "Sync Players" button in `AdminDashboard.tsx` calling `db.syncSquads`
- Loading state + inline result panel

### Phase 4 — Tournament prediction autocomplete
- `PlayerCombobox` with debounced search, team crest, clear button, isEditing model (fixes focus "ran away" bug), out-of-order response guard
- Goalkeeper filter: `.toLowerCase().includes('goalkeeper')` (defensive against coarse API values)
- Hydration gap-fill via `getPlayersByIds` when player absent from `db.players`

### Phase 5 — Artilharia tab
- `components/topscores/TopScoresPage.tsx` + `ScorerRow.tsx` (domain-colocation architecture)
- `"topscores"` Tab type; "Artilharia" tab in BottomNav (all roles)
- Scorer persistence wired into main sync pipeline (FASE 1.6 in `useSyncSystem`) — zero new API calls
- `extractScorers` module-level helper shared between `usePlayerSync.syncScorers` and `useSyncSystem`

## Key Bugs Fixed
- `fetchPlayers` pagination: Supabase 1000-row cap dropped ~250 players from WC 48-team squads → blank names. Fixed with `fetchAllRows` pager.
- `PlayerCombobox` focus: `isEditing` model seeds `query` with current display name on focus.
- Saved player names blank: `getPlayersByIds` gap-fill for IDs not in pre-loaded `db.players`.

## Deferred
- Realtime subscription for scorer updates during live matches
- `bestPlayer` / `bestGoalkeeper` scoring autocomplete
- DB column rename `tieWinnerTeamId` → `whoClassifiesTeamId` (if ever needed)

_Created: 2026-06-05 | Completed: 2026-06-08_
