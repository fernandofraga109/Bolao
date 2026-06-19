SET search_path TO public;

-- Migration 0037: Add array-based goal record team columns for Regulamento 2
-- Allows multiple teams to share the "most goals in a single game" and
-- "most goals conceded in a single game" special prizes.
-- The legacy single UUID columns are kept populated with the first array
-- element for backward compatibility during the transition.

-- Tabela v2 (public.v2_competitions) — target table for this feature
ALTER TABLE IF EXISTS public.v2_competitions
  ADD COLUMN IF NOT EXISTS "mostGoalsTeamIds" uuid[];

ALTER TABLE IF EXISTS public.v2_competitions
  ADD COLUMN IF NOT EXISTS "mostConcededTeamIds" uuid[];

-- Legacy competitions table stays consistent for future environments
ALTER TABLE IF EXISTS public.competitions
  ADD COLUMN IF NOT EXISTS "mostGoalsTeamIds" uuid[];

ALTER TABLE IF EXISTS public.competitions
  ADD COLUMN IF NOT EXISTS "mostConcededTeamIds" uuid[];

-- COMMENTS for clarity
COMMENT ON COLUMN public.v2_competitions."mostGoalsTeamIds" IS 'Regulamento 2: array of team IDs that tied for most goals scored in a single match (official result for special predictions).';
COMMENT ON COLUMN public.v2_competitions."mostConcededTeamIds" IS 'Regulamento 2: array of team IDs that tied for most goals conceded in a single match (official result for special predictions).';
COMMENT ON COLUMN public.competitions."mostGoalsTeamIds" IS 'Regulamento 2: array of team IDs that tied for most goals scored in a single match (official result for special predictions).';
COMMENT ON COLUMN public.competitions."mostConcededTeamIds" IS 'Regulamento 2: array of team IDs that tied for most goals conceded in a single match (official result for special predictions).';
