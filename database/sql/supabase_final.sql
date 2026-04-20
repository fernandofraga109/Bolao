-- FINAL SUPABASE SQL (UUID-ONLY, NO PROFILES)
-- Schema + policies + realtime (no seed data)
-- Paste this whole file into the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- CLEANUP
-- =============================================================
DROP TABLE IF EXISTS public.tournament_predictions CASCADE;
DROP TABLE IF EXISTS public.predictions CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.user_groups CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;
DROP TABLE IF EXISTS public.stadiums CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;

-- =============================================================
-- SCHEMA (ALL IDs UUID)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text NOT NULL UNIQUE,
    flag text NOT NULL,
    ranking integer,
  pot integer,
  "externalTeamId" integer,
  "standingsSeason" text,
  "standingsStage" text,
  "standingsType" text,
  "standingsGroup" text,
  "standingsPosition" integer,
  "standingsPlayedGames" integer,
  "standingsForm" text,
  "standingsWon" integer,
  "standingsDraw" integer,
  "standingsLost" integer,
  "standingsPoints" integer,
  "standingsGoalsFor" integer,
  "standingsGoalsAgainst" integer,
  "standingsGoalDifference" integer,
  "standingsUpdatedAt" text
);

CREATE TABLE IF NOT EXISTS public.stadiums (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    city text NOT NULL,
    country text NOT NULL,
    capacity integer
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    "userId" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "displayName" text NOT NULL,
    email text NOT NULL,
    avatar text,
    role text NOT NULL DEFAULT 'USER'
);

CREATE TABLE IF NOT EXISTS public.groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text NOT NULL UNIQUE,
    "adminId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_groups (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    "joinedAt" timestamptz DEFAULT now(),
    role text DEFAULT 'MEMBER',
    points integer NOT NULL DEFAULT 0,
    PRIMARY KEY ("userId", "groupId")
);

CREATE TABLE IF NOT EXISTS public.matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "externalMatchId" text UNIQUE,
    "homeTeamId" uuid NOT NULL REFERENCES public.teams(id),
    "awayTeamId" uuid NOT NULL REFERENCES public.teams(id),
    date timestamptz NOT NULL,
    "group" text NOT NULL,
    "stadiumId" uuid REFERENCES public.stadiums(id),
    status text NOT NULL,
    "resultHome" integer,
    "resultAway" integer
);

CREATE TABLE IF NOT EXISTS public.predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "matchId" uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    "homeScore" integer NOT NULL,
    "awayScore" integer NOT NULL,
    timestamp timestamptz DEFAULT now(),
    PRIMARY KEY ("userId", "matchId")
);

CREATE TABLE IF NOT EXISTS public.tournament_predictions (
    "userId" uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "championTeamId" uuid REFERENCES public.teams(id),
    "topScorerPlayer" text,
    "topScorerGoals" integer,
    "bestPlayer" text,
    "bestGoalkeeper" text
);

CREATE TABLE IF NOT EXISTS public.system_config (
    id uuid PRIMARY KEY,
    is_auto_sync_enabled boolean DEFAULT false,
    sync_interval_ms integer DEFAULT 60000
);

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur."userId"::text = auth.uid()::text
      and ur.role = 'ADMIN'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

CREATE POLICY "Public Read Teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Public Read Stadiums" ON public.stadiums FOR SELECT USING (true);
CREATE POLICY "Public Write Teams" ON public.teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Write Stadiums" ON public.stadiums FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "UserRoles read own or shared group or admin"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR auth.uid()::text = "userId"::text
  OR EXISTS (
    SELECT 1
    FROM public.user_groups me
    JOIN public.user_groups other
      ON other."groupId" = me."groupId"
    WHERE me."userId"::text = auth.uid()::text
      AND other."userId"::text = user_roles."userId"::text
  )
);
CREATE POLICY "UserRoles insert own or admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR auth.uid()::text = "userId"::text);
CREATE POLICY "UserRoles update own or admin"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_admin() OR auth.uid()::text = "userId"::text)
WITH CHECK (public.is_admin() OR auth.uid()::text = "userId"::text);
CREATE POLICY "UserRoles delete admin only"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_admin());
CREATE POLICY "Public Access Groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access UserGroups" ON public.user_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read Matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admin Edit Matches" ON public.matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Predictions" ON public.predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access TournPreds" ON public.tournament_predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read Config" ON public.system_config FOR SELECT USING (true);
CREATE POLICY "Public Update Config" ON public.system_config FOR UPDATE USING (true);
CREATE POLICY "Public Insert Config" ON public.system_config FOR INSERT WITH CHECK (true);

-- =============================================================
-- REALTIME
-- =============================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_groups;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_predictions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- =============================================================
-- SYSTEM CONFIG SINGLETON ROW
-- =============================================================
INSERT INTO public.system_config (id, is_auto_sync_enabled, sync_interval_ms)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, false, 60000)
ON CONFLICT (id) DO NOTHING;
