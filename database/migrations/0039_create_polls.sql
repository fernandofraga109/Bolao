-- =============================================================================
-- Bolão Copa do Mundo 2026 — Enquetes / Polls
--
-- Cria as tabelas de perguntas (polls) e respostas (poll_responses) usadas para
-- consultar a opinião dos usuários (ex.: alteração de pontuação do Regulamento 1).
--
-- DECISÃO-CHAVE (anonimato): o restante do schema usa RLS ABERTO (migration 0015)
-- — qualquer authenticated lê/escreve tudo, segurança na camada de app. Isso é
-- incompatível com o requisito de anonimato das respostas. Portanto `poll_responses`
-- é a EXCEÇÃO deliberada:
--   - SELECT/INSERT apenas da PRÓPRIA linha (auth.uid() = user_id)
--   - sem UPDATE/DELETE para o usuário (voto travado)
--   - o admin NÃO lê a tabela direto; lê só agregado anônimo via RPC
--     get_poll_results() SECURITY DEFINER (nunca expõe user_id).
-- Limite honesto: acesso ao console Supabase / service_role ainda cruza os dados.
-- O anonimato é garantido na aplicação, não contra um DBA.
--
-- Colunas em snake_case (user_id, option_index) de propósito — evita a pegadinha
-- das aspas em camelCase nas policies.
--
-- Idempotente. Execute no SQL Editor do Supabase (dev e prod).
-- Gerado em: 2026-06-21
-- =============================================================================
SET search_path TO public;

-- =============================================================================
-- PASSO 1: TABELAS (versão SEM prefixo)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.polls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question        text NOT NULL,
  options         jsonb NOT NULL,                 -- array de strings
  allow_multiple  boolean NOT NULL DEFAULT false,
  target_ruleset  text NULL,                      -- null=todos | 'regulamento_1' | 'regulamento_2' | 'both'
  status          text NOT NULL DEFAULT 'active', -- 'active' | 'closed'
  created_at      timestamptz NOT NULL DEFAULT now(),
  closes_at       timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.poll_responses (
  poll_id       uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  option_index  integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id, option_index)
);

CREATE INDEX IF NOT EXISTS poll_responses_poll_idx ON public.poll_responses (poll_id);
CREATE INDEX IF NOT EXISTS poll_responses_user_idx ON public.poll_responses (user_id);

-- =============================================================================
-- PASSO 2: TABELAS (versão v2_ com prefixo)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.v2_polls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question        text NOT NULL,
  options         jsonb NOT NULL,
  allow_multiple  boolean NOT NULL DEFAULT false,
  target_ruleset  text NULL,
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  closes_at       timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public.v2_poll_responses (
  poll_id       uuid NOT NULL REFERENCES public.v2_polls(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  option_index  integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id, option_index)
);

CREATE INDEX IF NOT EXISTS v2_poll_responses_poll_idx ON public.v2_poll_responses (poll_id);
CREATE INDEX IF NOT EXISTS v2_poll_responses_user_idx ON public.v2_poll_responses (user_id);

-- =============================================================================
-- PASSO 3: RLS
-- polls          → aberto p/ leitura (todos); escrita por authenticated (admin via app)
-- poll_responses → RESTRITIVO (own-row), exceção ao padrão do projeto
-- =============================================================================

-- ---- polls (sem prefixo) ----
DROP POLICY IF EXISTS "polls_select"  ON public.polls;
DROP POLICY IF EXISTS "polls_insert"  ON public.polls;
DROP POLICY IF EXISTS "polls_update"  ON public.polls;
DROP POLICY IF EXISTS "polls_delete"  ON public.polls;
CREATE POLICY "polls_select" ON public.polls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "polls_insert" ON public.polls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "polls_update" ON public.polls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "polls_delete" ON public.polls FOR DELETE TO authenticated USING (true);

-- ---- polls (v2_) ----
DROP POLICY IF EXISTS "v2_polls_select"  ON public.v2_polls;
DROP POLICY IF EXISTS "v2_polls_insert"  ON public.v2_polls;
DROP POLICY IF EXISTS "v2_polls_update"  ON public.v2_polls;
DROP POLICY IF EXISTS "v2_polls_delete"  ON public.v2_polls;
CREATE POLICY "v2_polls_select" ON public.v2_polls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "v2_polls_insert" ON public.v2_polls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "v2_polls_update" ON public.v2_polls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "v2_polls_delete" ON public.v2_polls FOR DELETE TO authenticated USING (true);

-- ---- poll_responses (sem prefixo) — RESTRITIVO ----
-- Usuário só lê/insere a PRÓPRIA linha. Sem UPDATE/DELETE (voto travado).
DROP POLICY IF EXISTS "poll_responses_select_own" ON public.poll_responses;
DROP POLICY IF EXISTS "poll_responses_insert_own" ON public.poll_responses;
CREATE POLICY "poll_responses_select_own" ON public.poll_responses
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "poll_responses_insert_own" ON public.poll_responses
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ---- poll_responses (v2_) — RESTRITIVO ----
DROP POLICY IF EXISTS "v2_poll_responses_select_own" ON public.v2_poll_responses;
DROP POLICY IF EXISTS "v2_poll_responses_insert_own" ON public.v2_poll_responses;
CREATE POLICY "v2_poll_responses_select_own" ON public.v2_poll_responses
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "v2_poll_responses_insert_own" ON public.v2_poll_responses
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.polls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_polls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_poll_responses ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PASSO 4: RPC de agregado ANÔNIMO
-- Retorna votos por opção + total de respondentes distintos. NUNCA expõe user_id.
-- SECURITY DEFINER → ignora o RLS restritivo de poll_responses para CONTAR
-- (mas só devolve agregado). Mirror sem/with prefixo, como acquire_sync_lock.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_poll_results(p_poll_id uuid)
RETURNS TABLE (option_index integer, votes bigint, total_respondents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    r.option_index,
    COUNT(*)::bigint AS votes,
    (SELECT COUNT(DISTINCT user_id) FROM public.poll_responses WHERE poll_id = p_poll_id)::bigint AS total_respondents
  FROM public.poll_responses r
  WHERE r.poll_id = p_poll_id
  GROUP BY r.option_index
  ORDER BY r.option_index;
$$;

CREATE OR REPLACE FUNCTION public.v2_get_poll_results(p_poll_id uuid)
RETURNS TABLE (option_index integer, votes bigint, total_respondents bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    r.option_index,
    COUNT(*)::bigint AS votes,
    (SELECT COUNT(DISTINCT user_id) FROM public.v2_poll_responses WHERE poll_id = p_poll_id)::bigint AS total_respondents
  FROM public.v2_poll_responses r
  WHERE r.poll_id = p_poll_id
  GROUP BY r.option_index
  ORDER BY r.option_index;
$$;

GRANT EXECUTE ON FUNCTION public.get_poll_results(uuid)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.v2_get_poll_results(uuid) TO anon, authenticated;
