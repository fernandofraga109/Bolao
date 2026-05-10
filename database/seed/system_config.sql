-- Linha singleton do system_config
-- Execute uma única vez após criar as tabelas.
-- SCHEMA: deve ser o mesmo schema usado em 0001.
SET search_path TO public;

INSERT INTO system_config (id, is_auto_sync_enabled, sync_interval_ms)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, false, 60000)
ON CONFLICT (id) DO NOTHING;
