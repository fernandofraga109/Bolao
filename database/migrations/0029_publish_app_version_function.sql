-- Função para publicar a versão da app no singleton `system_config`.
-- Usada pela Opção C do banner "Nova versão disponível": o script de build
-- (scripts/publish-version.mjs) chama esta função via RPC com a ANON key — sem
-- precisar da service_role_key em lugar nenhum.
--
-- SECURITY DEFINER: executa com as permissões do owner da função (dono do schema),
-- contornando RLS apenas para esta operação pontual e restrita (setar app_version).
-- Blast radius se a anon key for usada indevidamente: no máximo alterar a coluna
-- de versão e fazer aparecer um banner — nenhum acesso a dados sensíveis.
--
-- Atualiza ambas as tabelas (com e sem prefixo v2_) quando existirem.
SET search_path TO public;

CREATE OR REPLACE FUNCTION publish_app_version(v text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Escreve só se mudou (evita evento Realtime redundante).
  UPDATE v2_system_config SET app_version = v WHERE app_version IS DISTINCT FROM v;
EXCEPTION
  WHEN undefined_table THEN
    -- Ambiente sem prefixo v2_: tenta a tabela base.
    UPDATE system_config SET app_version = v WHERE app_version IS DISTINCT FROM v;
END;
$$;

-- Permite que clientes anônimos/autenticados chamem a função via RPC.
GRANT EXECUTE ON FUNCTION publish_app_version(text) TO anon, authenticated;
