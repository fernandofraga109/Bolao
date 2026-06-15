-- Migration 0033: Lock ATÔMICO para o minuto-a-minuto (api-sports / api-football)
-- ---------------------------------------------------------------------------
-- Contexto: a chamada à api-football (FASE 3.5 do runSync, /api/live-details) é
-- gastadora de cota (~20 chamadas/jogo). Até aqui ela era "protegida" por:
--   1) o lock distribuído do sync (acquire_sync_lock) — mas esse serializa o sync
--      INTEIRO, não a chamada à api-football; e
--   2) um throttle em ESTADO LOCAL do client (if elapsed >= live_details_interval_ms),
--      que NÃO é atômico — dois clientes com liveDetailsLastSync desatualizado podiam
--      ambos chamar a api-football no mesmo intervalo.
--
-- Esta migration dá ao minuto-a-minuto o MESMO tratamento atômico do sync: um
-- check-and-set em competitions."liveDetailsLastSync" numa única operação no banco.
-- Quem conseguir o UPDATE (lock) ganha o direito de chamar a api-football agora.
--
-- IMPORTANTE: nada aqui participa de pontuação/ranking — segue tudo cosmético.

SET search_path TO public;

-- Função para a tabela competitions (sem prefixo)
CREATE OR REPLACE FUNCTION acquire_live_details_lock(
  p_competition_code text,
  p_interval_ms integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  -- UPDATE atômico: só seta (e "ganha" o lock) se o último fetch é NULL ou já
  -- passou o intervalo mínimo. Seta o timestamp ANTES do fetch de propósito —
  -- se o fetch falhar, não re-tenta no intervalo (dado cosmético, mesma
  -- filosofia do acquire_sync_lock).
  UPDATE competitions
  SET "liveDetailsLastSync" = NOW()
  WHERE code = p_competition_code
    AND (
      "liveDetailsLastSync" IS NULL
      OR "liveDetailsLastSync" < (NOW() - (p_interval_ms || ' milliseconds')::interval)
    );

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- true => este cliente ganhou o direito de chamar a api-football agora.
  RETURN v_rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION acquire_live_details_lock(text, integer) TO anon, authenticated;

-- Função para a tabela v2_competitions (com prefixo)
CREATE OR REPLACE FUNCTION v2_acquire_live_details_lock(
  p_competition_code text,
  p_interval_ms integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  UPDATE v2_competitions
  SET "liveDetailsLastSync" = NOW()
  WHERE code = p_competition_code
    AND (
      "liveDetailsLastSync" IS NULL
      OR "liveDetailsLastSync" < (NOW() - (p_interval_ms || ' milliseconds')::interval)
    );

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION v2_acquire_live_details_lock(text, integer) TO anon, authenticated;
