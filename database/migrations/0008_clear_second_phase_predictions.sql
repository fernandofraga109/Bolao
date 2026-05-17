-- Migration 0008: Clear Second Phase Predictions (Oitavas, Quartas, Semis)
-- This script removes the keys 'Oitavas', 'Quartas', and 'Semis' from the JSONB 'groupClassifications' column in tournament_predictions.
-- Safe to run in Supabase SQL Editor.

-- 1. Safely update the primary tournament_predictions table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'tournament_predictions'
    ) THEN
        EXECUTE 'UPDATE tournament_predictions SET "groupClassifications" = COALESCE("groupClassifications", ''{}''::jsonb) - ''Oitavas'' - ''Quartas'' - ''Semis'';';
    END IF;
END $$;

-- 2. Safely update v2_tournament_predictions table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'v2_tournament_predictions'
    ) THEN
        EXECUTE 'UPDATE v2_tournament_predictions SET "groupClassifications" = COALESCE("groupClassifications", ''{}''::jsonb) - ''Oitavas'' - ''Quartas'' - ''Semis'';';
    END IF;
END $$;
