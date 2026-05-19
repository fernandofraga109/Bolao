-- =============================================================================
-- Bolão Copa do Mundo 2026 — Migração Isolada via Schema V2 (100% Seguro)
--
-- Este script reconstrói o schema "v2" de forma totalmente limpa e
-- copia os dados na ORDEM EXATA DE DEPENDÊNCIA das chaves estrangeiras (Foreign Keys).
-- Isso evita falhas de restrição e garante que os dados sejam copiados 100% com sucesso.
-- =============================================================================

-- 1. APAGAR SCHEMA ANTERIOR PARA EVITAR CONFLITOS E RECONSTRUIR DO ZERO
DROP SCHEMA IF EXISTS v2 CASCADE;
CREATE SCHEMA v2;

-- =============================================================================
-- 2. CRIAR TODAS AS TABELAS CLONADAS
-- =============================================================================

-- competitions
CREATE TABLE v2.competitions (LIKE public.competitions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- stadiums
CREATE TABLE v2.stadiums (LIKE public.stadiums INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- teams
CREATE TABLE v2.teams (LIKE public.teams INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- system_config
CREATE TABLE v2.system_config (LIKE public.system_config INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- groups
CREATE TABLE v2.groups (LIKE public.groups INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- user_roles
CREATE TABLE v2.user_roles (LIKE public.user_roles INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- user_groups
CREATE TABLE v2.user_groups (LIKE public.user_groups INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- matches
CREATE TABLE v2.matches (LIKE public.matches INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- predictions
CREATE TABLE v2.predictions (LIKE public.predictions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- tournament_predictions
CREATE TABLE v2.tournament_predictions (LIKE public.tournament_predictions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

-- team_standings
CREATE TABLE v2.team_standings (LIKE public.team_standings INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);


-- =============================================================================
-- 3. COPIAR OS DADOS NA ORDEM EXATA DE DEPENDÊNCIA
-- =============================================================================

-- 1. competitions
INSERT INTO v2.competitions SELECT * FROM public.competitions;

-- 2. stadiums
INSERT INTO v2.stadiums SELECT * FROM public.stadiums;

-- 3. teams
INSERT INTO v2.teams SELECT * FROM public.teams;

-- 4. system_config
INSERT INTO v2.system_config SELECT * FROM public.system_config;

-- 5. groups
INSERT INTO v2.groups SELECT * FROM public.groups;

-- 6. user_roles
INSERT INTO v2.user_roles SELECT * FROM public.user_roles;

-- 7. user_groups
INSERT INTO v2.user_groups SELECT * FROM public.user_groups;

-- 8. matches
INSERT INTO v2.matches SELECT * FROM public.matches;

-- 9. predictions
INSERT INTO v2.predictions SELECT * FROM public.predictions;

-- 10. tournament_predictions
INSERT INTO v2.tournament_predictions SELECT * FROM public.tournament_predictions;

-- 11. team_standings
INSERT INTO v2.team_standings SELECT * FROM public.team_standings;


-- =============================================================================
-- 4. APLICAR ALTERAÇÕES DO REGULAMENTO 2 DENTRO DO SCHEMA V2
-- =============================================================================

-- Adicionar seleção de regulamento no v2.groups
ALTER TABLE v2.groups ADD COLUMN IF NOT EXISTS "ruleset" text NOT NULL DEFAULT 'regulamento_1';

-- Adicionar colunas de palpites extras no v2.tournament_predictions
ALTER TABLE v2.tournament_predictions ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES v2.teams(id) ON DELETE SET NULL;
ALTER TABLE v2.tournament_predictions ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES v2.teams(id) ON DELETE SET NULL;

-- Criar tabela "v2.extra_phase_predictions"
CREATE TABLE IF NOT EXISTS v2.extra_phase_predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" uuid NOT NULL REFERENCES v2.groups(id) ON DELETE CASCADE,
    "phase" text NOT NULL,
    "matchId" uuid REFERENCES v2.matches(id) ON DELETE SET NULL,
    "createdAt" timestamptz DEFAULT now(),
    PRIMARY KEY ("userId", "groupId", "phase")
);


-- =============================================================================
-- 5. DESABILITAR RLS NO SCHEMA V2 PARA TESTES FACILITADOS
-- =============================================================================
ALTER TABLE v2.competitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.stadiums DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.system_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.user_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.tournament_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.team_standings DISABLE ROW LEVEL SECURITY;
ALTER TABLE v2.extra_phase_predictions DISABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 6. CONCEDER PRIVILÉGIOS DE ACESSO DO SUPABASE AO SCHEMA V2
-- =============================================================================
GRANT USAGE ON SCHEMA v2 TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA v2 TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA v2 TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA v2 GRANT ALL ON TABLES TO anon, authenticated, service_role;


-- =============================================================================
-- 7. REGISTRAR TABELAS V2 NO REALTIME DO SUPABASE
-- =============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE v2.groups; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE v2.tournament_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE v2.extra_phase_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE v2.predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
