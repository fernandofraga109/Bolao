-- Add standings/cache columns to public.teams (safe for existing databases)

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "externalTeamId" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsSeason" text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsStage" text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsType" text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsGroup" text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsPosition" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsPlayedGames" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsForm" text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsWon" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsDraw" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsLost" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsPoints" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsGoalsFor" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsGoalsAgainst" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsGoalDifference" integer;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS "standingsUpdatedAt" text;

CREATE INDEX IF NOT EXISTS teams_standings_group_idx
  ON public.teams ("standingsGroup", "standingsPosition");
