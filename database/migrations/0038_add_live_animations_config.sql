-- Adiciona `live_animations_enabled` ao singleton `system_config`.
-- Kill-switch global (admin) das animações ao vivo de gol/cartão: o admin pode
-- desligar uma animação para TODOS os usuários; o Realtime propaga para as abas
-- abertas. JSONB keyed por tipo: { "goal": true, "yellow": true, "red": true }.
-- Chave ausente = tratada como habilitada (default true) no cliente.
SET search_path TO public;

-- Tabela sem prefixo
ALTER TABLE IF EXISTS system_config
  ADD COLUMN IF NOT EXISTS live_animations_enabled jsonb
  DEFAULT '{"goal": true, "yellow": true, "red": true}'::jsonb;

-- Tabela v2 com prefixo (se existir)
ALTER TABLE IF EXISTS v2_system_config
  ADD COLUMN IF NOT EXISTS live_animations_enabled jsonb
  DEFAULT '{"goal": true, "yellow": true, "red": true}'::jsonb;
