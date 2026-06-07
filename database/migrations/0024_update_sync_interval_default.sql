-- Atualiza o default do sync_interval_ms de 60s para 20s.
-- Justificativa: a versão premium da Football Data API permite 20 req/min.
-- Com 1 competição ativa (WC) e ~5 chamadas por sync, 20s de intervalo
-- resulta em ~15 chamadas/min, deixando margem para fallbacks e corridas.
-- NOTA: o valor do registro singleton é configurável pelo painel admin do app.
--       Esta migração apenas atualiza o DEFAULT da coluna para novos bancos.
SET search_path TO public;

-- Atualiza o valor default da coluna (tabela sem prefixo)
ALTER TABLE system_config
  ALTER COLUMN sync_interval_ms SET DEFAULT 20000;

-- Tabela v2 com prefixo (se existir)
ALTER TABLE IF EXISTS v2_system_config
  ALTER COLUMN sync_interval_ms SET DEFAULT 20000;
