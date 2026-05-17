-- =============================================================================
-- Bolão Copa do Mundo 2026 — Migração para o Regulamento 2
--
-- Executar este script no editor SQL do Supabase.
-- =============================================================================
SET search_path TO public;

-- 1. ADICIONAR SELEÇÃO DE REGULAMENTO NOS GRUPOS
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS "ruleset" text NOT NULL DEFAULT 'regulamento_1';

-- 2. ADICIONAR APOSTAS EXTRAS (SELEÇÃO MAIS GOLEADORA / MAIS GOLEADA)
ALTER TABLE public.tournament_predictions ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES public.teams(id) ON DELETE SET NULL;
ALTER TABLE public.tournament_predictions ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3. CRIAR TABELA PARA APOSTA DE JOGO COM MAIOR DIFERENÇA DE GOLS POR FASE
CREATE TABLE IF NOT EXISTS public.extra_phase_predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    "phase" text NOT NULL, -- Ex: 'groups', 'oitavas', 'quartas', 'semi'
    "matchId" uuid REFERENCES public.matches(id) ON DELETE SET NULL,
    "createdAt" timestamptz DEFAULT now(),
    PRIMARY KEY ("userId", "groupId", "phase")
);

-- 4. HABILITAR RLS E CONFIGURAR POLÍTICAS DE ACESSO
ALTER TABLE public.extra_phase_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extra_phase_preds_select" ON public.extra_phase_predictions;
DROP POLICY IF EXISTS "extra_phase_preds_insert" ON public.extra_phase_predictions;
DROP POLICY IF EXISTS "extra_phase_preds_update" ON public.extra_phase_predictions;
DROP POLICY IF EXISTS "extra_phase_preds_delete" ON public.extra_phase_predictions;

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

-- 5. ADICIONAR AO REALTIME DO SUPABASE
DO $$
BEGIN
  BEGIN 
    ALTER PUBLICATION supabase_realtime ADD TABLE public.extra_phase_predictions; 
  EXCEPTION 
    WHEN duplicate_object THEN NULL; 
  END;
END $$;
