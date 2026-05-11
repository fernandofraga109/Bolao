-- =============================================================================
-- Migration 0002 — Fix TLA uniqueness, add FKs on competitionCode, add indexes
-- Apply in Supabase SQL editor after 0001_create_tables.sql
--
-- SCHEMA: deve ser o mesmo schema usado em 0001.
-- =============================================================================
SET search_path TO public;

-- -----------------------------------------------------------------------------
-- 1. Drop UNIQUE constraint on teams.code (TLA)
--    TLA is not globally unique: Corinthians and Coritiba both use "COR" in BSA.
--    The true unique identifier is externalTeamId (already UNIQUE).
-- -----------------------------------------------------------------------------
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_code_key;

-- -----------------------------------------------------------------------------
-- 2. FK: matches.competitionCode → competitions.code
--    DEFERRABLE so the sync can upsert competition + matches in the same flow
--    without worrying about insert order within a transaction.
-- -----------------------------------------------------------------------------
ALTER TABLE matches
  ADD CONSTRAINT matches_competitionCode_fkey
  FOREIGN KEY ("competitionCode") REFERENCES competitions(code)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- -----------------------------------------------------------------------------
-- 3. FK: groups.competitionCode → competitions.code
-- -----------------------------------------------------------------------------
ALTER TABLE groups
  ADD CONSTRAINT groups_competitionCode_fkey
  FOREIGN KEY ("competitionCode") REFERENCES competitions(code)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- -----------------------------------------------------------------------------
-- 4. Performance indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_matches_competition_code ON matches ("competitionCode");
CREATE INDEX IF NOT EXISTS idx_matches_status           ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_date             ON matches (date);
