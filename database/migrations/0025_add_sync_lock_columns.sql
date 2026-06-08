-- Adiciona coluna sync_locked_at para implementar lock distribuído de sync
-- Isso garante que apenas uma instância sincronize uma competição por vez
-- evitando chamadas simultâneas à API externa.
SET search_path TO public;

-- Tabela sem prefixo
ALTER TABLE competitions ADD COLUMN sync_locked_at timestamptz;

-- Tabela v2 com prefixo (se existir)
ALTER TABLE IF EXISTS v2_competitions ADD COLUMN sync_locked_at timestamptz;
