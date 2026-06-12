-- Versão publicada POR DEPLOY (fim da corrida entre os deploys que compartilham o
-- mesmo banco — ex.: `bolao` e `miguelfork`).
--
-- Antes: um único `system_config.app_version` era sobrescrito por quem deployasse
-- primeiro, fazendo o outro app mostrar "Nova versão disponível" antes do seu
-- próprio build subir → usuário preso no modal.
--
-- Agora: `app_versions` (JSONB) guarda a versão de cada deploy, keyed pelo
-- identificador do deploy: { "bolao": "1.36.0", "miguelfork": "1.35.1" }.
-- Cada deploy publica/lê só a sua chave. Chave ausente = banner não dispara.
SET search_path TO public;

-- 1) Coluna JSONB keyed por deploy (nullable de propósito: NULL/ausente = sem banner).
ALTER TABLE IF EXISTS system_config
  ADD COLUMN IF NOT EXISTS app_versions jsonb;

ALTER TABLE IF EXISTS v2_system_config
  ADD COLUMN IF NOT EXISTS app_versions jsonb;

-- 2) Função de publish keyed por deploy (substitui a de 1 argumento da migration 0029).
--    SECURITY DEFINER: escrita restrita à coluna de versão, chamável com a ANON key.
--    Escreve só se a versão DAQUELE deploy mudou (evita evento Realtime redundante).
CREATE OR REPLACE FUNCTION publish_app_version(target text, v text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE v2_system_config
     SET app_versions = jsonb_set(COALESCE(app_versions, '{}'::jsonb), ARRAY[target], to_jsonb(v), true)
   WHERE COALESCE(app_versions ->> target, '') IS DISTINCT FROM v;
EXCEPTION
  WHEN undefined_table THEN
    UPDATE system_config
       SET app_versions = jsonb_set(COALESCE(app_versions, '{}'::jsonb), ARRAY[target], to_jsonb(v), true)
     WHERE COALESCE(app_versions ->> target, '') IS DISTINCT FROM v;
END;
$$;

GRANT EXECUTE ON FUNCTION publish_app_version(text, text) TO anon, authenticated;

-- A função legada publish_app_version(text) da migration 0029 fica órfã (ninguém
-- mais a chama) e pode ser removida numa migration futura, depois que ambos os
-- deploys estiverem rodando o bundle novo.
