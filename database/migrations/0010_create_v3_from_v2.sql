-- =============================================================================
-- Bolão Copa do Mundo 2026 — Migração V3 (Cópia Completa das Tabelas V2)
--
-- Este script faz o seguinte:
-- 1. Clona toda a estrutura das tabelas "v2_" para novas tabelas "v3_"
-- 2. Copia todos os dados das tabelas "v2_" para as tabelas "v3_"
-- 3. Adiciona Foreign Keys apontando para tabelas V3
-- 4. Configura RLS e políticas para as tabelas V3
-- 5. Registra tabelas V3 no Realtime do Supabase
--
-- Executar este script no editor SQL do Supabase.
-- Gerado em: 2026-05-19
-- =============================================================================
SET search_path TO public;

-- =============================================================================
-- PASSO 1: CLONAR ESTRUTURA E COPIAR DADOS (V2 → V3)
-- Ordem de dependência respeitada para evitar problemas com FKs
-- NOTA: REMOVIDO INCLUDING CONSTRAINTS para evitar FKs apontando para V2
-- =============================================================================

-- 1. competitions (sem dependências)
CREATE TABLE IF NOT EXISTS public.v3_competitions (LIKE public.v2_competitions INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_competitions SELECT * FROM public.v2_competitions ON CONFLICT DO NOTHING;

-- 2. stadiums (sem dependências)
CREATE TABLE IF NOT EXISTS public.v3_stadiums (LIKE public.v2_stadiums INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_stadiums SELECT * FROM public.v2_stadiums ON CONFLICT DO NOTHING;

-- 3. teams (sem dependências)
CREATE TABLE IF NOT EXISTS public.v3_teams (LIKE public.v2_teams INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_teams SELECT * FROM public.v2_teams ON CONFLICT DO NOTHING;

-- 4. system_config (sem dependências)
CREATE TABLE IF NOT EXISTS public.v3_system_config (LIKE public.v2_system_config INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_system_config SELECT * FROM public.v2_system_config ON CONFLICT DO NOTHING;

-- 5. user_roles (depende de auth.users; FK para groups adicionada no Passo 2)
CREATE TABLE IF NOT EXISTS public.v3_user_roles (LIKE public.v2_user_roles INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_user_roles SELECT * FROM public.v2_user_roles ON CONFLICT DO NOTHING;

-- 6. groups (depende de auth.users)
CREATE TABLE IF NOT EXISTS public.v3_groups (LIKE public.v2_groups INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_groups SELECT * FROM public.v2_groups ON CONFLICT DO NOTHING;

-- 7. user_groups (depende de auth.users + groups)
CREATE TABLE IF NOT EXISTS public.v3_user_groups (LIKE public.v2_user_groups INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_user_groups
SELECT ug.*
FROM public.v2_user_groups ug
INNER JOIN public.v3_user_roles ur ON ug."userId" = ur."userId"
INNER JOIN public.v3_groups g ON ug."groupId" = g.id;

-- 8. matches (depende de teams + stadiums)
CREATE TABLE IF NOT EXISTS public.v3_matches (LIKE public.v2_matches INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_matches
SELECT m.*
FROM public.v2_matches m
INNER JOIN public.v3_teams ht ON m."homeTeamId" = ht.id
INNER JOIN public.v3_teams at ON m."awayTeamId" = at.id
LEFT JOIN public.v3_stadiums s ON m."stadiumId" = s.id;

-- 9. predictions (depende de auth.users + matches + groups)
CREATE TABLE IF NOT EXISTS public.v3_predictions (LIKE public.v2_predictions INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_predictions
SELECT p.*
FROM public.v2_predictions p
INNER JOIN public.v3_user_roles ur ON p."userId" = ur."userId"
INNER JOIN public.v3_matches m ON p."matchId" = m.id
INNER JOIN public.v3_groups g ON p."groupId" = g.id;

-- 10. tournament_predictions (depende de auth.users + teams + groups)
CREATE TABLE IF NOT EXISTS public.v3_tournament_predictions (LIKE public.v2_tournament_predictions INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_tournament_predictions
SELECT tp.*
FROM public.v2_tournament_predictions tp
INNER JOIN public.v3_user_roles ur ON tp."userId" = ur."userId"
INNER JOIN public.v3_groups g ON tp."groupId" = g.id;

-- 11. team_standings (depende de teams + competitions)
CREATE TABLE IF NOT EXISTS public.v3_team_standings (LIKE public.v2_team_standings INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_team_standings
SELECT ts.*
FROM public.v2_team_standings ts
INNER JOIN public.v3_teams t ON ts."teamId" = t.id
INNER JOIN public.v3_competitions c ON ts."competitionCode" = c.code;

-- 12. extra_phase_predictions (depende de auth.users + groups + matches)
CREATE TABLE IF NOT EXISTS public.v3_extra_phase_predictions (LIKE public.v2_extra_phase_predictions INCLUDING DEFAULTS INCLUDING INDEXES);
INSERT INTO public.v3_extra_phase_predictions
SELECT epp.*
FROM public.v2_extra_phase_predictions epp
INNER JOIN public.v3_user_roles ur ON epp."userId" = ur."userId"
INNER JOIN public.v3_groups g ON epp."groupId" = g.id
LEFT JOIN public.v3_matches m ON epp."matchId" = m.id;


-- =============================================================================
-- PASSO 2: FOREIGN KEYS (apontando para tabelas V3)
-- LIKE não copia FKs, então adicionamos manualmente
-- =============================================================================

-- v3_user_roles
ALTER TABLE public.v3_user_roles
    ADD CONSTRAINT v3_user_roles_userId_fkey
    FOREIGN KEY ("userId") REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.v3_user_roles
    ADD CONSTRAINT v3_user_roles_activeGroupId_fkey
    FOREIGN KEY ("activeGroupId") REFERENCES public.v3_groups(id) ON DELETE SET NULL;

-- v3_groups
ALTER TABLE public.v3_groups
    ADD CONSTRAINT v3_groups_adminId_fkey
    FOREIGN KEY ("adminId") REFERENCES auth.users(id) ON DELETE CASCADE;

-- v3_user_groups
ALTER TABLE public.v3_user_groups
    ADD CONSTRAINT v3_user_groups_userId_fkey
    FOREIGN KEY ("userId") REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.v3_user_groups
    ADD CONSTRAINT v3_user_groups_groupId_fkey
    FOREIGN KEY ("groupId") REFERENCES public.v3_groups(id) ON DELETE CASCADE;

-- v3_matches
ALTER TABLE public.v3_matches
    ADD CONSTRAINT v3_matches_homeTeamId_fkey
    FOREIGN KEY ("homeTeamId") REFERENCES public.v3_teams(id);

ALTER TABLE public.v3_matches
    ADD CONSTRAINT v3_matches_awayTeamId_fkey
    FOREIGN KEY ("awayTeamId") REFERENCES public.v3_teams(id);

ALTER TABLE public.v3_matches
    ADD CONSTRAINT v3_matches_stadiumId_fkey
    FOREIGN KEY ("stadiumId") REFERENCES public.v3_stadiums(id);

-- v3_predictions
ALTER TABLE public.v3_predictions
    ADD CONSTRAINT v3_predictions_userId_fkey
    FOREIGN KEY ("userId") REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.v3_predictions
    ADD CONSTRAINT v3_predictions_matchId_fkey
    FOREIGN KEY ("matchId") REFERENCES public.v3_matches(id) ON DELETE CASCADE;

ALTER TABLE public.v3_predictions
    ADD CONSTRAINT v3_predictions_groupId_fkey
    FOREIGN KEY ("groupId") REFERENCES public.v3_groups(id) ON DELETE CASCADE;

-- v3_tournament_predictions
ALTER TABLE public.v3_tournament_predictions
    ADD CONSTRAINT v3_tourn_preds_userId_fkey
    FOREIGN KEY ("userId") REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.v3_tournament_predictions
    ADD CONSTRAINT v3_tourn_preds_championTeamId_fkey
    FOREIGN KEY ("championTeamId") REFERENCES public.v3_teams(id);

DO $$
BEGIN
    -- FK para groupId (adicionado na migração 0006)
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'v3_tournament_predictions' AND column_name = 'groupId'
    ) THEN
        ALTER TABLE public.v3_tournament_predictions
            ADD CONSTRAINT v3_tourn_preds_groupId_fkey
            FOREIGN KEY ("groupId") REFERENCES public.v3_groups(id) ON DELETE CASCADE;
    END IF;

    -- FK para mostGoalsTeamId (adicionado na migração 0002 regulamento 2)
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'v3_tournament_predictions' AND column_name = 'mostGoalsTeamId'
    ) THEN
        ALTER TABLE public.v3_tournament_predictions
            ADD CONSTRAINT v3_tourn_preds_mostGoalsTeamId_fkey
            FOREIGN KEY ("mostGoalsTeamId") REFERENCES public.v3_teams(id) ON DELETE SET NULL;
    END IF;

    -- FK para mostConcededTeamId (adicionado na migração 0002 regulamento 2)
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'v3_tournament_predictions' AND column_name = 'mostConcededTeamId'
    ) THEN
        ALTER TABLE public.v3_tournament_predictions
            ADD CONSTRAINT v3_tourn_preds_mostConcededTeamId_fkey
            FOREIGN KEY ("mostConcededTeamId") REFERENCES public.v3_teams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- v3_team_standings
ALTER TABLE public.v3_team_standings
    ADD CONSTRAINT v3_team_standings_teamId_fkey
    FOREIGN KEY ("teamId") REFERENCES public.v3_teams(id) ON DELETE CASCADE;

ALTER TABLE public.v3_team_standings
    ADD CONSTRAINT v3_team_standings_competitionCode_fkey
    FOREIGN KEY ("competitionCode") REFERENCES public.v3_competitions(code) ON DELETE CASCADE;

ALTER TABLE public.v3_team_standings REPLICA IDENTITY FULL;

-- v3_extra_phase_predictions
ALTER TABLE public.v3_extra_phase_predictions
    ADD CONSTRAINT v3_extra_phase_preds_userId_fkey
    FOREIGN KEY ("userId") REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.v3_extra_phase_predictions
    ADD CONSTRAINT v3_extra_phase_preds_groupId_fkey
    FOREIGN KEY ("groupId") REFERENCES public.v3_groups(id) ON DELETE CASCADE;

ALTER TABLE public.v3_extra_phase_predictions
    ADD CONSTRAINT v3_extra_phase_preds_matchId_fkey
    FOREIGN KEY ("matchId") REFERENCES public.v3_matches(id) ON DELETE SET NULL;


-- =============================================================================
-- PASSO 3: HABILITAR RLS EM TODAS AS TABELAS V3
-- =============================================================================
ALTER TABLE public.v3_competitions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_stadiums                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_teams                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_system_config             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_user_roles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_groups                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_user_groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_matches                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_predictions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_tournament_predictions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_team_standings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v3_extra_phase_predictions   ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- PASSO 4: POLÍTICAS RLS PARA TABELAS V3
-- (Espelho das políticas V2/originais do current.sql)
-- =============================================================================

-- ---- v3_competitions ----
CREATE POLICY "v3_competitions_select" ON public.v3_competitions
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v3_competitions_update_sync" ON public.v3_competitions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v3_competitions_admin_all" ON public.v3_competitions
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v3_stadiums ----
CREATE POLICY "v3_stadiums_select" ON public.v3_stadiums
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v3_stadiums_admin_all" ON public.v3_stadiums
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v3_teams ----
CREATE POLICY "v3_teams_select" ON public.v3_teams
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v3_teams_insert" ON public.v3_teams
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v3_teams_update" ON public.v3_teams
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v3_teams_delete_admin" ON public.v3_teams
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v3_system_config ----
CREATE POLICY "v3_system_config_select" ON public.v3_system_config
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v3_system_config_admin_all" ON public.v3_system_config
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v3_user_roles ----
CREATE POLICY "v3_user_roles_select" ON public.v3_user_roles
    FOR SELECT TO authenticated
    USING (
        is_admin()
        OR auth.uid() = "userId"
        OR EXISTS (
            SELECT 1 FROM public.v3_user_groups me
            JOIN public.v3_user_groups other ON other."groupId" = me."groupId"
            WHERE me."userId" = auth.uid() AND other."userId" = v3_user_roles."userId"
        )
    );
CREATE POLICY "v3_user_roles_insert" ON public.v3_user_roles
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_user_roles_update" ON public.v3_user_roles
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_user_roles_delete_admin" ON public.v3_user_roles
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v3_groups ----
CREATE POLICY "v3_groups_select" ON public.v3_groups
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v3_groups_admin_all" ON public.v3_groups
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ---- v3_user_groups ----
CREATE POLICY "v3_user_groups_select" ON public.v3_user_groups
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "v3_user_groups_insert" ON public.v3_user_groups
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_user_groups_update" ON public.v3_user_groups
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v3_user_groups_delete" ON public.v3_user_groups
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- ---- v3_matches ----
CREATE POLICY "v3_matches_select" ON public.v3_matches
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v3_matches_insert" ON public.v3_matches
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v3_matches_update" ON public.v3_matches
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v3_matches_delete_admin" ON public.v3_matches
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v3_predictions ----
CREATE POLICY "v3_predictions_select" ON public.v3_predictions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "v3_predictions_insert" ON public.v3_predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_predictions_update" ON public.v3_predictions
    FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
CREATE POLICY "v3_predictions_delete" ON public.v3_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- ---- v3_tournament_predictions ----
CREATE POLICY "v3_tourn_preds_select" ON public.v3_tournament_predictions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "v3_tourn_preds_insert" ON public.v3_tournament_predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_tourn_preds_update" ON public.v3_tournament_predictions
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_tourn_preds_delete" ON public.v3_tournament_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- ---- v3_team_standings ----
CREATE POLICY "v3_team_standings_select" ON public.v3_team_standings
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v3_team_standings_insert" ON public.v3_team_standings
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v3_team_standings_update" ON public.v3_team_standings
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v3_team_standings_delete_admin" ON public.v3_team_standings
    FOR DELETE TO authenticated USING (is_admin());

-- ---- v3_extra_phase_predictions ----
CREATE POLICY "v3_extra_phase_preds_select" ON public.v3_extra_phase_predictions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "v3_extra_phase_preds_insert" ON public.v3_extra_phase_predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_extra_phase_preds_update" ON public.v3_extra_phase_predictions
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");
CREATE POLICY "v3_extra_phase_preds_delete" ON public.v3_extra_phase_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");


-- =============================================================================
-- PASSO 5: REGISTRAR TABELAS V3 NO REALTIME DO SUPABASE
-- =============================================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_competitions;            EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_teams;                    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_stadiums;                 EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_user_roles;               EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_groups;                   EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_user_groups;              EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_matches;                  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_predictions;              EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_tournament_predictions;   EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_team_standings;            EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_system_config;            EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.v3_extra_phase_predictions;  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
