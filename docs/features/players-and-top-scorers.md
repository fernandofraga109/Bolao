# Feature: Players & Top Scorers

## Status: IN PROGRESS — Phases 1–4 done; Phase 5 (Top Scores tab) remaining

### Decisions locked

| Question | Decision |
|---|---|
| `topScorerPlayer` column type | Migrate to `integer` FK on `players(externalPlayerId)` + data migration script to match existing text values |
| Tab name | "Top Scores" |
| Scorer sync trigger | Piggyback on match sync (same interval, admin tab open). `/api/scorers` already exists in `api/scorers.ts` + Vite proxy + `liveScoreService.fetchCompetitionScorers` |
| Competitions scope | All active competitions (all rows in `competitions` table) |

---

## What Already Exists (do NOT rebuild)

| Asset | Location | Status |
|---|---|---|
| Vercel proxy — teams | `api/teams.ts` | Done |
| Vercel proxy — scorers | `api/scorers.ts` | Done |
| Vite dev proxy — `/api/teams` | `vite.config.ts` | Done |
| Vite dev proxy — `/api/scorers` | `vite.config.ts` | Done |
| `fetchCompetitionTeams()` | `services/liveScoreService.ts:18` | Done — returns `ExternalTeam[]` with `squad[]` |
| `fetchCompetitionScorers()` | `services/liveScoreService.ts:354` | Done — returns `ExternalScorersResponse` |

---

## API Shape

### Squad member (from `fetchCompetitionTeams` → `team.squad[]`)
```ts
{
  id: number           // externalPlayerId
  name: string
  position: string     // "Goalkeeper" | "Defence" | "Midfield" | "Offence"
  dateOfBirth: string  // "YYYY-MM-DD"
  nationality: string
}
```

### Scorer (from `fetchCompetitionScorers` → `response.scorers[]`)
```ts
{
  player: {
    id: number
    name: string
    firstName: string
    lastName: string
    dateOfBirth: string
    nationality: string
    section: string    // "Offence" etc — position is null here
  }
  team: { id: number; name: string; shortName: string; tla: string; crest: string }
  playedMatches: number
  goals: number
  assists: number
  penalties: number
}
```

---

## Database

### New table: `players`

```sql
-- Migration: 0020_create_players.sql
CREATE TABLE IF NOT EXISTS players (
    "externalPlayerId"  integer PRIMARY KEY,
    "competitionCode"   text NOT NULL REFERENCES competitions(code),
    "externalTeamId"    integer NOT NULL,
    "teamName"          text NOT NULL,
    "teamCrest"         text,
    name                text NOT NULL,
    "firstName"         text,
    "lastName"          text,
    position            text,
    "dateOfBirth"       date,
    nationality         text,
    goals               integer NOT NULL DEFAULT 0,
    assists             integer NOT NULL DEFAULT 0,
    penalties           integer NOT NULL DEFAULT 0,
    "playedMatches"     integer NOT NULL DEFAULT 0,
    "lastUpdated"       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS players_competition_idx ON players("competitionCode");
CREATE INDEX IF NOT EXISTS players_name_trgm_idx ON players USING gin (name gin_trgm_ops);
-- Fallback if pg_trgm not available:
CREATE INDEX IF NOT EXISTS players_name_idx ON players(name text_pattern_ops);

-- RLS: SELECT open to authenticated users
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_select_authenticated" ON players
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "players_insert_admin" ON players
    FOR INSERT TO authenticated
    USING ((SELECT role FROM user_roles WHERE "userId" = auth.uid()) = 'ADMIN');
CREATE POLICY "players_update_admin" ON players
    FOR UPDATE TO authenticated
    USING ((SELECT role FROM user_roles WHERE "userId" = auth.uid()) = 'ADMIN');
```

### Migration: `topScorerPlayer` text → integer FK

```sql
-- Migration: 0021_tournament_predictions_top_scorer_fk.sql

-- Step 1: add new integer column
ALTER TABLE tournament_predictions
    ADD COLUMN "topScorerPlayerId" integer REFERENCES players("externalPlayerId") ON DELETE SET NULL;

-- Step 2: data migration — match existing text by player name (best-effort)
UPDATE tournament_predictions tp
SET "topScorerPlayerId" = p."externalPlayerId"
FROM players p
WHERE LOWER(TRIM(tp."topScorerPlayer")) = LOWER(TRIM(p.name))
  AND tp."topScorerPlayer" IS NOT NULL;

-- Step 3: drop old text column
ALTER TABLE tournament_predictions DROP COLUMN "topScorerPlayer";
ALTER TABLE tournament_predictions DROP COLUMN "topScorerGoals";  -- goals now come from players table
```

> **Note:** Run migration 0020 (players table + initial sync) BEFORE 0021 to maximize name-match hit rate.

---

## Sync Strategy

### Phase 1 — Squad sync (on-demand, admin panel button)

1. Fetch all `competitions` rows from Supabase.
2. For each competition, call `fetchCompetitionTeams(competitionCode)`.
3. For each team, iterate `squad[]` and upsert into `players` on `externalPlayerId`.
4. Set `teamName`, `teamCrest`, `externalTeamId`, `competitionCode` from parent team context.
5. `firstName`/`lastName` are not in the squad response — leave null (populated later from scorers response if they appear).

### Phase 2 — Scorer sync (piggybacked on match sync)

After `useSyncSystem` finishes syncing matches, also call scorer sync:
1. For each active competition, call `fetchCompetitionScorers(competitionCode)`.
2. For each scorer, `UPDATE players SET goals, assists, penalties, playedMatches, firstName, lastName, lastUpdated WHERE externalPlayerId = scorer.player.id`.
3. If player not in table yet (edge case — scorer not in squad), INSERT with available data.

**Where to add:** in `hooks/useSyncSystem.ts`, at the end of the sync cycle, or as a new `hooks/usePlayerSync.ts` called from `DatabaseContext`.

---

## Frontend

### 1. `topScorerPlayer` → Combobox autocomplete

**Current:** free-text `<input>` writing a player name string.

**New:**
- Combobox that queries Supabase: `SELECT * FROM players WHERE name ILIKE '%{input}%' AND "competitionCode" = '{activeCompetition}' ORDER BY goals DESC, name LIMIT 20`
- Display row: `[team crest 16px]  Name  ·  Position`
- On select: write `player.externalPlayerId` (integer) to `topScorerPlayerId` in DB
- On load: if `topScorerPlayerId` exists, fetch player name to pre-fill display
- Graceful degradation: if no players in table, show hint "Sync de jogadores pendente" and disable input

**Types change in `types.ts`:**
```ts
// TournamentPredictionDB
topScorerPlayerId?: number     // replaces topScorerPlayer: string
topScorerGoals?: number        // remove — now read from players table
```

### 2. New "Top Scores" tab

**Route/page:** `components/pages/TopScoresPage.tsx`

**Bottom nav:** new tab after existing tabs — confirm position at implementation.

**Data source:** `SELECT * FROM players WHERE goals > 0 ORDER BY goals DESC, assists DESC LIMIT 50`

**Row layout:**
```
[team crest 24px]  Name                  ⚽ 5
                   Position · Nationality  🎯 3  (🥅 2 penalties)
```

**Empty state:** "Nenhum gol marcado ainda. A competição começa em breve."

**RLS:** SELECT open to authenticated users (same as above).

**Refresh:** manual pull-to-refresh or re-fetch on tab focus — no Realtime subscription needed.

---

## Affected Files

| Layer | File | Change |
|---|---|---|
| DB | `database/migrations/0020_create_players.sql` | New table + indexes + RLS |
| DB | `database/migrations/0021_tournament_predictions_top_scorer_fk.sql` | Text → integer FK migration |
| Types | `types.ts` | Add `Player` type; update `TournamentPredictionDB` |
| Service | `services/liveScoreService.ts` | Already has both fetch functions — no change needed |
| Hook | `hooks/useSyncSystem.ts` | Add scorer sync call at end of sync cycle |
| Hook | `hooks/usePlayerSync.ts` | New — squad sync (on-demand) + player query for autocomplete/Top Scores |
| Context | `contexts/DatabaseContext.tsx` | Expose `syncPlayers`, `players`, `topScorers` |
| Component | Tournament prediction form | Swap text input → combobox |
| Component | `components/pages/TopScoresPage.tsx` | New page |
| Nav | `components/BottomNav.tsx` | Add "Top Scores" tab |
| Admin | `AdminDashboard.tsx` | Add "Sync Players" button |
