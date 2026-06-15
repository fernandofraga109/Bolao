/**
 * EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR
 * Para criar a tabela de configurações globais do sistema.
 */

export const SYSTEM_CONFIG_SQL = `
-- Tabela para configurações globais (Singleton)
CREATE TABLE IF NOT EXISTS public.system_config (
    id uuid NOT NULL PRIMARY KEY,
    is_auto_sync_enabled boolean DEFAULT false,
    sync_interval_ms integer DEFAULT 60000,
    -- Intervalo (ms) entre buscas do minuto-a-minuto (api-sports). Default 50s.
    live_details_interval_ms integer DEFAULT 50000,
    -- Versão publicada por deploy: { "bolao": "1.36.0", "miguelfork": "1.35.1" }.
    -- Alimenta o banner "Nova versão disponível"; cada deploy lê só a sua chave.
    app_versions jsonb
);

-- Habilitar RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- Leitura pública (para todos saberem se está syncando)
CREATE POLICY "Public Read Config" ON public.system_config FOR SELECT USING (true);
-- Edição apenas para todos (na prática, o frontend controla que só admin muda)
-- Em produção idealmente restringiria por role, mas para este MVP 'true' funciona se o frontend validar.
CREATE POLICY "Public Update Config" ON public.system_config FOR UPDATE USING (true);
CREATE POLICY "Public Insert Config" ON public.system_config FOR INSERT WITH CHECK (true);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;

-- Inserir configuração padrão inicial (se não existir)
INSERT INTO public.system_config (id, is_auto_sync_enabled, sync_interval_ms)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, false, 60000)
ON CONFLICT (id) DO NOTHING;
`;
