
/**
 * INSTRUÇÕES:
 * 1. Copie o conteúdo da string `SUPABASE_SCHEMA_SQL` (apenas o texto SQL dentro das crases).
 * 2. Vá para o painel do Supabase -> SQL Editor.
 * 3. Cole e execute (Run).
 * 
 * NOTA: As colunas estão entre aspas duplas (ex: "homeTeamId") para preservar o camelCase
 * e corresponder exatamente às interfaces do TypeScript do seu frontend.
 */

export const SUPABASE_SCHEMA_SQL = `

-- LIMPEZA INICIAL (Cuidado: Apaga dados existentes!)
DROP TABLE IF EXISTS public.tournament_predictions CASCADE;
DROP TABLE IF EXISTS public.predictions CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.user_groups CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.stadiums CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;

-- 1. TABELA TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL,
    flag text NOT NULL,
    ranking integer,
    pot integer
);

-- 2. TABELA STADIUMS
CREATE TABLE IF NOT EXISTS public.stadiums (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    city text NOT NULL,
    country text NOT NULL,
    capacity integer
);

-- 3. TABELA USERS
CREATE TABLE IF NOT EXISTS public.users (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
    password text,
    avatar text,
    role text DEFAULT 'USER',
    status text DEFAULT 'ACTIVE',
    "activeGroupId" text,
    "totalPoints" integer DEFAULT 0
);

-- 4. TABELA GROUPS
CREATE TABLE IF NOT EXISTS public.groups (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL,
    "adminId" text NOT NULL,
    "createdAt" text
);

-- 5. TABELA USER_GROUPS (Relação Usuário <-> Grupo)
CREATE TABLE IF NOT EXISTS public.user_groups (
    "userId" text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    "groupId" text NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    "joinedAt" text,
    role text DEFAULT 'MEMBER',
    PRIMARY KEY ("userId", "groupId")
);

-- 6. TABELA MATCHES
CREATE TABLE IF NOT EXISTS public.matches (
    id text NOT NULL PRIMARY KEY,
    "homeTeamId" text NOT NULL REFERENCES public.teams(id),
    "awayTeamId" text NOT NULL REFERENCES public.teams(id),
    date text NOT NULL,
    "group" text NOT NULL, -- "group" é palavra reservada em SQL, aspas são essenciais
    "stadiumId" text, -- Pode ser null se não definido
    status text NOT NULL,
    "resultHome" integer,
    "resultAway" integer
);

-- 7. TABELA PREDICTIONS (Palpites dos Jogos)
CREATE TABLE IF NOT EXISTS public.predictions (
    "userId" text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    "matchId" text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    "homeScore" integer NOT NULL,
    "awayScore" integer NOT NULL,
    timestamp text,
    PRIMARY KEY ("userId", "matchId")
);

-- 8. TABELA TOURNAMENT_PREDICTIONS (Palpites Campeão/Artilheiro)
CREATE TABLE IF NOT EXISTS public.tournament_predictions (
    "userId" text NOT NULL PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    "championTeamId" text,
    "topScorerPlayer" text,
    "topScorerGoals" integer,
    "bestPlayer" text,
    "bestGoalkeeper" text
);

-- Habilitar Row Level Security (Opcional, mas recomendado para produção)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_predictions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso LIBERADAS (Para desenvolvimento inicial)
-- IMPORTANTE: Em produção, você deve restringir quem pode editar o quê.
CREATE POLICY "Public Read Teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Public Read Stadiums" ON public.stadiums FOR SELECT USING (true);
CREATE POLICY "Public Access Users" ON public.users FOR ALL USING (true);
CREATE POLICY "Public Access Groups" ON public.groups FOR ALL USING (true);
CREATE POLICY "Public Access UserGroups" ON public.user_groups FOR ALL USING (true);
CREATE POLICY "Public Read Matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admin Edit Matches" ON public.matches FOR ALL USING (true); -- Simplificação
CREATE POLICY "Public Access Predictions" ON public.predictions FOR ALL USING (true);
CREATE POLICY "Public Access TournPreds" ON public.tournament_predictions FOR ALL USING (true);

`;
