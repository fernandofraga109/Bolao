-- =============================================================================
-- Bolão Copa do Mundo 2026 — Migração Segura para o Regulamento 2 com Backup V2
--
-- Este script faz o seguinte:
-- 1. Cria cópias de backup (prefixadas com v2_) das tabelas que serão alteradas.
-- 2. Copia todo o conteúdo atual das tabelas para as tabelas v2_ correspondentes.
-- 3. Aplica as alterações do Regulamento 2 de forma não destrutiva.
--
-- Executar este script no editor SQL do Supabase.
-- =============================================================================
SET search_path TO public;

-- =============================================================================
-- PASSO 1: CRIAR CÓPIAS DE SEGURANÇA (V2_) COM DADOS
-- =============================================================================

-- Backup da tabela "groups"
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'v2_groups') THEN
        CREATE TABLE public.v2_groups AS SELECT * FROM public.groups;
        RAISE NOTICE 'Tabela v2_groups criada com sucesso como backup.';
    ELSE
        RAISE NOTICE 'Tabela v2_groups já existe.';
    END IF;
END $$;

-- Backup da tabela "tournament_predictions"
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'v2_tournament_predictions') THEN
        CREATE TABLE public.v2_tournament_predictions AS SELECT * FROM public.tournament_predictions;
        RAISE NOTICE 'Tabela v2_tournament_predictions criada com sucesso como backup.';
    ELSE
        RAISE NOTICE 'Tabela v2_tournament_predictions já existe.';
    END IF;
END $$;


-- =============================================================================
-- PASSO 2: APLICAR ALTERAÇÕES DO REGULAMENTO 2 (NÃO-DESTRUTIVAS)
-- =============================================================================

-- 1. Adicionar seleção de regulamento na tabela original "groups"
-- Nota: Isso é 100% retrocompatível. O frontend antigo vai ignorar este campo.
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS "ruleset" text NOT NULL DEFAULT 'regulamento_1';

-- 2. Adicionar as mesmas colunas nas tabelas v2_ para paridade estrutural
ALTER TABLE public.v2_groups ADD COLUMN IF NOT EXISTS "ruleset" text NOT NULL DEFAULT 'regulamento_1';

-- 3. Adicionar apostas extras na tabela original "tournament_predictions"
ALTER TABLE public.tournament_predictions ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.tournament_predictions ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- 4. Adicionar as mesmas colunas nas tabelas v2_ correspondentes
ALTER TABLE public.v2_tournament_predictions ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.v2_tournament_predictions ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES public.teams(id) ON DELETE SET NULL;


-- =============================================================================
-- PASSO 3: CRIAR NOVOS COMPONENTES DO REGULAMENTO 2
-- =============================================================================

-- Tabela para apostas extras de fase (Nova tabela, risco zero de quebra)
CREATE TABLE IF NOT EXISTS public.extra_phase_predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    "phase" text NOT NULL, -- Ex: 'groups', 'oitavas', 'quartas', 'semi'
    "matchId" uuid REFERENCES public.matches(id) ON DELETE SET NULL,
    "createdAt" timestamptz DEFAULT now(),
    PRIMARY KEY ("userId", "groupId", "phase")
);

-- Tabela correspondente V2_ para backup/paridade
CREATE TABLE IF NOT EXISTS public.v2_extra_phase_predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    "phase" text NOT NULL,
    "matchId" uuid REFERENCES public.matches(id) ON DELETE SET NULL,
    "createdAt" timestamptz DEFAULT now(),
    PRIMARY KEY ("userId", "groupId", "phase")
);


-- =============================================================================
-- PASSO 4: POLÍTICAS DE RLS E REALTIME PARA A NOVA TABELA
-- =============================================================================

ALTER TABLE public.extra_phase_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_extra_phase_predictions ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "extra_phase_preds_select" ON public.extra_phase_predictions;
DROP POLICY IF EXISTS "extra_phase_preds_insert" ON public.extra_phase_predictions;
DROP POLICY IF EXISTS "extra_phase_preds_update" ON public.extra_phase_predictions;
DROP POLICY IF EXISTS "extra_phase_preds_delete" ON public.extra_phase_predictions;

-- Criar políticas
CREATE POLICY "extra_phase_preds_select" ON public.extra_phase_predictions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "extra_phase_preds_insert" ON public.extra_phase_predictions
    FOR INSERT TO authenticated
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "extra_phase_preds_update" ON public.extra_phase_predictions
    FOR UPDATE TO authenticated
    USING (is_admin() OR auth.uid() = "userId")
    WITH CHECK (is_admin() OR auth.uid() = "userId");

CREATE POLICY "extra_phase_preds_delete" ON public.extra_phase_predictions
    FOR DELETE TO authenticated
    USING (is_admin() OR auth.uid() = "userId");

-- Configurar publicação Realtime
DO $$
BEGIN
  BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.extra_phase_predictions; 
  EXCEPTION 
    WHEN duplicate_object THEN NULL; 
  END;
END $$;
