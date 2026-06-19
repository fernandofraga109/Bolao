-- Migration 0036: Add array-based biggest goal diff match IDs column (Regulamento 2)
-- Allows multiple matches per phase to share the "biggest goal difference" prize.
-- Structure: {"groups": [uuid, ...], "round_of_32": [...], "round_of_16": [...], "quarter_finals": [...], "semi_finals": [...]}
-- The old "biggestGoalDiffMatches" column (single matchId per phase) is kept for
-- backwards compatibility but is no longer used for scoring.

-- Tabela v2 (public.v2_competitions) — target table for this feature
ALTER TABLE IF EXISTS public.v2_competitions
  ADD COLUMN IF NOT EXISTS "biggestGoalDiffMatchIds" jsonb;

-- Optional: also add to legacy competitions table so future environments stay consistent
ALTER TABLE IF EXISTS public.competitions
  ADD COLUMN IF NOT EXISTS "biggestGoalDiffMatchIds" jsonb;

-- COMMENTS for clarity
COMMENT ON COLUMN public.v2_competitions."biggestGoalDiffMatchIds" IS 'Regulamento 2: array of matchIds per phase that share the biggest goal difference (official result for extra phase predictions)';
COMMENT ON COLUMN public.competitions."biggestGoalDiffMatchIds" IS 'Regulamento 2: array of matchIds per phase that share the biggest goal difference (official result for extra phase predictions)';
