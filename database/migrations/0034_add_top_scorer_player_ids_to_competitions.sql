SET search_path TO public;

-- ── competitions.topScorerPlayerIds ──────────────────────────────────────────
-- Array de UUIDs dos jogadores empatados na primeira colocação da artilharia.
-- Populado automaticamente durante o sync de /api/scorers. Usado no cálculo
-- de pontos de palpites especiais (considerando empates).

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS "topScorerPlayerIds" uuid[];

ALTER TABLE IF EXISTS v2_competitions
  ADD COLUMN IF NOT EXISTS "topScorerPlayerIds" uuid[];

ALTER TABLE IF EXISTS v3_competitions
  ADD COLUMN IF NOT EXISTS "topScorerPlayerIds" uuid[];
