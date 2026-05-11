-- Migration: Add competition_code column to groups table
-- Description: Enables dynamic competition selection per group instead of hardcoded 'WC'
-- Date: 2026-04-21

BEGIN;

-- Add competition_code column with default 'WC' for existing groups
ALTER TABLE public.groups
ADD COLUMN "competitionCode" text DEFAULT 'WC';

-- Add competition code to matches so each sync stays scoped to the right competition
ALTER TABLE public.matches
ADD COLUMN "competitionCode" text DEFAULT 'WC';

-- Add competition code to standings cache on teams
ALTER TABLE public.teams
ADD COLUMN "standingsCompetitionCode" text DEFAULT 'WC';

-- Verify the migration
-- SELECT id, name, "competitionCode" FROM public.groups LIMIT 5;

COMMIT;
