-- =============================================================================
-- Bolão Copa do Mundo 2026 — Habilitar RLS nas tabelas v2_
--
-- CONTEXTO: As tabelas v2_ foram criadas como sandbox e tiveram RLS desabilitado
-- intencionalmente (migração 0002). Agora que estão em produção, precisam de RLS.
--
-- Este script:
-- 1. Remove políticas v2_ existentes (idempotente)
-- 2. Cria as políticas corretas (espelho das v3_ de 0010_create_v3_from_v2.sql)
-- 3. Habilita RLS em todas as tabelas v2_
--
-- IMPORTANTE: Execute as políticas ANTES de habilitar o RLS para não bloquear
-- o acesso ao app.
--
-- Execute no SQL Editor do Supabase.
-- Gerado em: 2026-05-31
-- =============================================================================
SET search_path TO public;

-- =============================================================================
-- PASSO 1: REMOVER POLÍTICAS ANTERIORES (idempotente)
-- =============================================================================

-- v2_competitions
DROP POLICY IF EXISTS "v2_competitions_select"      ON public.v2_competitions;
DROP POLICY IF EXISTS "v2_competitions_update_sync" ON public.v2_competitions;
DROP POLICY IF EXISTS "v2_competitions_admin_all"   ON public.v2_competitions;

-- v2_stadiums
DROP POLICY IF EXISTS "v2_stadiums_select"    ON public.v2_stadiums;
DROP POLICY IF EXISTS "v2_stadiums_admin_all" ON public.v2_stadiums;

-- v2_teams
DROP POLICY IF EXISTS "v2_teams_select"       ON public.v2_teams;
DROP POLICY IF EXISTS "v2_teams_insert"       ON public.v2_teams;
DROP POLICY IF EXISTS "v2_teams_update"       ON public.v2_teams;
DROP POLICY IF EXISTS "v2_teams_delete_admin" ON public.v2_teams;

-- v2_system_config
DROP POLICY IF EXISTS "v2_system_config_select"    ON public.v2_system_config;
DROP POLICY IF EXISTS "v2_system_config_admin_all" ON public.v2_system_config;

-- v2_user_roles
DROP POLICY IF EXISTS "v2_user_roles_select"       ON public.v2_user_roles;
DROP POLICY IF EXISTS "v2_user_roles_insert"       ON public.v2_user_roles;
DROP POLICY IF EXISTS "v2_user_roles_update"       ON public.v2_user_roles;
DROP POLICY IF EXISTS "v2_user_roles_delete_admin" ON public.v2_user_roles;

-- v2_groups
DROP POLICY IF EXISTS "v2_groups_select"    ON public.v2_groups;
DROP POLICY IF EXISTS "v2_groups_admin_all" ON public.v2_groups;

-- v2_user_groups
DROP POLICY IF EXISTS "v2_user_groups_select" ON public.v2_user_groups;
DROP POLICY IF EXISTS "v2_user_groups_insert" ON public.v2_user_groups;
DROP POLICY IF EXISTS "v2_user_groups_update" ON public.v2_user_groups;
DROP POLICY IF EXISTS "v2_user_groups_delete" ON public.v2_user_groups;

-- v2_matches
DROP POLICY IF EXISTS "v2_matches_select"       ON public.v2_matches;
DROP POLICY IF EXISTS "v2_matches_insert"       ON public.v2_matches;
DROP POLICY IF EXISTS "v2_matches_update"       ON public.v2_matches;
DROP POLICY IF EXISTS "v2_matches_delete_admin" ON public.v2_matches;

-- v2_predictions
DROP POLICY IF EXISTS "v2_predictions_select" ON public.v2_predictions;
DROP POLICY IF EXISTS "v2_predictions_insert" ON public.v2_predictions;
DROP POLICY IF EXISTS "v2_predictions_update" ON public.v2_predictions;
DROP POLICY IF EXISTS "v2_predictions_delete" ON public.v2_predictions;

-- v2_tournament_predictions
DROP POLICY IF EXISTS "v2_tourn_preds_select" ON public.v2_tournament_predictions;
DROP POLICY IF EXISTS "v2_tourn_preds_insert" ON public.v2_tournament_predictions;
DROP POLICY IF EXISTS "v2_tourn_preds_update" ON public.v2_tournament_predictions;
DROP POLICY IF EXISTS "v2_tourn_preds_delete" ON public.v2_tournament_predictions;

-- v2_team_standings
DROP POLICY IF EXISTS "v2_team_standings_select"       ON public.v2_team_standings;
DROP POLICY IF EXISTS "v2_team_standings_insert"       ON public.v2_team_standings;
DROP POLICY IF EXISTS "v2_team_standings_update"       ON public.v2_team_standings;
DROP POLICY IF EXISTS "v2_team_standings_delete_admin" ON public.v2_team_standings;

-- v2_extra_phase_predictions
DROP POLICY IF EXISTS "v2_extra_phase_preds_select" ON public.v2_extra_phase_predictions;
DROP POLICY IF EXISTS "v2_extra_phase_preds_insert" ON public.v2_extra_phase_predictions;
DROP POLICY IF EXISTS "v2_extra_phase_preds_update" ON public.v2_extra_phase_predictions;
DROP POLICY IF EXISTS "v2_extra_phase_preds_delete" ON public.v2_extra_phase_predictions;


-- =============================================================================
-- PASSO 2: CRIAR POLÍTICAS RLS PARA TABELAS V2_
-- (Espelho das políticas v3_ — migração 0010_create_v3_from_v2.sql)
-- =============================================================================

-- ---- v2_competitions ----
-- Leitura pública, sync por autenticado, escrita total por admin
-- INSERT é necessário para upsert do background sync (INSERT ON CONFLICT DO UPDATE
-- avalia a política INSERT mesmo quando a linha já existe)
CREATE POLICY "v2_competitions_select" ON public.v2_competitions
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_competitions_insert" ON public.v2_competitions
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_competitions_update_sync" ON public.v2_competitions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_competitions_admin_all" ON public.v2_competitions
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v2_stadiums ----
-- Leitura pública, escrita apenas admin
CREATE POLICY "v2_stadiums_select" ON public.v2_stadiums
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_stadiums_admin_all" ON public.v2_stadiums
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v2_teams ----
-- Leitura pública, upsert por autenticado (sync), deleção apenas admin
CREATE POLICY "v2_teams_select" ON public.v2_teams
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_teams_insert" ON public.v2_teams
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_teams_update" ON public.v2_teams
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_teams_delete_admin" ON public.v2_teams
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v2_system_config ----
-- Leitura pública, escrita apenas admin
CREATE POLICY "v2_system_config_select" ON public.v2_system_config
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_system_config_admin_all" ON public.v2_system_config
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v2_user_roles ----
-- Leitura: próprio usuário, membros do mesmo grupo, ou admin
-- Escrita: próprio usuário ou admin
CREATE POLICY "v2_user_roles_select" ON public.v2_user_roles
    FOR SELECT TO authenticated
    USING (
        is_admin()
        OR auth.uid() = "userId"
        OR EXISTS (
            SELECT 1 FROM public.v2_user_groups me
            JOIN public.v2_user_groups other ON other."groupId" = me."groupId"
            WHERE me."userId" = auth.uid() AND other."userId" = v2_user_roles."userId"
        )
    );
CREATE POLICY "v2_user_roles_insert" ON public.v2_user_roles
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v2_user_roles_update" ON public.v2_user_roles
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v2_user_roles_delete_admin" ON public.v2_user_roles
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v2_groups ----
-- Leitura pública (anon precisa ler para validar código de ingresso), escrita admin
CREATE POLICY "v2_groups_select" ON public.v2_groups
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_groups_admin_all" ON public.v2_groups
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v2_user_groups ----
-- Leitura por autenticados, insert pelo próprio ou admin,
-- UPDATE amplo (sync passivo atualiza pontos), deleção pelo próprio ou admin
CREATE POLICY "v2_user_groups_select" ON public.v2_user_groups
    FOR SELECT TO authenticated USING (true);
-- INSERT aberto para permitir upsert de pontos pelo sync passivo (usePointsProcessor)
-- A restrição real fica no DELETE — impede remoção por não-donos
CREATE POLICY "v2_user_groups_insert" ON public.v2_user_groups
    FOR INSERT TO authenticated
    WITH CHECK (true);
CREATE POLICY "v2_user_groups_update" ON public.v2_user_groups
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_user_groups_delete" ON public.v2_user_groups
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- ---- v2_matches ----
-- Leitura pública, upsert por autenticado (sync), deleção admin
CREATE POLICY "v2_matches_select" ON public.v2_matches
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_matches_insert" ON public.v2_matches
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_matches_update" ON public.v2_matches
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_matches_delete_admin" ON public.v2_matches
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v2_predictions ----
-- Leitura por autenticados, insert aberto (usePointsProcessor precisa atualizar pontos
-- de todos os membros do grupo via upsert — INSERT ON CONFLICT avalia a política INSERT
-- mesmo quando a linha já existe), delete pelo próprio ou admin
CREATE POLICY "v2_predictions_select" ON public.v2_predictions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_predictions_insert" ON public.v2_predictions
    FOR INSERT TO authenticated
    WITH CHECK (true);
CREATE POLICY "v2_predictions_update" ON public.v2_predictions
    FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
CREATE POLICY "v2_predictions_delete" ON public.v2_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- ---- v2_tournament_predictions ----
-- Leitura por autenticados, escrita pelo próprio ou admin
CREATE POLICY "v2_tourn_preds_select" ON public.v2_tournament_predictions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_tourn_preds_insert" ON public.v2_tournament_predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v2_tourn_preds_update" ON public.v2_tournament_predictions
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v2_tourn_preds_delete" ON public.v2_tournament_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- ---- v2_team_standings ----
-- Leitura pública, upsert por autenticado (sync)
CREATE POLICY "v2_team_standings_select" ON public.v2_team_standings
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_team_standings_insert" ON public.v2_team_standings
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_team_standings_update" ON public.v2_team_standings
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_team_standings_delete_admin" ON public.v2_team_standings
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v2_extra_phase_predictions ----
-- Leitura por autenticados, escrita pelo próprio ou admin
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
-- PASSO 3: HABILITAR RLS EM TODAS AS TABELAS V2_
-- (somente após criar as políticas acima — caso contrário tudo seria bloqueado)
-- =============================================================================
ALTER TABLE public.v2_competitions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_stadiums                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_teams                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_system_config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_user_roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_groups                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_user_groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_matches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_predictions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_tournament_predictions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_team_standings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_extra_phase_predictions   ENABLE ROW LEVEL SECURITY;
