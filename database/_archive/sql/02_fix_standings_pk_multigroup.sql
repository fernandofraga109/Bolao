-- ==============================================================================
-- Migração: Corrigir PRIMARY KEY de team_standings para suportar múltiplos grupos
-- ==============================================================================
--
-- PROBLEMA:
--   A PK atual é (teamId, competitionCode), o que só permite uma linha por time
--   por competição. Para competições com múltiplos grupos (Copa do Mundo tem 8),
--   isso sobrescreve dados entre grupos.
--
-- SOLUÇÃO:
--   Adicionar a coluna "group" à PRIMARY KEY:
--   PRIMARY KEY ("teamId", "competitionCode", "group")
--
-- COMO EXECUTAR:
--   Cole este script no SQL Editor do Supabase e execute.
--   ATENÇÃO: A migração apaga e recria a PK. Os dados existentes são preservados.
-- ==============================================================================

-- 1. Definir REPLICA IDENTITY FULL para permitir UPDATE na tabela publicada no Realtime
--    (obrigatório para tabelas em publicações do Supabase Realtime)
ALTER TABLE public.team_standings REPLICA IDENTITY FULL;

-- 2. Remover a PRIMARY KEY existente
ALTER TABLE public.team_standings
DROP CONSTRAINT IF EXISTS team_standings_pkey;

-- 3. Garantir que a coluna "group" não seja nula (necessário para ser parte da PK)
--    Preenche eventuais NULLs com "Temporada Regular" antes de tornar NOT NULL
UPDATE public.team_standings
SET "group" = 'Temporada Regular'
WHERE "group" IS NULL;

ALTER TABLE public.team_standings
ALTER COLUMN "group" SET NOT NULL,
ALTER COLUMN "group" SET DEFAULT 'Temporada Regular';

-- 4. Recriar a PRIMARY KEY incluindo "group"
ALTER TABLE public.team_standings
ADD PRIMARY KEY ("teamId", "competitionCode", "group");

-- ==============================================================================
-- VERIFICAÇÃO (opcional — rode depois para confirmar)
-- ==============================================================================
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'team_standings' AND table_schema = 'public';

