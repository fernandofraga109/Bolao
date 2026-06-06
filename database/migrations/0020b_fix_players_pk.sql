-- Migration 0020b: Fix v2_players primary key
-- Date: 2026-06-05
-- Motivation: externalPlayerId alone is not unique — same player can appear in
-- multiple competitions (e.g. WC + CL) with different teams. Replace with a
-- UUID surrogate PK and a unique constraint on the natural key triple.

-- Step 1: add UUID column and populate it
ALTER TABLE v2_players ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
UPDATE v2_players SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE v2_players ALTER COLUMN id SET NOT NULL;

-- Step 2: swap primary key
ALTER TABLE v2_players DROP CONSTRAINT v2_players_pkey;
ALTER TABLE v2_players ADD PRIMARY KEY (id);

-- Step 3: natural key uniqueness (upsert conflict target)
ALTER TABLE v2_players
    ADD CONSTRAINT v2_players_natural_key
    UNIQUE ("externalPlayerId", "competitionCode", "externalTeamId");
