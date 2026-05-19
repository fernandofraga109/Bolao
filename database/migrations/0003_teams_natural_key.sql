-- Migration 0003: Add natural key UNIQUE constraint on teams
-- Allows API lookups by (code, externalTeamId) without replacing the UUID PK
-- UUID id remains as internal PK; all existing FKs are unaffected.

ALTER TABLE teams
  ADD CONSTRAINT teams_code_external_id_key
  UNIQUE (code, "externalTeamId");
