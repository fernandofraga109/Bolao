-- =============================================================================
-- Bolão Copa do Mundo 2026 — Sandbox de Testes via Prefixação V2_ (100% Compatível)
--
-- Este script faz o seguinte:
-- 1. Remove qualquer tabela prefixada com v2_ legada no schema public.
-- 2. Clona as 11 tabelas de produção originais no schema public com o prefixo "v2_".
-- 3. Copia todos os dados na ordem estrita de chaves estrangeiras.
-- 4. Aplica as alterações e colunas novas do Regulamento 2 nestas tabelas "v2_".
-- 5. Habilita publicação Realtime para o frontend receber atualizações instantâneas.
-- 6. Desabilita RLS nas tabelas de teste (v2_) para homologação livre e sem travamentos.
-- =============================================================================

SET search_path TO public;

-- =============================================================================
-- PASSO 1: APAGAR QUALQUER TABELA V2_ LEGADA
-- =============================================================================
DROP TABLE IF EXISTS public.v2_extra_phase_predictions CASCADE;
DROP TABLE IF EXISTS public.v2_team_standings CASCADE;
DROP TABLE IF EXISTS public.v2_tournament_predictions CASCADE;
DROP TABLE IF EXISTS public.v2_predictions CASCADE;
DROP TABLE IF EXISTS public.v2_matches CASCADE;
DROP TABLE IF EXISTS public.v2_user_groups CASCADE;
DROP TABLE IF EXISTS public.v2_user_roles CASCADE;
DROP TABLE IF EXISTS public.v2_groups CASCADE;
DROP TABLE IF EXISTS public.v2_system_config CASCADE;
DROP TABLE IF EXISTS public.v2_teams CASCADE;
DROP TABLE IF EXISTS public.v2_stadiums CASCADE;
DROP TABLE IF EXISTS public.v2_competitions CASCADE;


-- =============================================================================
-- PASSO 2: CRIAR TODAS AS TABELAS COM PREFIXO v2_ (Estrutura, Defaults, Índices)
-- =============================================================================
CREATE TABLE public.v2_competitions (LIKE public.competitions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_stadiums (LIKE public.stadiums INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_teams (LIKE public.teams INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_system_config (LIKE public.system_config INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_groups (LIKE public.groups INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_user_roles (LIKE public.user_roles INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_user_groups (LIKE public.user_groups INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_matches (LIKE public.matches INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_predictions (LIKE public.predictions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_tournament_predictions (LIKE public.tournament_predictions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
CREATE TABLE public.v2_team_standings (LIKE public.team_standings INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);


-- =============================================================================
-- PASSO 3: COPIAR DADOS ATUAIS NA ORDEM ESTRETA DE DEPENDÊNCIA
-- =============================================================================
INSERT INTO public.v2_competitions SELECT * FROM public.competitions;
INSERT INTO public.v2_stadiums SELECT * FROM public.stadiums;
INSERT INTO public.v2_teams SELECT * FROM public.teams;
INSERT INTO public.v2_system_config SELECT * FROM public.system_config;
INSERT INTO public.v2_groups SELECT * FROM public.groups;
INSERT INTO public.v2_user_roles SELECT * FROM public.user_roles;
INSERT INTO public.v2_user_groups SELECT * FROM public.user_groups;
INSERT INTO public.v2_matches SELECT * FROM public.matches;
INSERT INTO public.v2_predictions SELECT * FROM public.predictions;
INSERT INTO public.v2_tournament_predictions SELECT * FROM public.tournament_predictions;
INSERT INTO public.v2_team_standings SELECT * FROM public.team_standings;


-- =============================================================================
-- PASSO 4: APLICAR MELHORIAS DO REGULAMENTO 2 NAS TABELAS DE TESTE (V2_)
-- =============================================================================

-- 1. Regulamento especial no v2_groups
ALTER TABLE public.v2_groups ADD COLUMN IF NOT EXISTS "ruleset" text NOT NULL DEFAULT 'regulamento_1';

-- 2. Novas apostas extras em v2_tournament_predictions referenciando as tabelas v2_
ALTER TABLE public.v2_tournament_predictions ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES public.v2_teams(id) ON DELETE SET NULL;
ALTER TABLE public.v2_tournament_predictions ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES public.v2_teams(id) ON DELETE SET NULL;

-- 3. Nova tabela de palpites extras por fase (v2_extra_phase_predictions)
CREATE TABLE IF NOT EXISTS public.v2_extra_phase_predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" uuid NOT NULL REFERENCES public.v2_groups(id) ON DELETE CASCADE,
    "phase" text NOT NULL,
    "matchId" uuid REFERENCES public.v2_matches(id) ON DELETE SET NULL,
    "createdAt" timestamptz DEFAULT now(),
    PRIMARY KEY ("userId", "groupId", "phase")
);


-- =============================================================================
-- PASSO 5: DESABILITAR RLS NAS TABELAS V2_ PARA HOMOLOGAÇÃO LIVRE
-- =============================================================================
ALTER TABLE public.v2_competitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_stadiums DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_system_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_user_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_tournament_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_team_standings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_extra_phase_predictions DISABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PASSO 6: REGISTRAR TABELAS PREFIXADAS NO REALTIME DO SUPABASE
-- =============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_groups; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_tournament_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_extra_phase_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
