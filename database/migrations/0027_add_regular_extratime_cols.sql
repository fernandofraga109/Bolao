-- Migration 0027: Add flat score columns for regular time and extra time
--
-- Context: knockout match scores were stored only in the JSONB `score` column
-- (score.regularTime, score.extraTime). This migration adds flat columns so the
-- app can read/write these values directly without navigating JSON.
--
-- penaltiesHome/penaltiesAway already exist (migration 0017).
-- regularHome/regularAway replace score.regularTime.home/away.
-- extraTimeHome/extraTimeAway replace score.extraTime.home/away.
--
-- Duration and winner are inferred from null checks:
--   penaltiesHome != null           → PENALTY_SHOOTOUT
--   extraTimeHome != null AND penaltiesHome IS NULL → EXTRA_TIME
--   both null                       → REGULAR

-- v2_matches (active table)
ALTER TABLE v2_matches
  ADD COLUMN IF NOT EXISTS "regularHome"   integer,
  ADD COLUMN IF NOT EXISTS "regularAway"   integer,
  ADD COLUMN IF NOT EXISTS "extraTimeHome" integer,
  ADD COLUMN IF NOT EXISTS "extraTimeAway" integer;

COMMENT ON COLUMN v2_matches."regularHome"   IS 'Goals scored by home team in regular time (90 min)';
COMMENT ON COLUMN v2_matches."regularAway"   IS 'Goals scored by away team in regular time (90 min)';
COMMENT ON COLUMN v2_matches."extraTimeHome" IS 'Goals scored by home team in extra time only (not cumulative). NULL if match did not go to ET.';
COMMENT ON COLUMN v2_matches."extraTimeAway" IS 'Goals scored by away team in extra time only (not cumulative). NULL if match did not go to ET.';

-- matches (legacy table, kept in sync for safety)
ALTER TABLE IF EXISTS matches
  ADD COLUMN IF NOT EXISTS "regularHome"   integer,
  ADD COLUMN IF NOT EXISTS "regularAway"   integer,
  ADD COLUMN IF NOT EXISTS "extraTimeHome" integer,
  ADD COLUMN IF NOT EXISTS "extraTimeAway" integer;

-- Backfill from existing score JSONB where data is already present
UPDATE v2_matches
SET
  "regularHome"   = (score -> 'regularTime' ->> 'home')::integer,
  "regularAway"   = (score -> 'regularTime' ->> 'away')::integer,
  "extraTimeHome" = (score -> 'extraTime'   ->> 'home')::integer,
  "extraTimeAway" = (score -> 'extraTime'   ->> 'away')::integer
WHERE
  score IS NOT NULL
  AND (score -> 'regularTime') IS NOT NULL
  AND "regularHome" IS NULL;

-- Same backfill for legacy matches table
UPDATE matches
SET
  "regularHome"   = (score -> 'regularTime' ->> 'home')::integer,
  "regularAway"   = (score -> 'regularTime' ->> 'away')::integer,
  "extraTimeHome" = (score -> 'extraTime'   ->> 'home')::integer,
  "extraTimeAway" = (score -> 'extraTime'   ->> 'away')::integer
WHERE
  score IS NOT NULL
  AND (score -> 'regularTime') IS NOT NULL
  AND "regularHome" IS NULL;
