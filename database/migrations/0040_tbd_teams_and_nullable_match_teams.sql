-- Migration 0040: TBD placeholder teams for knockout matches
--
-- Context: knockout matches (from round of 16 onwards) arrive from the API
-- with homeTeam/awayTeam = null before the bracket is filled. We want to
-- persist these matches in the DB so they appear in the calendar, while
-- blocking predictions until the real teams are known.
--
-- Strategy: insert two sentinel "TBD" team rows with fixed, well-known UUIDs.
-- The app code uses these UUIDs as placeholders (homeTeamId/awayTeamId stay
-- NOT NULL — no structural change needed). When the API fills in the real
-- teams, the sync pipeline replaces the sentinel IDs with the real ones.

-- ── Insert TBD sentinel teams (idempotent) ───────────────────────────────────
INSERT INTO v2_teams (id, name, code, flag)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'A Definir', 'TBD', ''),
  ('00000000-0000-0000-0000-000000000002', 'A Definir', 'TBD', '')
ON CONFLICT (id) DO NOTHING;
