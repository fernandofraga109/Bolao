-- Migration 0031: Detalhes ao vivo (minuto a minuto) vindos da api-sports.io
-- ---------------------------------------------------------------------------
-- Contexto: enriquecemos a experiência "ao vivo" (estilo Google) com dados de
-- uma segunda API (api-sports.io): relógio tickando, eventos (gols com jogador
-- e assistência, cartões), árbitro e estádio.
--
-- IMPORTANTE: estes dados NÃO participam de nenhum cálculo de pontos/ranking.
-- O placar oficial continua vindo da football-data.org. Aqui só guardamos um
-- payload normalizado para a UI consumir.
--
-- 1) matches."liveDetails" (jsonb)
--    Estrutura (ver types.ts → LiveMatchDetails):
--    {
--      "apiSportsFixtureId": 1489372,
--      "statusShort": "1H",
--      "statusLong": "First Half",
--      "elapsed": 45, "extra": 1,
--      "periods": { "first": 1781398800, "second": null },
--      "referee": "Mustapha Ghorbal, Algeria",
--      "venue": { "name": "Gillette Stadium", "city": "Boston" },
--      "round": "Group Stage - 1",
--      "events": [ { "elapsed": 28, "type": "Goal", "detail": "Normal Goal", ... } ],
--      "syncedAt": "2026-06-14T01:30:00.000Z"
--    }
--
-- 2) competitions."liveDetailsLastSync" (timestamptz)
--    Throttle do orçamento de chamadas (~20 por jogo). O pipeline só busca a
--    api-sports se já passou o intervalo mínimo desde este timestamp.

-- ── matches.liveDetails ──────────────────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS "liveDetails" jsonb;

COMMENT ON COLUMN matches."liveDetails" IS
  'Payload normalizado de detalhes ao vivo (api-sports). NÃO usado em pontuação.';

ALTER TABLE IF EXISTS v2_matches
  ADD COLUMN IF NOT EXISTS "liveDetails" jsonb;

ALTER TABLE IF EXISTS v3_matches
  ADD COLUMN IF NOT EXISTS "liveDetails" jsonb;

-- ── competitions.liveDetailsLastSync ───────────────────────────────────────
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS "liveDetailsLastSync" timestamptz;

COMMENT ON COLUMN competitions."liveDetailsLastSync" IS
  'Último fetch da api-sports (detalhes ao vivo). Throttle do orçamento de chamadas.';

ALTER TABLE IF EXISTS v2_competitions
  ADD COLUMN IF NOT EXISTS "liveDetailsLastSync" timestamptz;

ALTER TABLE IF EXISTS v3_competitions
  ADD COLUMN IF NOT EXISTS "liveDetailsLastSync" timestamptz;
