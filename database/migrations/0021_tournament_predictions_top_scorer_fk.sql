-- Migration 0021: Migrate v2_tournament_predictions text player fields → UUID FKs
-- Date: 2026-06-05
-- Depends on: 0022_refactor_players_schema.sql run first AND v2_players populated via squad sync
-- Migrates: topScorerPlayer → topScorerPlayerId, bestPlayer → bestPlayerId, bestGoalkeeper → bestGoalkeeperId
-- Note: topScorerGoals is KEPT — it stores the user's prediction of how many goals the top scorer will make

-- =============================================================================
-- Step 1: add new integer FK columns (nullable)
-- =============================================================================
ALTER TABLE v2_tournament_predictions
    ADD COLUMN IF NOT EXISTS "topScorerPlayerId" uuid
    REFERENCES v2_players(id) ON DELETE SET NULL;

ALTER TABLE v2_tournament_predictions
    ADD COLUMN IF NOT EXISTS "bestPlayerId" uuid
    REFERENCES v2_players(id) ON DELETE SET NULL;

ALTER TABLE v2_tournament_predictions
    ADD COLUMN IF NOT EXISTS "bestGoalkeeperId" uuid
    REFERENCES v2_players(id) ON DELETE SET NULL;

-- =============================================================================
-- Step 2: best-effort name-match migration for each field
-- Misses are acceptable — all three fields were free-text and already imprecise.
-- =============================================================================
UPDATE v2_tournament_predictions tp
SET "topScorerPlayerId" = p.id
FROM v2_players p
WHERE LOWER(TRIM(tp."topScorerPlayer")) = LOWER(TRIM(p.name))
  AND tp."topScorerPlayer" IS NOT NULL
  AND tp."topScorerPlayerId" IS NULL;

UPDATE v2_tournament_predictions tp
SET "bestPlayerId" = p.id
FROM v2_players p
WHERE LOWER(TRIM(tp."bestPlayer")) = LOWER(TRIM(p.name))
  AND tp."bestPlayer" IS NOT NULL
  AND tp."bestPlayerId" IS NULL;

UPDATE v2_tournament_predictions tp
SET "bestGoalkeeperId" = p.id
FROM v2_players p
WHERE LOWER(TRIM(tp."bestGoalkeeper")) = LOWER(TRIM(p.name))
  AND tp."bestGoalkeeper" IS NOT NULL
  AND tp."bestGoalkeeperId" IS NULL;

-- =============================================================================
-- Step 3: drop obsolete text columns
-- =============================================================================
ALTER TABLE v2_tournament_predictions DROP COLUMN IF EXISTS "topScorerPlayer";
ALTER TABLE v2_tournament_predictions DROP COLUMN IF EXISTS "bestPlayer";
ALTER TABLE v2_tournament_predictions DROP COLUMN IF EXISTS "bestGoalkeeper";
-- "topScorerGoals" is intentionally kept: it is the user's predicted goal count, not the actual stat
