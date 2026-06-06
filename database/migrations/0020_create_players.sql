-- Migration 0020: Create v2_players and v2_tournament_players tables
-- Date: 2026-06-05
-- Depends on: v2_competitions table (FK), auth.users (via RLS)
-- Note: 0022 supersedes this migration for existing installs (DROP + recreate)

-- v2_players: player identity only
CREATE TABLE IF NOT EXISTS v2_players (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "externalPlayerId"  integer NOT NULL UNIQUE,
    name                text NOT NULL,
    "firstName"         text,
    "lastName"          text,
    position            text,
    "dateOfBirth"       date,
    nationality         text
);

CREATE INDEX IF NOT EXISTS v2_players_name_idx ON v2_players (name text_pattern_ops);
DO $$ BEGIN
    CREATE INDEX v2_players_name_trgm_idx ON v2_players USING gin (name gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN NULL; END; $$;

ALTER TABLE v2_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_players_select" ON v2_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_players_insert" ON v2_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_players_update" ON v2_players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_players_delete_admin" ON v2_players FOR DELETE TO authenticated USING (is_admin());

-- v2_tournament_players: player <-> competition <-> team + stats
CREATE TABLE IF NOT EXISTS v2_tournament_players (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "playerId"          uuid NOT NULL REFERENCES v2_players(id) ON DELETE CASCADE,
    "competitionCode"   text NOT NULL REFERENCES v2_competitions(code) ON DELETE CASCADE,
    "externalTeamId"    integer NOT NULL,
    "teamName"          text NOT NULL,
    "teamCrest"         text,
    goals               integer NOT NULL DEFAULT 0,
    assists             integer NOT NULL DEFAULT 0,
    penalties           integer NOT NULL DEFAULT 0,
    "playedMatches"     integer NOT NULL DEFAULT 0,
    "lastUpdated"       timestamptz DEFAULT now(),
    UNIQUE ("playerId", "competitionCode")
);

CREATE INDEX IF NOT EXISTS v2_tp_competition_idx ON v2_tournament_players("competitionCode");
CREATE INDEX IF NOT EXISTS v2_tp_goals_idx ON v2_tournament_players(goals DESC);

ALTER TABLE v2_tournament_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_tp_select" ON v2_tournament_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_tp_insert" ON v2_tournament_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_tp_update" ON v2_tournament_players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_tp_delete_admin" ON v2_tournament_players FOR DELETE TO authenticated USING (is_admin());
