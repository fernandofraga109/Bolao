-- Migration 0032: Intervalo configurável do minuto-a-minuto + rotação de tokens
-- ---------------------------------------------------------------------------
-- Contexto: o "minuto a minuto" (api-sports) tinha um throttle FIXO de 5min
-- hardcoded no client. Agora o intervalo é configurável pelo admin (igual ao
-- sync_interval_ms da football-data) e fica em system_config.
--
-- Além disso, para permitir baixar esse intervalo (refresh mais rápido) sem
-- estourar a cota diária (free = 100/dia por token), suportamos rotação de N
-- tokens: cada chamada usa o token `count % N`. O contador vive no banco
-- (compartilhado pelos dois deploys Vercel) e é incrementado sob o sync lock,
-- então a rotação é global e sem race.
--
-- IMPORTANTE: nada aqui participa de pontuação/ranking — segue tudo cosmético.

-- ── system_config.live_details_interval_ms ─────────────────────────────────
-- Intervalo mínimo (ms) entre buscas do minuto-a-minuto. Default 300000 (5min),
-- preservando o comportamento atual.
ALTER TABLE system_config
  ADD COLUMN IF NOT EXISTS live_details_interval_ms integer DEFAULT 300000;

COMMENT ON COLUMN system_config.live_details_interval_ms IS
  'Intervalo (ms) entre buscas do minuto-a-minuto (api-sports). Controla a cota; default 5min.';

-- ── competitions.liveDetailsCallCount ──────────────────────────────────────
-- Contador monotônico de chamadas ao minuto-a-minuto. O proxy usa
-- (count % numTokens) para revezar os tokens da api-sports.
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS "liveDetailsCallCount" bigint DEFAULT 0;

COMMENT ON COLUMN competitions."liveDetailsCallCount" IS
  'Contador de chamadas do minuto-a-minuto. Usado para revezar tokens da api-sports (count % N).';

ALTER TABLE IF EXISTS v2_competitions
  ADD COLUMN IF NOT EXISTS "liveDetailsCallCount" bigint DEFAULT 0;

ALTER TABLE IF EXISTS v3_competitions
  ADD COLUMN IF NOT EXISTS "liveDetailsCallCount" bigint DEFAULT 0;
