-- =============================================================================
-- Bolão Copa do Mundo 2026 — Migração Isolada V2 (Sem Alterar Tabelas Atuais)
--
-- Este script faz o seguinte:
-- 1. Clona toda a estrutura e copia todos os dados para novas tabelas "v2_"
-- 2. Aplica as colunas e tabelas do Regulamento 2 APENAS nas novas tabelas "v2_"
--
-- Executar este script no editor SQL do Supabase.
-- =============================================================================
SET search_path TO public;

-- =============================================================================
-- PASSO 1: CLONAR ESTRUTURA E COPIAR DADOS DAS TABELAS EM ORDEM DE DEPENDÊNCIA
-- =============================================================================

-- 1. competitions
CREATE TABLE IF NOT EXISTS public.v2_competitions (LIKE public.competitions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_competitions SELECT * FROM public.competitions ON CONFLICT DO NOTHING;

-- 2. stadiums
CREATE TABLE IF NOT EXISTS public.v2_stadiums (LIKE public.stadiums INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_stadiums SELECT * FROM public.stadiums ON CONFLICT DO NOTHING;

-- 3. teams
CREATE TABLE IF NOT EXISTS public.v2_teams (LIKE public.teams INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_teams SELECT * FROM public.teams ON CONFLICT DO NOTHING;

-- 4. system_config
CREATE TABLE IF NOT EXISTS public.v2_system_config (LIKE public.system_config INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_system_config SELECT * FROM public.system_config ON CONFLICT DO NOTHING;

-- 5. user_roles (Profiles/Dados Básicos)
CREATE TABLE IF NOT EXISTS public.v2_user_roles (LIKE public.user_roles INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_user_roles SELECT * FROM public.user_roles ON CONFLICT DO NOTHING;

-- 6. matches
CREATE TABLE IF NOT EXISTS public.v2_matches (LIKE public.matches INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_matches SELECT * FROM public.matches ON CONFLICT DO NOTHING;

-- 7. groups
CREATE TABLE IF NOT EXISTS public.v2_groups (LIKE public.groups INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_groups SELECT * FROM public.groups ON CONFLICT DO NOTHING;

-- 8. user_groups (Relacionamento)
CREATE TABLE IF NOT EXISTS public.v2_user_groups (LIKE public.user_groups INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_user_groups SELECT * FROM public.user_groups ON CONFLICT DO NOTHING;

-- 9. predictions (Palpites normais)
CREATE TABLE IF NOT EXISTS public.v2_predictions (LIKE public.predictions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_predictions SELECT * FROM public.predictions ON CONFLICT DO NOTHING;

-- 10. tournament_predictions (Palpites pré-Copa)
CREATE TABLE IF NOT EXISTS public.v2_tournament_predictions (LIKE public.tournament_predictions INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_tournament_predictions SELECT * FROM public.tournament_predictions ON CONFLICT DO NOTHING;

-- 11. team_standings
CREATE TABLE IF NOT EXISTS public.v2_team_standings (LIKE public.team_standings INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);
INSERT INTO public.v2_team_standings SELECT * FROM public.team_standings ON CONFLICT DO NOTHING;


-- =============================================================================
-- PASSO 2: APLICAR ALTERAÇÕES DO REGULAMENTO 2 EXCLUSIVAMENTE NAS TABELAS V2_
-- =============================================================================

-- Adicionar seleção de regulamento na tabela clonada "v2_groups"
ALTER TABLE public.v2_groups ADD COLUMN IF NOT EXISTS "ruleset" text NOT NULL DEFAULT 'regulamento_1';

-- Adicionar colunas de palpites extras na tabela clonada "v2_tournament_predictions"
ALTER TABLE public.v2_tournament_predictions ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES public.v2_teams(id) ON DELETE SET NULL;
ALTER TABLE public.v2_tournament_predictions ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES public.v2_teams(id) ON DELETE SET NULL;

-- Criar tabela "v2_extra_phase_predictions" apontando para a estrutura V2_
CREATE TABLE IF NOT EXISTS public.v2_extra_phase_predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" uuid NOT NULL REFERENCES public.v2_groups(id) ON DELETE CASCADE,
    "phase" text NOT NULL, -- Ex: 'groups', 'oitavas', 'quartas', 'semi'
    "matchId" uuid REFERENCES public.v2_matches(id) ON DELETE SET NULL,
    "createdAt" timestamptz DEFAULT now(),
    PRIMARY KEY ("userId", "groupId", "phase")
);


-- =============================================================================
-- PASSO 3: SEGURANÇA E POLÍTICAS RLS PARA O AMBIENTE V2
-- =============================================================================

ALTER TABLE public.v2_extra_phase_predictions ENABLE ROW LEVEL SECURITY;

-- Remover políticas se existirem
DROP POLICY IF EXISTS "v2_extra_phase_preds_select" ON public.v2_extra_phase_predictions;
DROP POLICY IF EXISTS "v2_extra_phase_preds_insert" ON public.v2_extra_phase_predictions;
DROP POLICY IF EXISTS "v2_extra_phase_preds_update" ON public.v2_extra_phase_predictions;
DROP POLICY IF EXISTS "v2_extra_phase_preds_delete" ON public.v2_extra_phase_predictions;

-- Criar políticas apontando para a nova tabela V2
CREATE POLICY "v2_extra_phase_preds_select" ON public.v2_extra_phase_predictions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "v2_extra_phase_preds_insert" ON public.v2_extra_phase_predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "v2_extra_phase_preds_update" ON public.v2_extra_phase_predictions
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "v2_extra_phase_preds_delete" ON public.v2_extra_phase_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");


-- =============================================================================
-- PASSO 4: REGISTRAR TABELAS V2 NO REALTIME DO SUPABASE
-- =============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_groups; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_tournament_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_extra_phase_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v2_predictions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
