-- ==============================================================================
-- Migração 1: Ajustes na Tabela `predictions`
-- ==============================================================================

-- 1. Converter a coluna "groupId" para UUID (caso estivesse como text)
ALTER TABLE public.predictions 
ALTER COLUMN "groupId" TYPE uuid USING "groupId"::uuid;

-- 2. Tornar o "groupId" obrigatório (NOT NULL) se os dados já estiverem preenchidos corretamente
-- Atenção: se houver linhas com groupId NULL, será necessário preenchê-las ou deletá-las antes de rodar isso.
-- Ex: DELETE FROM public.predictions WHERE "groupId" IS NULL;
ALTER TABLE public.predictions 
ALTER COLUMN "groupId" SET NOT NULL;

-- 3. Adicionar a Foreign Key apontando para public.groups
ALTER TABLE public.predictions 
ADD CONSTRAINT fk_predictions_group 
FOREIGN KEY ("groupId") REFERENCES public.groups(id) ON DELETE CASCADE;

-- 4. Modificar a Primary Key para incluir o groupId
-- Descobrir o nome da constraint atual da PK pode variar (normalmente é predictions_pkey)
ALTER TABLE public.predictions 
DROP CONSTRAINT IF EXISTS predictions_pkey;

ALTER TABLE public.predictions 
ADD PRIMARY KEY ("userId", "matchId", "groupId");


-- ==============================================================================
-- Migração 2: Criação da Tabela `team_standings` e Migração de Dados
-- ==============================================================================

-- 1. Criar a nova tabela team_standings
CREATE TABLE IF NOT EXISTS public.team_standings (
    "teamId" uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    "competitionCode" character varying NOT NULL REFERENCES public.competitions(code) ON DELETE CASCADE,
    "season" text,
    "stage" text,
    "type" text,
    "group" text,
    "position" integer,
    "playedGames" integer,
    "form" text,
    "won" integer,
    "draw" integer,
    "lost" integer,
    "points" integer,
    "goalsFor" integer,
    "goalsAgainst" integer,
    "goalDifference" integer,
    "updatedAt" text,
    PRIMARY KEY ("teamId", "competitionCode")
);

-- 2. Migrar os dados existentes de `teams` para `team_standings`
INSERT INTO public.team_standings (
    "teamId", "competitionCode", "season", "stage", "type", "group",
    "position", "playedGames", "form", "won", "draw", "lost", "points",
    "goalsFor", "goalsAgainst", "goalDifference", "updatedAt"
)
SELECT 
    id, "standingsCompetitionCode", "standingsSeason", "standingsStage", "standingsType", "standingsGroup",
    "standingsPosition", "standingsPlayedGames", "standingsForm", "standingsWon", "standingsDraw", "standingsLost", "standingsPoints",
    "standingsGoalsFor", "standingsGoalsAgainst", "standingsGoalDifference", "standingsUpdatedAt"
FROM public.teams
WHERE "standingsCompetitionCode" IS NOT NULL
ON CONFLICT ("teamId", "competitionCode") DO NOTHING;

-- 3. Dropar as colunas de standings da tabela `teams`
ALTER TABLE public.teams
DROP COLUMN IF EXISTS "standingsSeason",
DROP COLUMN IF EXISTS "standingsStage",
DROP COLUMN IF EXISTS "standingsType",
DROP COLUMN IF EXISTS "standingsGroup",
DROP COLUMN IF EXISTS "standingsPosition",
DROP COLUMN IF EXISTS "standingsPlayedGames",
DROP COLUMN IF EXISTS "standingsForm",
DROP COLUMN IF EXISTS "standingsWon",
DROP COLUMN IF EXISTS "standingsDraw",
DROP COLUMN IF EXISTS "standingsLost",
DROP COLUMN IF EXISTS "standingsPoints",
DROP COLUMN IF EXISTS "standingsGoalsFor",
DROP COLUMN IF EXISTS "standingsGoalsAgainst",
DROP COLUMN IF EXISTS "standingsGoalDifference",
DROP COLUMN IF EXISTS "standingsUpdatedAt",
DROP COLUMN IF EXISTS "standingsCompetitionCode";

-- 4. Habilitar o RLS e Adicionar a política de leitura e escrita
ALTER TABLE public.team_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Team Standings" ON public.team_standings FOR SELECT USING (true);
CREATE POLICY "Auth Edit Team Standings" ON public.team_standings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Adicionar a tabela no Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_standings;
