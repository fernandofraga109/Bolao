-- =============================================================================
-- Bolão Copa do Mundo 2026 — Políticas RLS Ativas
-- Gerado/limpo a partir do estado real do banco em 2026-05-10
--
-- Este arquivo é a fonte da verdade das políticas.
-- Execute em cima de um schema já criado (0001_create_tables.sql).
-- É idempotente: dropa todas as políticas conhecidas antes de recriar.
--
-- SCHEMA: deve ser o mesmo schema usado em 0001.
-- =============================================================================
SET search_path TO public;

-- =============================================================================
-- COMPETITIONS
-- Leitura pública, escrita autenticada para lastSync, admin para o resto
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated admins" ON competitions;
DROP POLICY IF EXISTS "Enable read access for all users" ON competitions;
DROP POLICY IF EXISTS "Public can read competitions" ON competitions;
DROP POLICY IF EXISTS "Authenticated users can update competition sync" ON competitions;

CREATE POLICY "competitions_select" ON competitions
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "competitions_update_sync" ON competitions
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "competitions_admin_all" ON competitions
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- =============================================================================
-- TEAMS
-- Leitura pública, upsert por usuário autenticado (necessário para sync),
-- deleção restrita a admin
-- =============================================================================
DROP POLICY IF EXISTS "Public Read Teams" ON teams;
DROP POLICY IF EXISTS "Public Write Teams" ON teams;
DROP POLICY IF EXISTS "Teams sync write authenticated" ON teams;
DROP POLICY IF EXISTS "Authenticated users can upsert teams" ON teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON teams;
DROP POLICY IF EXISTS "Public can read teams" ON teams;

CREATE POLICY "teams_select" ON teams
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "teams_insert" ON teams
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "teams_update" ON teams
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "teams_delete_admin" ON teams
    FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- STADIUMS
-- Leitura pública, escrita apenas para admin
-- =============================================================================
DROP POLICY IF EXISTS "Public Read Stadiums" ON stadiums;
DROP POLICY IF EXISTS "Public Write Stadiums" ON stadiums;
DROP POLICY IF EXISTS "Stadiums write admin only" ON stadiums;

CREATE POLICY "stadiums_select" ON stadiums
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "stadiums_admin_all" ON stadiums
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- =============================================================================
-- USER_ROLES
-- Leitura: próprio usuário, membros do mesmo grupo, ou admin
-- Escrita: próprio usuário ou admin (admin pode deletar)
-- =============================================================================
DROP POLICY IF EXISTS "Public Access UserRoles" ON user_roles;
DROP POLICY IF EXISTS "UserRoles read own or shared group or admin" ON user_roles;
DROP POLICY IF EXISTS "UserRoles insert own or admin" ON user_roles;
DROP POLICY IF EXISTS "UserRoles update own or admin" ON user_roles;
DROP POLICY IF EXISTS "UserRoles delete admin only" ON user_roles;

CREATE POLICY "user_roles_select" ON user_roles
    FOR SELECT TO authenticated
    USING (
        is_admin()
        OR auth.uid() = "userId"
        OR EXISTS (
            SELECT 1 FROM user_groups me
            JOIN user_groups other ON other."groupId" = me."groupId"
            WHERE me."userId" = auth.uid() AND other."userId" = user_roles."userId"
        )
    );

CREATE POLICY "user_roles_insert" ON user_roles
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "user_roles_update" ON user_roles
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "user_roles_delete_admin" ON user_roles
    FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- GROUPS
-- Leitura pública (anon + authenticated), escrita apenas por admin
-- Anon precisa ler grupos para validar código durante o cadastro (pré-auth)
-- =============================================================================
DROP POLICY IF EXISTS "Public Access Groups" ON groups;
DROP POLICY IF EXISTS "Groups read authenticated" ON groups;
DROP POLICY IF EXISTS "Groups write admin only" ON groups;
DROP POLICY IF EXISTS "groups_select_anon" ON groups;

CREATE POLICY "groups_select" ON groups
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "groups_admin_all" ON groups
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- =============================================================================
-- USER_GROUPS
-- Leitura por autenticados, escrita pelo próprio usuário ou admin,
-- UPDATE de pontos por qualquer autenticado (necessário para sync passivo)
-- =============================================================================
DROP POLICY IF EXISTS "Public Access UserGroups" ON user_groups;
DROP POLICY IF EXISTS "Full Access UserGroups" ON user_groups;
DROP POLICY IF EXISTS "Authenticated users can read user_groups" ON user_groups;
DROP POLICY IF EXISTS "Authenticated users can update user_groups points" ON user_groups;
DROP POLICY IF EXISTS "Admins can do everything on user_groups" ON user_groups;
DROP POLICY IF EXISTS "UserGroups read authenticated" ON user_groups;
DROP POLICY IF EXISTS "UserGroups insert own or admin" ON user_groups;
DROP POLICY IF EXISTS "UserGroups update own or admin" ON user_groups;
DROP POLICY IF EXISTS "UserGroups delete own or admin" ON user_groups;

CREATE POLICY "user_groups_select" ON user_groups
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_groups_insert" ON user_groups
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");

-- Permite UPDATE amplo para que o sync passivo possa atualizar pontos de todos
CREATE POLICY "user_groups_update" ON user_groups
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "user_groups_delete" ON user_groups
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- =============================================================================
-- MATCHES
-- Leitura pública, upsert por autenticados (sync), deleção por admin
-- =============================================================================
DROP POLICY IF EXISTS "Public Read Matches" ON matches;
DROP POLICY IF EXISTS "Admin Edit Matches" ON matches;
DROP POLICY IF EXISTS "Matches sync write authenticated" ON matches;
DROP POLICY IF EXISTS "Authenticated users can upsert matches" ON matches;
DROP POLICY IF EXISTS "Authenticated users can update matches" ON matches;
DROP POLICY IF EXISTS "Public can read matches" ON matches;

CREATE POLICY "matches_select" ON matches
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "matches_insert" ON matches
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "matches_update" ON matches
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "matches_delete_admin" ON matches
    FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- PREDICTIONS
-- Leitura por autenticados, escrita pelo próprio usuário ou admin
-- =============================================================================
DROP POLICY IF EXISTS "Public Access Predictions" ON predictions;
DROP POLICY IF EXISTS "Predictions read authenticated" ON predictions;
DROP POLICY IF EXISTS "Authenticated users can read all predictions" ON predictions;
DROP POLICY IF EXISTS "Predictions insert own or admin" ON predictions;
DROP POLICY IF EXISTS "Users can upsert their own predictions" ON predictions;
DROP POLICY IF EXISTS "Predictions update own or admin" ON predictions;
DROP POLICY IF EXISTS "Users can update their own predictions" ON predictions;
DROP POLICY IF EXISTS "Users can update their own prediction points" ON predictions;
DROP POLICY IF EXISTS "Predictions delete own or admin" ON predictions;
DROP POLICY IF EXISTS "Admins can do everything on predictions" ON predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON predictions;
DROP POLICY IF EXISTS "predictions_update" ON predictions;
DROP POLICY IF EXISTS "predictions_update_points_sync" ON predictions;

CREATE POLICY "predictions_select" ON predictions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "predictions_insert" ON predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");

-- Qualquer autenticado pode ler/atualizar pontos (sync passivo precisa atualizar
-- predictions.points de todos os membros do grupo). Inserção/deleção ainda exige
-- ser o dono ou admin.
CREATE POLICY "predictions_update" ON predictions
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "predictions_delete" ON predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- =============================================================================
-- TOURNAMENT_PREDICTIONS
-- Leitura por autenticados, escrita pelo próprio usuário ou admin
-- =============================================================================
DROP POLICY IF EXISTS "Public Access TournPreds" ON tournament_predictions;
DROP POLICY IF EXISTS "TournPreds read authenticated" ON tournament_predictions;
DROP POLICY IF EXISTS "TournPreds insert own or admin" ON tournament_predictions;
DROP POLICY IF EXISTS "TournPreds update own or admin" ON tournament_predictions;
DROP POLICY IF EXISTS "TournPreds delete own or admin" ON tournament_predictions;

CREATE POLICY "tourn_preds_select" ON tournament_predictions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "tourn_preds_insert" ON tournament_predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "tourn_preds_update" ON tournament_predictions
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "tourn_preds_delete" ON tournament_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- =============================================================================
-- TEAM_STANDINGS
-- Leitura pública, upsert por autenticados (sync)
-- =============================================================================
DROP POLICY IF EXISTS "Public Read Team Standings" ON team_standings;
DROP POLICY IF EXISTS "Auth Edit Team Standings" ON team_standings;
DROP POLICY IF EXISTS "Authenticated users can upsert team_standings" ON team_standings;
DROP POLICY IF EXISTS "Authenticated users can update team_standings" ON team_standings;
DROP POLICY IF EXISTS "Public can read team_standings" ON team_standings;

CREATE POLICY "team_standings_select" ON team_standings
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "team_standings_insert" ON team_standings
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "team_standings_update" ON team_standings
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "team_standings_delete_admin" ON team_standings
    FOR DELETE TO authenticated USING (is_admin());

-- =============================================================================
-- SYSTEM_CONFIG
-- Leitura pública, escrita apenas para admin
-- =============================================================================
DROP POLICY IF EXISTS "Public Read Config" ON system_config;
DROP POLICY IF EXISTS "Public Update Config" ON system_config;
DROP POLICY IF EXISTS "Public Insert Config" ON system_config;
DROP POLICY IF EXISTS "System config write admin only" ON system_config;

CREATE POLICY "system_config_select" ON system_config
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "system_config_admin_all" ON system_config
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
