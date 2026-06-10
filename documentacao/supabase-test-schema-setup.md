# Setup do schema `test` no Supabase (para E2E)

Objetivo: criar um schema **`test`** isolado, espelho 100% do schema de produção
(`public` + prefixo `v2_`), para os testes E2E autenticados rodarem **sem tocar
nos dados de produção**.

---

## ⚡ Resumo / checklist (faça nesta ordem)

Produção é schema **`public`** + prefixo **`v2_`** (ex.: `public.v2_matches`). Criamos
um schema **`test`** clonando a estrutura atual de `public.v2_*` — então **no app só
muda `VITE_SUPABASE_SCHEMA`** (o prefixo `v2_` continua).

- [ ] **1. SQL Editor → rodar a PARTE 1** (Passo 1 abaixo): cria o schema `test`,
      clona as 14 tabelas, recria `test.is_admin()` e `test.v2_acquire_sync_lock`,
      aplica grants, RLS, policies (espelho de prod) e registra no Realtime.
      *Idempotente — pode rodar de novo.*
- [ ] **2. Dashboard → Settings → API → "Exposed schemas" → adicionar `test`**
      (manter `public`). ⚠️ *Não é SQL e todo mundo esquece — sem isso dá erro
      "schema must be one of...".*
- [ ] **3. Dashboard → Authentication → Add user**: criar usuário de teste com
      **"Auto Confirm User"** e **copiar o UUID**.
- [ ] **4. SQL Editor → rodar a PARTE 2** (Passo 4 abaixo): copia dados de
      referência (times/jogos/competições — **não** copia usuários/palpites de
      prod) e cria `user_roles` + grupo `E2ETEST01` + vínculo (cole o UUID do item 3).
- [ ] **5. Apontar app + testes:**
  - App: `VITE_SUPABASE_SCHEMA=test` no `.env.local` (temporário durante os E2E;
    o dev server que o Playwright sobe herda isso). Reverter p/ `public` depois.
  - Testes: `.env.e2e` com `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` e
    `E2E_GROUP_CODE=E2ETEST01`.
- [ ] **6. Rodar** `npm run test:e2e` → os ~21 testes que estavam em `skip` (login,
      palpite, lock) passam a executar de verdade, isolados.

**3 pegadinhas:**
1. Expor o schema na API (item 2) é obrigatório e **não é SQL**.
2. **Auth é global do projeto** — o schema isola os *dados*, não os usuários. Para
   isolamento total de auth, use um **projeto Supabase separado**.
3. O **dev server precisa subir com `VITE_SUPABASE_SCHEMA=test`** — senão o app
   continua batendo em produção mesmo com o schema `test` criado.

> **Pendência opcional (quando puder):** posso deixar isso automático — script
> `dev:e2e` (`vite --mode e2e`) + `VITE_SUPABASE_SCHEMA` via `webServer.env` no
> `playwright.config.ts`, evitando editar `.env.local` a cada rodada. É só pedir.

O detalhamento completo de cada passo (com os scripts SQL prontos) está abaixo. ⬇️

## Decisões / como funciona

- **Schema:** `test` (novo). **Prefixo de tabela:** continua `v2_` → tabelas como
  `test.v2_matches`. Assim, no app **só muda `VITE_SUPABASE_SCHEMA`**; o
  `VITE_DB_TABLE_PREFIX=v2_` permanece.
- **Auth é compartilhada.** `auth.users` é global do projeto Supabase — os usuários
  de teste são os mesmos do projeto, mas os **dados** (grupos, palpites, ranking)
  ficam isolados no schema `test`. Isso é suficiente para E2E.
- O script **clona a estrutura atual** de `public.v2_*` via `LIKE ... INCLUDING ALL`
  → captura automaticamente **todas as colunas/índices/defaults** de todas as
  migrations já aplicadas (0001→0027). FKs não são copiadas pelo `LIKE` —
  intencionalmente omitidas no schema de teste (integridade é validada pelo app;
  RLS e testes não dependem de FK).

> Alternativa mais isolada (porém mais trabalhosa): criar um **projeto Supabase
> separado** e rodar as migrations lá. Se preferir isolamento total de auth,
> me avise. Abaixo seguimos com o schema `test` no mesmo projeto.

---

## Passo 1 — Rodar o SQL de estrutura (SQL Editor)

Cole e execute **PARTE 1** inteira no SQL Editor do Supabase. É **idempotente**
(pode rodar de novo sem quebrar).

```sql
-- ============================================================================
-- PARTE 1 — Schema `test`: estrutura + funções + grants + RLS + realtime
-- Espelho de public.v2_* (Bolão Copa 2026). Idempotente.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS test;

-- 1) Clonar a estrutura de cada tabela v2_ (public → test) ---------------------
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'v2_competitions','v2_stadiums','v2_teams','v2_system_config',
    'v2_user_roles','v2_groups','v2_user_groups','v2_matches',
    'v2_predictions','v2_tournament_predictions','v2_team_standings',
    'v2_extra_phase_predictions','v2_players','v2_tournament_players'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      RAISE NOTICE 'Tabela public.% nao existe — pulando', t;
      CONTINUE;
    END IF;
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS test.%I (LIKE public.%I INCLUDING ALL)', t, t
    );
    -- REPLICA IDENTITY FULL: payload completo no Realtime (UPDATE/DELETE)
    EXECUTE format('ALTER TABLE test.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;

-- 2) Função is_admin() do schema test (lê test.v2_user_roles) ------------------
CREATE OR REPLACE FUNCTION test.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = test, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM test.v2_user_roles
    WHERE "userId" = auth.uid() AND role = 'ADMIN'
  );
$$;
GRANT EXECUTE ON FUNCTION test.is_admin() TO anon, authenticated;

-- 3) Lock de sync (o app chama rpc 'v2_acquire_sync_lock' no schema exposto) ---
CREATE OR REPLACE FUNCTION test.v2_acquire_sync_lock(
  p_competition_code text,
  p_timeout_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SET search_path = test, public
AS $$
DECLARE v_rows_updated integer;
BEGIN
  UPDATE test.v2_competitions
  SET sync_locked_at = NOW()
  WHERE code = p_competition_code
    AND (sync_locked_at IS NULL
         OR sync_locked_at < (NOW() - (p_timeout_seconds || ' seconds')::interval));
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION test.v2_acquire_sync_lock(text, integer) TO anon, authenticated;

-- 4) Grants de schema/tabelas (PostgREST precisa; RLS ainda governa as linhas) -
GRANT USAGE ON SCHEMA test TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA test TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA test TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA test TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA test GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA test GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 5) Habilitar RLS em todas as tabelas ----------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'test' LOOP
    EXECUTE format('ALTER TABLE test.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 6) Limpar policies antigas do schema (re-execução limpa) ---------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'test' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON test.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 7) Policies (espelho de produção; admin via test.is_admin()) -----------------
-- competitions
CREATE POLICY p_sel ON test.v2_competitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_upd ON test.v2_competitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_adm ON test.v2_competitions FOR ALL TO authenticated USING (test.is_admin()) WITH CHECK (test.is_admin());
-- stadiums
CREATE POLICY p_sel ON test.v2_stadiums FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_adm ON test.v2_stadiums FOR ALL TO authenticated USING (test.is_admin()) WITH CHECK (test.is_admin());
-- teams
CREATE POLICY p_sel ON test.v2_teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_ins ON test.v2_teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY p_upd ON test.v2_teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_del ON test.v2_teams FOR DELETE TO authenticated USING (test.is_admin());
-- system_config
CREATE POLICY p_sel ON test.v2_system_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_adm ON test.v2_system_config FOR ALL TO authenticated USING (test.is_admin()) WITH CHECK (test.is_admin());
-- user_roles
CREATE POLICY p_sel ON test.v2_user_roles FOR SELECT TO authenticated
  USING (test.is_admin() OR auth.uid() = "userId"
         OR EXISTS (SELECT 1 FROM test.v2_user_groups me
                    JOIN test.v2_user_groups o ON o."groupId" = me."groupId"
                    WHERE me."userId" = auth.uid() AND o."userId" = v2_user_roles."userId"));
CREATE POLICY p_ins ON test.v2_user_roles FOR INSERT TO authenticated
  WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_upd ON test.v2_user_roles FOR UPDATE TO authenticated
  USING (test.is_admin() OR auth.uid() = "userId")
  WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_del ON test.v2_user_roles FOR DELETE TO authenticated USING (test.is_admin());
-- groups
CREATE POLICY p_sel ON test.v2_groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_adm ON test.v2_groups FOR ALL TO authenticated USING (test.is_admin()) WITH CHECK (test.is_admin());
-- user_groups
CREATE POLICY p_sel ON test.v2_user_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY p_ins ON test.v2_user_groups FOR INSERT TO authenticated WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_upd ON test.v2_user_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_del ON test.v2_user_groups FOR DELETE TO authenticated USING (test.is_admin() OR auth.uid() = "userId");
-- matches
CREATE POLICY p_sel ON test.v2_matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_ins ON test.v2_matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY p_upd ON test.v2_matches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_del ON test.v2_matches FOR DELETE TO authenticated USING (test.is_admin());
-- predictions
CREATE POLICY p_sel ON test.v2_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY p_ins ON test.v2_predictions FOR INSERT TO authenticated WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_upd ON test.v2_predictions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_del ON test.v2_predictions FOR DELETE TO authenticated USING (test.is_admin() OR auth.uid() = "userId");
-- tournament_predictions
CREATE POLICY p_sel ON test.v2_tournament_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY p_ins ON test.v2_tournament_predictions FOR INSERT TO authenticated WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_upd ON test.v2_tournament_predictions FOR UPDATE TO authenticated USING (test.is_admin() OR auth.uid() = "userId") WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_del ON test.v2_tournament_predictions FOR DELETE TO authenticated USING (test.is_admin() OR auth.uid() = "userId");
-- team_standings
CREATE POLICY p_sel ON test.v2_team_standings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_ins ON test.v2_team_standings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY p_upd ON test.v2_team_standings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_del ON test.v2_team_standings FOR DELETE TO authenticated USING (test.is_admin());
-- extra_phase_predictions
CREATE POLICY p_sel ON test.v2_extra_phase_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY p_ins ON test.v2_extra_phase_predictions FOR INSERT TO authenticated WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_upd ON test.v2_extra_phase_predictions FOR UPDATE TO authenticated USING (test.is_admin() OR auth.uid() = "userId") WITH CHECK (test.is_admin() OR auth.uid() = "userId");
CREATE POLICY p_del ON test.v2_extra_phase_predictions FOR DELETE TO authenticated USING (test.is_admin() OR auth.uid() = "userId");
-- players
CREATE POLICY p_sel ON test.v2_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_ins ON test.v2_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY p_upd ON test.v2_players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_del ON test.v2_players FOR DELETE TO authenticated USING (test.is_admin());
-- tournament_players
CREATE POLICY p_sel ON test.v2_tournament_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_ins ON test.v2_tournament_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY p_upd ON test.v2_tournament_players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_del ON test.v2_tournament_players FOR DELETE TO authenticated USING (test.is_admin());

-- 8) Registrar tabelas no Realtime --------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'test' LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE test.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 9) Recarregar o cache do PostgREST ------------------------------------------
NOTIFY pgrst, 'reload schema';
```

---

## Passo 2 — Expor o schema `test` na API (Dashboard)

PostgREST/supabase-js só enxergam schemas explicitamente expostos.

1. Dashboard → **Project Settings → API**.
2. Em **"Exposed schemas"** (Data API / API Settings), adicione **`test`** à lista
   (deixe `public` também). Salve.
3. (Opcional) Em **"Extra search path"**, pode adicionar `test` se quiser.

> Sem este passo, o app retorna erro tipo *"The schema must be one of the
> following: public, ..."*.

---

## Passo 3 — Criar o(s) usuário(s) de teste (Dashboard)

1. Dashboard → **Authentication → Users → Add user**.
2. Crie o usuário comum: e-mail + senha, marque **"Auto Confirm User"**
   (sem confirmação de e-mail).
3. (Opcional, para testes admin) crie um segundo usuário.
4. **Copie o UUID** de cada usuário (coluna `id`) — usado na PARTE 2.

---

## Passo 4 — Seed + bootstrap (SQL Editor — PARTE 2)

Substitua `COLE_O_UUID_DO_USER` (e `COLE_O_UUID_DO_ADMIN`, se houver) pelos UUIDs
do Passo 3. Execute.

```sql
-- ============================================================================
-- PARTE 2 — Seed de referência (copia de public) + usuário/grupo de teste
-- ============================================================================

-- 1) Dados de referência (NÃO copia usuários/palpites de produção) ------------
INSERT INTO test.v2_competitions      SELECT * FROM public.v2_competitions      ON CONFLICT DO NOTHING;
INSERT INTO test.v2_stadiums          SELECT * FROM public.v2_stadiums          ON CONFLICT DO NOTHING;
INSERT INTO test.v2_teams             SELECT * FROM public.v2_teams             ON CONFLICT DO NOTHING;
INSERT INTO test.v2_matches           SELECT * FROM public.v2_matches           ON CONFLICT DO NOTHING;
INSERT INTO test.v2_team_standings    SELECT * FROM public.v2_team_standings    ON CONFLICT DO NOTHING;
INSERT INTO test.v2_players           SELECT * FROM public.v2_players           ON CONFLICT DO NOTHING;
INSERT INTO test.v2_tournament_players SELECT * FROM public.v2_tournament_players ON CONFLICT DO NOTHING;

-- system_config: copia, ou cria o singleton se não houver
INSERT INTO test.v2_system_config SELECT * FROM public.v2_system_config ON CONFLICT DO NOTHING;
INSERT INTO test.v2_system_config (id, is_auto_sync_enabled, sync_interval_ms, underdog_min_rank_diff)
VALUES ('00000000-0000-0000-0000-000000000001', false, 300000, 10)
ON CONFLICT (id) DO NOTHING;

-- 2) Perfil do usuário de teste (USER) ----------------------------------------
INSERT INTO test.v2_user_roles ("userId", "displayName", email, avatar, role)
VALUES ('COLE_O_UUID_DO_USER', 'Usuário E2E', 'e2e@bolao-test.local', '', 'USER')
ON CONFLICT ("userId") DO UPDATE SET role = EXCLUDED.role;

-- (Opcional) usuário ADMIN de teste
-- INSERT INTO test.v2_user_roles ("userId", "displayName", email, avatar, role)
-- VALUES ('COLE_O_UUID_DO_ADMIN', 'Admin E2E', 'admin-e2e@bolao-test.local', '', 'ADMIN')
-- ON CONFLICT ("userId") DO UPDATE SET role = EXCLUDED.role;

-- 3) Grupo de teste com código fixo (E2E_GROUP_CODE) --------------------------
INSERT INTO test.v2_groups (id, name, code, "adminId", "createdAt", "competitionCode", ruleset)
VALUES (gen_random_uuid(), 'Grupo E2E', 'E2ETEST01', 'COLE_O_UUID_DO_USER', now(), 'WC', 'regulamento_1')
ON CONFLICT (code) DO NOTHING;

-- 4) Vincular usuário ao grupo ------------------------------------------------
INSERT INTO test.v2_user_groups ("userId", "groupId", "joinedAt", role, points)
SELECT 'COLE_O_UUID_DO_USER', id, now(), 'ADMIN', 0
FROM test.v2_groups WHERE code = 'E2ETEST01'
ON CONFLICT ("userId", "groupId") DO NOTHING;

-- 5) Definir grupo ativo do usuário (se a coluna existir em user_roles)
UPDATE test.v2_user_roles ur
SET "activeGroupId" = (SELECT id FROM test.v2_groups WHERE code = 'E2ETEST01')
WHERE ur."userId" = 'COLE_O_UUID_DO_USER';
```

> Se algum `ON CONFLICT (coluna)` reclamar de constraint inexistente, troque por
> `ON CONFLICT DO NOTHING`.

---

## Passo 5 — Apontar o app e os testes para o schema `test`

Dois consumidores diferentes:

**A) O app (dev server) precisa usar o schema `test`.** Edite `.env.local`
temporariamente (durante os E2E) — só esta linha muda:

```
VITE_SUPABASE_SCHEMA=test
VITE_DB_TABLE_PREFIX=v2_
```

(reverta para `public` ao voltar ao desenvolvimento normal).

**B) Os testes precisam das credenciais.** Crie `.env.e2e` (a partir de
`.env.e2e.example`) e preencha com o usuário do Passo 3:

```
E2E_USER_EMAIL=e2e@bolao-test.local
E2E_USER_PASSWORD=<a senha que você definiu>
E2E_GROUP_CODE=E2ETEST01
# (opcional) E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
```

---

## Passo 6 — Rodar os testes

```powershell
# carrega .env.e2e para o processo e roda os E2E
Get-Content .env.e2e | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { Set-Item "env:$($matches[1].Trim())" $matches[2].Trim() } }
npm run test:e2e
```

Os testes que estavam em `test.skip(!hasTestUser ...)` passam a rodar de verdade
contra o schema `test`.

---

## Limpeza / reset

Para zerar só os dados de teste (mantendo a estrutura):

```sql
TRUNCATE test.v2_predictions, test.v2_tournament_predictions,
         test.v2_extra_phase_predictions, test.v2_user_groups,
         test.v2_groups, test.v2_user_roles RESTART IDENTITY CASCADE;
```

Para remover o schema inteiro:

```sql
DROP SCHEMA IF EXISTS test CASCADE;
-- e remova 'test' de Exposed schemas no Dashboard.
```

---

## Ressalvas

- **Auth compartilhada:** o usuário de teste existe no projeto inteiro. Para
  isolamento total de auth, use um **projeto Supabase separado**.
- **`is_admin()` isolado:** `test.is_admin()` lê `test.v2_user_roles` — o status de
  admin no teste é independente de produção (definido na PARTE 2).
- **FKs omitidas** no schema de teste (por simplicidade/robustez). Se quiser
  integridade referencial idêntica à prod, dá para adicionar as FKs (ver
  `database/migrations/0010_create_v3_from_v2.sql`, Passo 2, como modelo).
- **`test.fixme`/`it.todo`** (PRED/LOCK avançados, SYNC) precisam de seed
  controlado adicional ou mocks — não bastam credenciais.
