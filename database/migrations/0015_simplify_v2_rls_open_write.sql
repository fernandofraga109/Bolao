-- =============================================================================
-- Bolão Copa do Mundo 2026 — Simplificar RLS das tabelas v2_
--
-- CONTEXTO: As políticas do script 0014 eram muito restritivas. O app permite
-- que qualquer usuário autenticado dispare operações de escrita em qualquer
-- tabela (sync passivo, atualização de pontos, etc.). Tentativas de granular
-- INSERT/UPDATE/DELETE por usuário causavam erros 403 difíceis de rastrear.
--
-- MODELO ADOTADO:
--   - SELECT: anon + authenticated (sem restrição)
--   - INSERT: qualquer authenticated (WITH CHECK (true))
--   - UPDATE: qualquer authenticated (USING (true) WITH CHECK (true))
--   - DELETE: qualquer authenticated (USING (true))
--
-- A segurança real é garantida pela camada de UI/app (somente admins veem
-- certas ações; tokens JWT do Supabase Auth identificam o usuário).
--
-- Execute no SQL Editor do Supabase.
-- =============================================================================
SET search_path TO public;

-- =============================================================================
-- PASSO 1: REMOVER TODAS AS POLÍTICAS v2_ EXISTENTES
-- =============================================================================

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename LIKE 'v2_%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- =============================================================================
-- PASSO 2: CRIAR POLÍTICAS ABERTAS PARA TODOS OS AUTENTICADOS
-- =============================================================================

-- ---- v2_competitions ----
CREATE POLICY "v2_competitions_select"  ON public.v2_competitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_competitions_insert"  ON public.v2_competitions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_competitions_update"  ON public.v2_competitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_competitions_delete"  ON public.v2_competitions FOR DELETE TO authenticated USING (true);

-- ---- v2_stadiums ----
CREATE POLICY "v2_stadiums_select"  ON public.v2_stadiums FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_stadiums_insert"  ON public.v2_stadiums FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_stadiums_update"  ON public.v2_stadiums FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_stadiums_delete"  ON public.v2_stadiums FOR DELETE TO authenticated USING (true);

-- ---- v2_teams ----
CREATE POLICY "v2_teams_select"  ON public.v2_teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_teams_insert"  ON public.v2_teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_teams_update"  ON public.v2_teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_teams_delete"  ON public.v2_teams FOR DELETE TO authenticated USING (true);

-- ---- v2_system_config ----
CREATE POLICY "v2_system_config_select"  ON public.v2_system_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_system_config_insert"  ON public.v2_system_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_system_config_update"  ON public.v2_system_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_system_config_delete"  ON public.v2_system_config FOR DELETE TO authenticated USING (true);

-- ---- v2_user_roles ----
CREATE POLICY "v2_user_roles_select"  ON public.v2_user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_user_roles_insert"  ON public.v2_user_roles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_user_roles_update"  ON public.v2_user_roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_user_roles_delete"  ON public.v2_user_roles FOR DELETE TO authenticated USING (true);

-- ---- v2_groups ----
CREATE POLICY "v2_groups_select"  ON public.v2_groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_groups_insert"  ON public.v2_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_groups_update"  ON public.v2_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_groups_delete"  ON public.v2_groups FOR DELETE TO authenticated USING (true);

-- ---- v2_user_groups ----
CREATE POLICY "v2_user_groups_select"  ON public.v2_user_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_user_groups_insert"  ON public.v2_user_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_user_groups_update"  ON public.v2_user_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_user_groups_delete"  ON public.v2_user_groups FOR DELETE TO authenticated USING (true);

-- ---- v2_matches ----
CREATE POLICY "v2_matches_select"  ON public.v2_matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_matches_insert"  ON public.v2_matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_matches_update"  ON public.v2_matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_matches_delete"  ON public.v2_matches FOR DELETE TO authenticated USING (true);

-- ---- v2_predictions ----
CREATE POLICY "v2_predictions_select"  ON public.v2_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_predictions_insert"  ON public.v2_predictions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_predictions_update"  ON public.v2_predictions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_predictions_delete"  ON public.v2_predictions FOR DELETE TO authenticated USING (true);

-- ---- v2_tournament_predictions ----
CREATE POLICY "v2_tourn_preds_select"  ON public.v2_tournament_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_tourn_preds_insert"  ON public.v2_tournament_predictions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_tourn_preds_update"  ON public.v2_tournament_predictions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_tourn_preds_delete"  ON public.v2_tournament_predictions FOR DELETE TO authenticated USING (true);

-- ---- v2_team_standings ----
CREATE POLICY "v2_team_standings_select"  ON public.v2_team_standings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_team_standings_insert"  ON public.v2_team_standings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_team_standings_update"  ON public.v2_team_standings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_team_standings_delete"  ON public.v2_team_standings FOR DELETE TO authenticated USING (true);

-- ---- v2_extra_phase_predictions ----
CREATE POLICY "v2_extra_phase_preds_select"  ON public.v2_extra_phase_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "v2_extra_phase_preds_insert"  ON public.v2_extra_phase_predictions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_extra_phase_preds_update"  ON public.v2_extra_phase_predictions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_extra_phase_preds_delete"  ON public.v2_extra_phase_predictions FOR DELETE TO authenticated USING (true);

-- =============================================================================
-- PASSO 3: GARANTIR QUE RLS ESTÁ HABILITADO (idempotente)
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
