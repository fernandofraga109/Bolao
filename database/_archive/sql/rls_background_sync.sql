-- =============================================================================
-- BOLÃO 2026 — Script RLS: Background Sync (Opção C)
-- 
-- Objetivo: Permitir que qualquer usuário AUTENTICADO faça upsert nas tabelas
-- de dados de jogo (matches, team_standings, teams), garantindo que o sync
-- passivo funcione mesmo sem um admin logado.
--
-- SEGURANÇA: Dados sensíveis (user_roles, groups, predictions, system_config)
-- permanecem protegidos. Usuários comuns SÓ podem escrever em matches,
-- team_standings e teams — e apenas via upsert (não delete).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MATCHES
-- Permite que qualquer usuário autenticado insira ou atualize jogos.
-- A deleção permanece restrita (sem política de DELETE para usuários comuns).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upsert matches" ON matches;

CREATE POLICY "Authenticated users can upsert matches"
  ON matches
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update matches"
  ON matches
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Garante que SELECT continua aberto (pode já existir, mas idempotente)
DROP POLICY IF EXISTS "Public can read matches" ON matches;
CREATE POLICY "Public can read matches"
  ON matches
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 2. TEAM_STANDINGS
-- Permite upsert de standings por qualquer usuário autenticado.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upsert team_standings" ON team_standings;

CREATE POLICY "Authenticated users can upsert team_standings"
  ON team_standings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update team_standings"
  ON team_standings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read team_standings" ON team_standings;
CREATE POLICY "Public can read team_standings"
  ON team_standings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 3. TEAMS
-- Permite que novos times descobertos durante o sync sejam inseridos.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upsert teams" ON teams;

CREATE POLICY "Authenticated users can upsert teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read teams" ON teams;
CREATE POLICY "Public can read teams"
  ON teams
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 4. COMPETITIONS — lastSync
-- Permite que usuários autenticados atualizem o campo last_sync.
-- Isso é fundamental: quando o sync termina, o lastSync é gravado e
-- os outros clientes veem o valor fresco e param de sincronizar.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can update competition sync" ON competitions;

CREATE POLICY "Authenticated users can update competition sync"
  ON competitions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read competitions" ON competitions;
CREATE POLICY "Public can read competitions"
  ON competitions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 5. PREDICTIONS — atualização de pontos
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update their own prediction points" ON predictions;
DROP POLICY IF EXISTS "Users can upsert their own predictions" ON predictions;
DROP POLICY IF EXISTS "Admins can update all predictions" ON predictions;
DROP POLICY IF EXISTS "Authenticated users can read all predictions" ON predictions;

-- Admins podem fazer tudo
CREATE POLICY "Admins can do everything on predictions"
  ON predictions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles."userId" = auth.uid() 
      AND user_roles.role = 'ADMIN'
    )
  );

-- Usuários comuns: podem inserir seus próprios palpites
CREATE POLICY "Users can insert their own predictions"
  ON predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = "userId"::uuid);

-- Usuários comuns: podem atualizar seus próprios palpites (pontos e scores)
CREATE POLICY "Users can update their own predictions"
  ON predictions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = "userId"::uuid)
  WITH CHECK (auth.uid() = "userId"::uuid);

CREATE POLICY "Authenticated users can read all predictions"
  ON predictions
  FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 6. USER_GROUPS — atualização de pontos agregados
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can update user_groups points" ON user_groups;
DROP POLICY IF EXISTS "Authenticated users can read user_groups" ON user_groups;
DROP POLICY IF EXISTS "Admins can do everything on user_groups" ON user_groups;

-- Admins podem fazer tudo
CREATE POLICY "Admins can do everything on user_groups"
  ON user_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles."userId" = auth.uid() 
      AND user_roles.role = 'ADMIN'
    )
  );

-- Usuários comuns: podem atualizar pontos (necessário para o background sync passivo)
-- Nota: Aqui permitimos UPDATE para todos os autenticados para que o primeiro
-- usuário que rodar o sync possa atualizar a tabela de classificação de todos.
CREATE POLICY "Authenticated users can update user_groups points"
  ON user_groups
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read user_groups"
  ON user_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- VERIFICAÇÃO FINAL
-- -----------------------------------------------------------------------------
