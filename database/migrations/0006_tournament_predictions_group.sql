-- Migration 0006: Add groupId to tournament_predictions for per-group special predictions
-- Safe to re-run: clears data, drops and rebuilds constraints idempotently.

-- Clear existing data (no prod data to preserve at this point)
DELETE FROM tournament_predictions;

-- Drop old PRIMARY KEY constraint (name derived from CREATE TABLE in 0001)
ALTER TABLE tournament_predictions
  DROP CONSTRAINT IF EXISTS tournament_predictions_pkey;

-- Add groupId column (NOT NULL because every prediction must belong to a group)
ALTER TABLE tournament_predictions
  ADD COLUMN IF NOT EXISTS "groupId" uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE;

-- New composite primary key: one prediction row per user per group
ALTER TABLE tournament_predictions
  ADD PRIMARY KEY ("userId", "groupId");
