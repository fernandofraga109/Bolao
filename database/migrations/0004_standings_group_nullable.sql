-- Migration 0004: Make team_standings.group nullable and simplify PK
--
-- Rationale:
--   The API returns group=null for league competitions (BSA, PL, etc.)
--   and group="Group A" etc. for cup competitions (WC, CL).
--   Storing null as-is and grouping by it in the frontend ("Tabela" title)
--   is cleaner than the "Temporada Regular" fallback string.
--
-- PK changes from (teamId, competitionCode, group) to (teamId, competitionCode)
-- because a team plays in exactly ONE group per competition.

-- 1. Drop existing composite PK that includes group
ALTER TABLE team_standings DROP CONSTRAINT IF EXISTS team_standings_pkey;

-- 2. Make group nullable and remove the default string
ALTER TABLE team_standings
  ALTER COLUMN "group" DROP NOT NULL,
  ALTER COLUMN "group" DROP DEFAULT;

-- 3. Clean up stale "Temporada Regular" rows stored for CUP competitions
--    (requires competitions.type to be populated — run after a sync if needed)
UPDATE team_standings ts
SET "group" = NULL
FROM competitions c
WHERE ts."competitionCode" = c.code
  AND c.type = 'CUP'
  AND ts."group" = 'Temporada Regular';

-- 4. New PK: one standings record per team per competition
ALTER TABLE team_standings
  ADD PRIMARY KEY ("teamId", "competitionCode");
