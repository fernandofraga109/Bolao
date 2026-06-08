-- Cria função PostgreSQL para adquirir lock de sync de forma ATÔMICA
-- Esta função garante que apenas UMA instância consegue o lock por vez
SET search_path TO public;

-- Função para tabela competitions (sem prefixo)
CREATE OR REPLACE FUNCTION acquire_sync_lock(
  p_competition_code text,
  p_timeout_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  -- UPDATE atômico: só atualiza se lock está NULL ou expirado
  -- Retorna número de linhas afetadas via ROW_COUNT
  UPDATE competitions
  SET sync_locked_at = NOW()
  WHERE code = p_competition_code
    AND (
      sync_locked_at IS NULL 
      OR sync_locked_at < (NOW() - (p_timeout_seconds || ' seconds')::interval)
    );
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  -- Retorna true se conseguiu atualizar (adquiriu o lock)
  RETURN v_rows_updated > 0;
END;
$$;

-- Função para tabela v2_competitions (com prefixo)
CREATE OR REPLACE FUNCTION v2_acquire_sync_lock(
  p_competition_code text,
  p_timeout_seconds integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_updated integer;
BEGIN
  UPDATE v2_competitions
  SET sync_locked_at = NOW()
  WHERE code = p_competition_code
    AND (
      sync_locked_at IS NULL 
      OR sync_locked_at < (NOW() - (p_timeout_seconds || ' seconds')::interval)
    );
  
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated > 0;
END;
$$;
