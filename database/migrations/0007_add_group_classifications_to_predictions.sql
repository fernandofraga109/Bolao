-- Migration 0007: Add groupClassifications to tournament_predictions for storing predicted qualified teams per group
-- 1. Tabela original
ALTER TABLE public.tournament_predictions 
ADD COLUMN IF NOT EXISTS "groupClassifications" jsonb DEFAULT '{}'::jsonb;

-- 2. Tabela v2_tournament_predictions (usando o prefixo v2_ no schema public)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'v2_tournament_predictions') THEN
        ALTER TABLE public.v2_tournament_predictions 
        ADD COLUMN IF NOT EXISTS "groupClassifications" jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;
