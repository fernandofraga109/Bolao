-- Adiciona a coluna `app_version` ao singleton `system_config`.
-- Usada pelo banner "Nova versão disponível": o servidor publica aqui a versão
-- atual da app (= CURRENT_VERSION de data/releases.ts) a cada deploy; o Realtime
-- propaga para as abas abertas, que comparam com a versão embutida no próprio
-- bundle e oferecem recarregar quando divergem.
-- Nullable de propósito: enquanto estiver NULL, o banner nunca dispara (guarda
-- contra falso-positivo em bancos legados).
SET search_path TO public;

-- Tabela sem prefixo
ALTER TABLE IF EXISTS system_config
  ADD COLUMN IF NOT EXISTS app_version text;

-- Tabela v2 com prefixo (se existir)
ALTER TABLE IF EXISTS v2_system_config
  ADD COLUMN IF NOT EXISTS app_version text;
