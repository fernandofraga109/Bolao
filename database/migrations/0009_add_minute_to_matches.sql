-- Migration 0009: Add minute to matches
-- Adds a nullable 'minute' column to the matches table to store live match minutes.

-- 1. Safely add column 'minute' to matches table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'matches'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='matches' AND column_name='minute'
    ) THEN
        ALTER TABLE matches ADD COLUMN minute integer;
    END IF;
END $$;

-- 2. Safely add column 'minute' to v2_matches table if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'v2_matches'
    ) AND NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='v2_matches' AND column_name='minute'
    ) THEN
        ALTER TABLE v2_matches ADD COLUMN minute integer;
    END IF;
END $$;
