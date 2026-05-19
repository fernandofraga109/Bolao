-- =============================================================================
-- Bolão Copa do Mundo 2026 — Schema Completo
-- Gerado a partir do estado real do banco em 2026-05-10
-- Execute este arquivo em um banco limpo para recriar a estrutura completa.
--
-- SCHEMA: altere a linha abaixo para mudar o schema alvo.
--         'public' para produção, 'public' para ambiente de desenvolvimento.
-- =============================================================================
SET search_path TO public;
CREATE SCHEMA IF NOT EXISTS public;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- LIMPEZA (somente necessário em ambiente de public/reset)
-- =============================================================================
DROP TABLE IF EXISTS tournament_predictions CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS team_standings CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS user_groups CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
DROP TABLE IF EXISTS stadiums CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS competitions CASCADE;

-- =============================================================================
-- TABELAS
-- Ordem: competitions → teams/stadiums → user_roles/groups → user_groups
--        → matches → predictions → tournament_predictions → system_config
-- =============================================================================

CREATE TABLE IF NOT EXISTS competitions (
    code        character varying PRIMARY KEY,
    name        character varying NOT NULL,
    emblem      character varying,
    type        character varying,
    last_updated timestamptz,
    last_sync   timestamptz
);

CREATE TABLE IF NOT EXISTS teams (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    code            text NOT NULL,
    flag            text NOT NULL,
    ranking         integer,
    pot             integer,
    "externalTeamId" integer UNIQUE
);

CREATE TABLE IF NOT EXISTS stadiums (
    id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name     text NOT NULL,
    city     text NOT NULL,
    country  text NOT NULL,
    capacity integer
);

CREATE TABLE IF NOT EXISTS user_roles (
    "userId"       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "displayName"  text NOT NULL,
    email          text NOT NULL,
    avatar         text,
    role           text NOT NULL DEFAULT 'USER',
    "activeGroupId" uuid,
    "totalPoints"  integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS groups (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    code            text NOT NULL UNIQUE,
    "adminId"       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "createdAt"     timestamptz DEFAULT now(),
    "competitionCode" text DEFAULT 'WC'
);

-- FK de user_roles.activeGroupId → groups (adicionada depois de groups existir)
ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_activeGroupId_fkey
    FOREIGN KEY ("activeGroupId") REFERENCES groups(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS user_groups (
    "userId"    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId"   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    "joinedAt"  timestamptz DEFAULT now(),
    role        text DEFAULT 'MEMBER',
    points      integer NOT NULL DEFAULT 0,
    PRIMARY KEY ("userId", "groupId")
);

CREATE TABLE IF NOT EXISTS matches (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "externalMatchId" text UNIQUE,
    "homeTeamId"     uuid NOT NULL REFERENCES teams(id),
    "awayTeamId"     uuid NOT NULL REFERENCES teams(id),
    date             timestamptz NOT NULL,
    "group"          text NOT NULL,
    "stadiumId"      uuid REFERENCES stadiums(id),
    status           text NOT NULL,
    "resultHome"     integer,
    "resultAway"     integer,
    "competitionCode" text DEFAULT 'WC',
    stage            text,
    matchday         integer
);

CREATE TABLE IF NOT EXISTS predictions (
    "userId"    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "matchId"   uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    "homeScore" integer NOT NULL,
    "awayScore" integer NOT NULL,
    timestamp   timestamptz DEFAULT now(),
    "groupId"   uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    points      integer DEFAULT 0,
    PRIMARY KEY ("userId", "matchId", "groupId")
);

CREATE TABLE IF NOT EXISTS tournament_predictions (
    "userId"            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "championTeamId"    uuid REFERENCES teams(id),
    "topScorerPlayer"   text,
    "topScorerGoals"    integer,
    "bestPlayer"        text,
    "bestGoalkeeper"    text
);

CREATE TABLE IF NOT EXISTS team_standings (
    "teamId"          uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    "competitionCode" character varying NOT NULL REFERENCES competitions(code) ON DELETE CASCADE,
    season            text,
    stage             text,
    type              text,
    "group"           text NOT NULL DEFAULT 'Temporada Regular',
    position          integer,
    "playedGames"     integer,
    form              text,
    won               integer,
    draw              integer,
    lost              integer,
    points            integer,
    "goalsFor"        integer,
    "goalsAgainst"    integer,
    "goalDifference"  integer,
    "updatedAt"       text,
    PRIMARY KEY ("teamId", "competitionCode", "group")
);

ALTER TABLE team_standings REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS system_config (
    id                    uuid PRIMARY KEY,
    is_auto_sync_enabled  boolean DEFAULT false,
    sync_interval_ms      integer DEFAULT 60000
);

-- =============================================================================
-- FUNÇÃO HELPER
-- =============================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE "userId" = auth.uid() AND role = 'ADMIN'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- =============================================================================
-- RLS — habilitar em todas as tabelas
-- (As políticas ficam em database/rls/current.sql)
-- =============================================================================
ALTER TABLE competitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE stadiums            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_standings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config       ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- REALTIME
-- =============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;        EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;             EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_groups;        EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;            EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;        EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;      EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.team_standings;     EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
