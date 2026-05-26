-- Migration 0013: Add admin override columns for Especiais (Regulamento 2)
-- These allow the admin to manually set official results for:
--   1. groupClassifications: classified teams per group (1st & 2nd)
--   2. knockoutClassifications: teams that qualified for each knockout phase
--   3. biggestGoalDiffMatches: match with biggest goal diff per phase
-- Admin data takes precedence over API-computed data.

-- Tabela principal (public.competitions)
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS "groupClassifications" jsonb,
  ADD COLUMN IF NOT EXISTS "knockoutClassifications" jsonb,
  ADD COLUMN IF NOT EXISTS "biggestGoalDiffMatches" jsonb;

-- Tabela v2 (public.v2_competitions) if exists
ALTER TABLE IF EXISTS v2_competitions
  ADD COLUMN IF NOT EXISTS "groupClassifications" jsonb,
  ADD COLUMN IF NOT EXISTS "knockoutClassifications" jsonb,
  ADD COLUMN IF NOT EXISTS "biggestGoalDiffMatches" jsonb;

-- COMMENTS for clarity
COMMENT ON COLUMN competitions."groupClassifications" IS 'Admin override: JSON {groupName: [teamId1st, teamId2nd]} for group qualifiers';
COMMENT ON COLUMN competitions."knockoutClassifications" IS 'Admin override: JSON {phase: [teamId...]} for knockout qualifiers (Oitavas, Quartas, Semis)';
COMMENT ON COLUMN competitions."biggestGoalDiffMatches" IS 'Admin override: JSON {phase: matchId} for biggest goal difference match per phase';
