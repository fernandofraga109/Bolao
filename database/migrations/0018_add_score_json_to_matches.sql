-- Migration 0018: Adiciona coluna score (JSONB) na tabela matches para persistir o payload
-- completo da football-data API (regularTime, extraTime, penalties, duration, etc.)
--
-- Usamos jsonb em vez de varchar/text porque:
--   1. Permite queries e indexação nativas no PostgreSQL
--   2. Validação automática de estrutura JSON
--   3. O Supabase/PostgREST trata jsonb como objeto nativamente
--
-- Exemplo de conteúdo armazenado:
-- {
--   "winner": "HOME_TEAM",
--   "duration": "PENALTY_SHOOTOUT",
--   "fullTime": { "home": 5, "away": 4 },
--   "halfTime": { "home": 0, "away": 1 },
--   "regularTime": { "home": 1, "away": 1 },
--   "extraTime": { "home": 0, "away": 0 },
--   "penalties": { "home": 4, "away": 3 }
-- }

-- 1. Tabela principal matches
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS score jsonb;

COMMENT ON COLUMN matches.score IS
  'Payload completo do score da football-data API (duration, regularTime, extraTime, penalties, etc.)';

-- 2. Tabela v2_matches legada (se existir)
ALTER TABLE IF EXISTS v2_matches
  ADD COLUMN IF NOT EXISTS score jsonb;

COMMENT ON COLUMN v2_matches.score IS
  'Payload completo do score da football-data API (duration, regularTime, extraTime, penalties, etc.)';

-- 3. Índice GIN para permitir queries eficientes no JSONB
--    Exemplo: SELECT * FROM matches WHERE score->>'duration' = 'PENALTY_SHOOTOUT';
CREATE INDEX IF NOT EXISTS idx_matches_score_gin ON matches USING GIN (score);

-- Índice para a tabela v2 (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'v2_matches'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_v2_matches_score_gin ON v2_matches USING GIN (score);
    END IF;
END $$;
