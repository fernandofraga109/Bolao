-- Migration 0035: Estatísticas de jogo ao vivo vindas da api-sports.io
-- ---------------------------------------------------------------------------
-- Contexto: complementamos a experiência "ao vivo" com estatísticas de partida
-- (posse de bola, finalizações, escanteios, etc.) vindas do endpoint
-- `fixtures/statistics?fixture=` da api-sports.io.
--
-- IMPORTANTE: estes dados são PURAMENTE cosméticos e NÃO participam de nenhum
-- cálculo de pontos/ranking. O placar oficial continua vindo da
-- football-data.org. Aqui só guardamos um payload jsonb livre para a UI consumir.
--
-- 1) matches."liveStats" (jsonb)
--    Estrutura (formato final normalizado no cliente):
--    {
--      "home": [
--        { "type": "Ball Possession", "value": "55%" },
--        { "type": "Total Shots", "value": 12 }
--      ],
--      "away": [ ... ],
--      "syncedAt": "2026-06-16T01:30:00.000Z"
--    }
--
-- Esta migration é ADITIVA e IDEMPOTENTE. NÃO cria coluna de lastSync, NÃO cria
-- RPC/função de lock — é SÓ a coluna.

-- ── matches.liveStats ────────────────────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS "liveStats" jsonb;

COMMENT ON COLUMN matches."liveStats" IS
  'Payload de estatísticas ao vivo (api-sports). Puramente cosmético. NÃO usado em pontuação.';

ALTER TABLE IF EXISTS v2_matches
  ADD COLUMN IF NOT EXISTS "liveStats" jsonb;

ALTER TABLE IF EXISTS v3_matches
  ADD COLUMN IF NOT EXISTS "liveStats" jsonb;
