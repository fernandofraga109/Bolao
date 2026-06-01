-- Adiciona flag de auto-sync por competição.
-- Permite pausar a sincronização automática (background) de uma competição específica
-- sem afetar as demais — ex: pausar Brasileirão durante a Copa do Mundo.
-- A sincronização manual (botão "Sincronizar" no admin) continua funcionando normalmente.

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS "autoSyncEnabled" boolean NOT NULL DEFAULT true;

-- Tabela v2 (legada)
ALTER TABLE IF EXISTS v2_competitions
  ADD COLUMN IF NOT EXISTS "autoSyncEnabled" boolean NOT NULL DEFAULT true;
