/**
 * ARQUIVO MESTRE DE BANCO DE DADOS
 * --------------------------------
 * Este arquivo contém o script SQL completo para:
 * 1. LIMPAR o banco existente (DROP TABLES) para corrigir erros de schema.
 * 2. Criar a estrutura das tabelas (Schema).
 * 3. Popular o banco com TODOS os dados estáticos e de exemplo do projeto.
 *
 * INSTRUÇÕES:
 * 1. Copie todo o conteúdo dentro da string `FULL_DB_SQL` (entre as crases).
 * 2. Vá no Supabase -> SQL Editor.
 * 3. Cole e execute (Run).
 */

export const FULL_DB_SQL = `
-- ====================================================================
-- PARTE 0: LIMPEZA (RESET TOTAL)
-- ====================================================================
-- Isso garante que recriaremos as tabelas com os nomes de colunas corretos (case-sensitive)

DROP TABLE IF EXISTS public.tournament_predictions CASCADE;
DROP TABLE IF EXISTS public.predictions CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.user_groups CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.stadiums CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;


-- ====================================================================
-- PARTE 1: ESTRUTURA (SCHEMA)
-- ====================================================================

-- 1. TABELA TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL,
    flag text NOT NULL,
    ranking integer,
    pot integer,
    "externalTeamId" integer,
    "standingsSeason" text,
    "standingsStage" text,
    "standingsType" text,
    "standingsGroup" text,
    "standingsPosition" integer,
    "standingsPlayedGames" integer,
    "standingsForm" text,
    "standingsWon" integer,
    "standingsDraw" integer,
    "standingsLost" integer,
    "standingsPoints" integer,
    "standingsGoalsFor" integer,
    "standingsGoalsAgainst" integer,
    "standingsGoalDifference" integer,
    "standingsUpdatedAt" text
);

-- 2. TABELA STADIUMS
CREATE TABLE IF NOT EXISTS public.stadiums (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    city text NOT NULL,
    country text NOT NULL,
    capacity integer
);

-- 3. TABELA PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    avatar text,
    status text DEFAULT 'ACTIVE', -- Aspas para camelCase
    "activeGroupId" text, -- Aspas para camelCase
    "totalPoints" integer DEFAULT 0 -- Aspas para camelCase
);

-- 4. TABELA USER_ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
    "userId" uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role text DEFAULT 'USER'
);

-- 5. TABELA GROUPS
CREATE TABLE IF NOT EXISTS public.groups (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL,
    "adminId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Aspas para camelCase
    "createdAt" text -- Aspas para camelCase
);

-- 6. TABELA USER_GROUPS (Relação Usuário <-> Grupo)
CREATE TABLE IF NOT EXISTS public.user_groups (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "groupId" text NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
    "joinedAt" text,
    role text DEFAULT 'MEMBER',
    PRIMARY KEY ("userId", "groupId")
);

-- 7. TABELA MATCHES
CREATE TABLE IF NOT EXISTS public.matches (
    id text NOT NULL PRIMARY KEY,
    "homeTeamId" text NOT NULL REFERENCES public.teams(id),
    "awayTeamId" text NOT NULL REFERENCES public.teams(id),
    date text NOT NULL,
    "group" text NOT NULL, -- "group" reservado
    "stadiumId" text,
    status text NOT NULL,
    "resultHome" integer,
    "resultAway" integer
);

-- 8. TABELA PREDICTIONS (Palpites dos Jogos)
CREATE TABLE IF NOT EXISTS public.predictions (
    "userId" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "matchId" text NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    "homeScore" integer NOT NULL,
    "awayScore" integer NOT NULL,
    timestamp text,
    PRIMARY KEY ("userId", "matchId")
);

-- 9. TABELA TOURNAMENT_PREDICTIONS (Palpites Campeão/Artilheiro)
-- IMPORTANTE: Aspas duplas forçam case-sensitivity, essencial para corresponder ao JSON do frontend
CREATE TABLE IF NOT EXISTS public.tournament_predictions (
    "userId" uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "championTeamId" text,
    "topScorerPlayer" text,
    "topScorerGoals" integer,
    "bestPlayer" text,
    "bestGoalkeeper" text
);

-- Row Level Security (Básico)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stadiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_predictions ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'Public Access Teams') THEN
        CREATE POLICY "Public Access Teams" ON public.teams FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stadiums' AND policyname = 'Public Access Stadiums') THEN
        CREATE POLICY "Public Access Stadiums" ON public.stadiums FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public Access Profiles') THEN
        CREATE POLICY "Public Access Profiles" ON public.profiles FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_roles' AND policyname = 'Public Access UserRoles') THEN
        CREATE POLICY "Public Access UserRoles" ON public.user_roles FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'groups' AND policyname = 'Public Access Groups') THEN
        CREATE POLICY "Public Access Groups" ON public.groups FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_groups' AND policyname = 'Public Access UserGroups') THEN
        CREATE POLICY "Public Access UserGroups" ON public.user_groups FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Public Access Matches') THEN
        CREATE POLICY "Public Access Matches" ON public.matches FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'predictions' AND policyname = 'Public Access Predictions') THEN
        CREATE POLICY "Public Access Predictions" ON public.predictions FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tournament_predictions' AND policyname = 'Public Access TournPreds') THEN
        CREATE POLICY "Public Access TournPreds" ON public.tournament_predictions FOR ALL USING (true);
    END IF;
END $$;


-- ====================================================================
-- PARTE 1.1: HABILITAR REALTIME (IMPORTANTE!)
-- ====================================================================
-- Adiciona as tabelas à publicação padrão do Supabase para que o app receba atualizações ao vivo.

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_predictions;


-- ====================================================================
-- PARTE 2: POPULAÇÃO DE DADOS (INSERTS)
-- ====================================================================

-- 1. STADIUMS
INSERT INTO public.stadiums (id, name, city, country, capacity) VALUES
('azteca', 'Estádio Azteca', 'Cidade do México', 'MEX', 83000),
('akron', 'Estádio Akron', 'Guadalajara', 'MEX', 48000),
('bbva', 'Estádio BBVA', 'Monterrey', 'MEX', 53500),
('bmo', 'BMO Field', 'Toronto', 'CAN', 45000),
('bcplace', 'BC Place', 'Vancouver', 'CAN', 54000),
('metlife', 'MetLife Stadium', 'New York/New Jersey', 'USA', 82500),
('att', 'AT&T Stadium', 'Dallas', 'USA', 94000),
('arrowhead', 'Arrowhead Stadium', 'Kansas City', 'USA', 73000),
('nrg', 'NRG Stadium', 'Houston', 'USA', 72000),
('mercedes', 'Mercedes-Benz Stadium', 'Atlanta', 'USA', 75000),
('sofi', 'SoFi Stadium', 'Los Angeles', 'USA', 70000),
('lincoln', 'Lincoln Financial Field', 'Philadelphia', 'USA', 69000),
('lumen', 'Lumen Field', 'Seattle', 'USA', 69000),
('levis', 'Levi''s Stadium', 'San Francisco Bay Area', 'USA', 71000),
('gillette', 'Gillette Stadium', 'Boston', 'USA', 65000),
('hardrock', 'Hard Rock Stadium', 'Miami', 'USA', 65000)
ON CONFLICT (id) DO NOTHING;

-- 2. TEAMS
INSERT INTO public.teams (id, name, code, flag, ranking, pot) VALUES
('usa', 'Estados Unidos', 'USA', 'https://flagcdn.com/w160/us.png', 14, 1),
('mex', 'México', 'MEX', 'https://flagcdn.com/w160/mx.png', 15, 1),
('can', 'Canadá', 'CAN', 'https://flagcdn.com/w160/ca.png', 27, 1),
('esp', 'Espanha', 'ESP', 'https://flagcdn.com/w160/es.png', 1, 1),
('arg', 'Argentina', 'ARG', 'https://flagcdn.com/w160/ar.png', 2, 1),
('fra', 'França', 'FRA', 'https://flagcdn.com/w160/fr.png', 3, 1),
('eng', 'Inglaterra', 'ENG', 'https://flagcdn.com/w160/gb-eng.png', 4, 1),
('bra', 'Brasil', 'BRA', 'https://flagcdn.com/w160/br.png', 5, 1),
('por', 'Portugal', 'POR', 'https://flagcdn.com/w160/pt.png', 6, 1),
('ned', 'Holanda', 'NED', 'https://flagcdn.com/w160/nl.png', 7, 1),
('bel', 'Bélgica', 'BEL', 'https://flagcdn.com/w160/be.png', 8, 1),
('ger', 'Alemanha', 'GER', 'https://flagcdn.com/w160/de.png', 9, 1),
('cro', 'Croácia', 'CRO', 'https://flagcdn.com/w160/hr.png', 10, 2),
('mar', 'Marrocos', 'MAR', 'https://flagcdn.com/w160/ma.png', 11, 2),
('col', 'Colômbia', 'COL', 'https://flagcdn.com/w160/co.png', 13, 2),
('uru', 'Uruguai', 'URU', 'https://flagcdn.com/w160/uy.png', 16, 2),
('sui', 'Suíça', 'SUI', 'https://flagcdn.com/w160/ch.png', 17, 2),
('jpn', 'Japão', 'JPN', 'https://flagcdn.com/w160/jp.png', 18, 2),
('sen', 'Senegal', 'SEN', 'https://flagcdn.com/w160/sn.png', 19, 2),
('irn', 'Irã', 'IRN', 'https://flagcdn.com/w160/ir.png', 20, 2),
('kor', 'Coreia do Sul', 'KOR', 'https://flagcdn.com/w160/kr.png', 22, 2),
('ecu', 'Equador', 'ECU', 'https://flagcdn.com/w160/ec.png', 23, 2),
('aut', 'Áustria', 'AUT', 'https://flagcdn.com/w160/at.png', 24, 2),
('aus', 'Austrália', 'AUS', 'https://flagcdn.com/w160/au.png', 26, 2),
('nor', 'Noruega', 'NOR', 'https://flagcdn.com/w160/no.png', 29, 3),
('pan', 'Panamá', 'PAN', 'https://flagcdn.com/w160/pa.png', 30, 3),
('egy', 'Egito', 'EGY', 'https://flagcdn.com/w160/eg.png', 34, 3),
('alg', 'Argélia', 'ALG', 'https://flagcdn.com/w160/dz.png', 35, 3),
('sco', 'Escócia', 'SCO', 'https://flagcdn.com/w160/gb-sct.png', 36, 3),
('par', 'Paraguai', 'PAR', 'https://flagcdn.com/w160/py.png', 39, 3),
('tun', 'Tunísia', 'TUN', 'https://flagcdn.com/w160/tn.png', 40, 3),
('civ', 'C. do Marfim', 'CIV', 'https://flagcdn.com/w160/ci.png', 42, 3),
('uzb', 'Uzbequistão', 'UZB', 'https://flagcdn.com/w160/uz.png', 50, 3),
('qat', 'Catar', 'QAT', 'https://flagcdn.com/w160/qa.png', 51, 3),
('ksa', 'Arábia Saudita', 'KSA', 'https://flagcdn.com/w160/sa.png', 60, 3),
('rsa', 'África do Sul', 'RSA', 'https://flagcdn.com/w160/za.png', 61, 3),
('jor', 'Jordânia', 'JOR', 'https://flagcdn.com/w160/jo.png', 66, 4),
('cpv', 'Cabo Verde', 'CPV', 'https://flagcdn.com/w160/cv.png', 68, 4),
('gha', 'Gana', 'GHA', 'https://flagcdn.com/w160/gh.png', 72, 4),
('cuw', 'Curaçao', 'CUW', 'https://flagcdn.com/w160/cw.png', 82, 4),
('hai', 'Haiti', 'HAI', 'https://flagcdn.com/w160/ht.png', 84, 4),
('nzl', 'Nova Zelândia', 'NZL', 'https://flagcdn.com/w160/nz.png', 86, 4),
('uefa_a', 'Repescagem UEFA A', 'EUA', 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', 43, 4),
('uefa_b', 'Repescagem UEFA B', 'EUB', 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', 44, 4),
('uefa_c', 'Repescagem UEFA C', 'EUC', 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', 45, 4),
('uefa_d', 'Repescagem UEFA D', 'EUD', 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg', 46, 4),
('ic_1', 'Repescagem IC 1', 'IC1', 'https://upload.wikimedia.org/wikipedia/commons/a/ab/FIFA_logo_without_slogan.svg', 47, 4),
('ic_2', 'Repescagem IC 2', 'IC2', 'https://upload.wikimedia.org/wikipedia/commons/a/ab/FIFA_logo_without_slogan.svg', 48, 4)
ON CONFLICT (id) DO NOTHING;

-- 3. MATCHES
INSERT INTO public.matches (id, "homeTeamId", "awayTeamId", date, "group", "stadiumId", status, "resultHome", "resultAway") VALUES
('m1', 'mex', 'rsa', '2026-06-11T15:00:00', 'Grupo A', 'azteca', 'SCHEDULED', NULL, NULL),
('m2', 'kor', 'uefa_d', '2026-06-11T22:00:00', 'Grupo A', 'akron', 'SCHEDULED', NULL, NULL),
('m25', 'uefa_d', 'rsa', '2026-06-18T13:00:00', 'Grupo A', 'mercedes', 'SCHEDULED', NULL, NULL),
('m28', 'mex', 'kor', '2026-06-18T21:00:00', 'Grupo A', 'akron', 'SCHEDULED', NULL, NULL),
('m53', 'uefa_d', 'mex', '2026-06-24T21:00:00', 'Grupo A', 'azteca', 'SCHEDULED', NULL, NULL),
('m54', 'rsa', 'kor', '2026-06-24T21:00:00', 'Grupo A', 'bbva', 'SCHEDULED', NULL, NULL),
('m3', 'can', 'uefa_a', '2026-06-12T16:00:00', 'Grupo B', 'bmo', 'SCHEDULED', NULL, NULL),
('m8', 'qat', 'sui', '2026-06-13T14:00:00', 'Grupo B', 'levis', 'SCHEDULED', NULL, NULL),
('m26', 'sui', 'uefa_a', '2026-06-18T14:00:00', 'Grupo B', 'sofi', 'SCHEDULED', NULL, NULL),
('m27', 'can', 'qat', '2026-06-18T17:00:00', 'Grupo B', 'bcplace', 'SCHEDULED', NULL, NULL),
('m51', 'sui', 'can', '2026-06-24T14:00:00', 'Grupo B', 'bcplace', 'SCHEDULED', NULL, NULL),
('m52', 'uefa_a', 'qat', '2026-06-24T14:00:00', 'Grupo B', 'lumen', 'SCHEDULED', NULL, NULL),
('m7', 'bra', 'mar', '2026-06-13T18:00:00', 'Grupo C', 'metlife', 'SCHEDULED', NULL, NULL),
('m5', 'hai', 'sco', '2026-06-13T21:00:00', 'Grupo C', 'gillette', 'SCHEDULED', NULL, NULL),
('m30', 'sco', 'mar', '2026-06-19T18:00:00', 'Grupo C', 'gillette', 'SCHEDULED', NULL, NULL),
('m29', 'bra', 'hai', '2026-06-19T21:00:00', 'Grupo C', 'lincoln', 'SCHEDULED', NULL, NULL),
('m49', 'sco', 'bra', '2026-06-24T18:00:00', 'Grupo C', 'hardrock', 'SCHEDULED', NULL, NULL),
('m50', 'mar', 'hai', '2026-06-24T18:00:00', 'Grupo C', 'mercedes', 'SCHEDULED', NULL, NULL),
('m4', 'usa', 'par', '2026-06-12T18:00:00', 'Grupo D', 'sofi', 'SCHEDULED', NULL, NULL),
('m6', 'aus', 'uefa_c', '2026-06-13T21:00:00', 'Grupo D', 'bcplace', 'SCHEDULED', NULL, NULL),
('m32', 'usa', 'aus', '2026-06-19T12:00:00', 'Grupo D', 'lumen', 'SCHEDULED', NULL, NULL),
('m31', 'uefa_c', 'par', '2026-06-19T21:00:00', 'Grupo D', 'levis', 'SCHEDULED', NULL, NULL),
('m59', 'uefa_c', 'usa', '2026-06-25T19:00:00', 'Grupo D', 'sofi', 'SCHEDULED', NULL, NULL),
('m60', 'par', 'aus', '2026-06-25T19:00:00', 'Grupo D', 'levis', 'SCHEDULED', NULL, NULL),
('m10', 'ger', 'cuw', '2026-06-14T12:00:00', 'Grupo E', 'nrg', 'SCHEDULED', NULL, NULL),
('m9', 'civ', 'ecu', '2026-06-14T19:00:00', 'Grupo E', 'lincoln', 'SCHEDULED', NULL, NULL),
('m33', 'ger', 'civ', '2026-06-20T16:00:00', 'Grupo E', 'bmo', 'SCHEDULED', NULL, NULL),
('m34', 'ecu', 'cuw', '2026-06-20T19:00:00', 'Grupo E', 'arrowhead', 'SCHEDULED', NULL, NULL),
('m55', 'cuw', 'civ', '2026-06-25T16:00:00', 'Grupo E', 'lincoln', 'SCHEDULED', NULL, NULL),
('m56', 'ecu', 'ger', '2026-06-25T16:00:00', 'Grupo E', 'metlife', 'SCHEDULED', NULL, NULL),
('m14', 'esp', 'cpv', '2026-06-15T12:00:00', 'Grupo H', 'mercedes', 'SCHEDULED', NULL, NULL),
('m13', 'ksa', 'uru', '2026-06-15T18:00:00', 'Grupo H', 'hardrock', 'SCHEDULED', NULL, NULL),
('m38', 'esp', 'ksa', '2026-06-21T12:00:00', 'Grupo H', 'mercedes', 'SCHEDULED', NULL, NULL),
('m37', 'uru', 'cpv', '2026-06-21T18:00:00', 'Grupo H', 'hardrock', 'SCHEDULED', NULL, NULL),
('m65', 'cpv', 'ksa', '2026-06-26T19:00:00', 'Grupo H', 'nrg', 'SCHEDULED', NULL, NULL),
('m66', 'uru', 'esp', '2026-06-26T18:00:00', 'Grupo H', 'akron', 'SCHEDULED', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. PROFILES
INSERT INTO public.profiles (id, name, email, avatar, status, "activeGroupId", "totalPoints") VALUES
('11111111-1111-4111-8111-111111111111', 'Mestre da Copa', 'admin', 'https://ui-avatars.com/api/?name=Admin&background=000&color=fff', 'ACTIVE', NULL, 0),
('22222222-2222-4222-8222-222222222222', 'Usuário Demo', 'demo@gmail.com', 'https://ui-avatars.com/api/?name=Demo&background=10b981&color=fff', 'ACTIVE', NULL, 0),
('33333333-3333-4333-8333-333333333333', 'Carlos Silva', 'carlos@gmail.com', 'https://picsum.photos/seed/carlos/50/50', 'ACTIVE', 'g1', 0),
('44444444-4444-4444-8444-444444444444', 'Ana Souza', 'ana@gmail.com', 'https://picsum.photos/seed/ana/50/50', 'ACTIVE', 'g1', 0),
('55555555-5555-4555-8555-555555555555', 'Pedro Rocha', 'pedro@gmail.com', 'https://picsum.photos/seed/pedro/50/50', 'ACTIVE', 'g1', 0)
ON CONFLICT (id) DO NOTHING;

-- 4.b USER_ROLES
INSERT INTO public.user_roles ("userId", role) VALUES
('11111111-1111-4111-8111-111111111111', 'ADMIN'),
('22222222-2222-4222-8222-222222222222', 'USER'),
('33333333-3333-4333-8333-333333333333', 'USER'),
('44444444-4444-4444-8444-444444444444', 'USER'),
('55555555-5555-4555-8555-555555555555', 'USER')
ON CONFLICT ("userId") DO NOTHING;

-- 5. GROUPS
INSERT INTO public.groups (id, name, code, "adminId", "createdAt") VALUES
('g1', 'Amigos da Firma', 'ABCDE12345', '11111111-1111-4111-8111-111111111111', '2025-01-01T10:00:00'),
('g2', 'Família Silva', 'FAMIL12345', '11111111-1111-4111-8111-111111111111', '2025-01-02T10:00:00')
ON CONFLICT (id) DO NOTHING;

-- 6. USER_GROUPS
INSERT INTO public.user_groups ("userId", "groupId", "joinedAt", role) VALUES
('11111111-1111-4111-8111-111111111111', 'g1', '2025-01-01T10:00:00', 'ADMIN'),
('11111111-1111-4111-8111-111111111111', 'g2', '2025-01-01T10:00:00', 'ADMIN'),
('33333333-3333-4333-8333-333333333333', 'g1', '2025-01-01T12:00:00', 'MEMBER'),
('33333333-3333-4333-8333-333333333333', 'g2', '2025-01-02T12:00:00', 'MEMBER'),
('44444444-4444-4444-8444-444444444444', 'g1', '2025-01-01T14:00:00', 'MEMBER'),
('55555555-5555-4555-8555-555555555555', 'g1', '2025-01-01T15:00:00', 'MEMBER')
ON CONFLICT ("userId", "groupId") DO NOTHING;

-- 7. PREDICTIONS
INSERT INTO public.predictions ("userId", "matchId", "homeScore", "awayScore", timestamp) VALUES
('33333333-3333-4333-8333-333333333333', 'm1', 2, 1, '2025-01-01T12:00:00'),
('44444444-4444-4444-8444-444444444444', 'm1', 3, 1, '2025-01-01T14:00:00'),
('55555555-5555-4555-8555-555555555555', 'm1', 0, 1, '2025-01-01T15:00:00')
ON CONFLICT ("userId", "matchId") DO NOTHING;

-- 8. TOURNAMENT_PREDICTIONS
INSERT INTO public.tournament_predictions ("userId", "championTeamId", "topScorerPlayer", "topScorerGoals", "bestPlayer", "bestGoalkeeper") VALUES
('33333333-3333-4333-8333-333333333333', 'bra', 'Vinicius Jr', 7, 'Neymar', 'Alisson'),
('44444444-4444-4444-8444-444444444444', 'fra', 'Mbappé', 8, 'Mbappé', 'Maignan'),
('55555555-5555-4555-8555-555555555555', 'eng', 'Kane', 6, 'Bellingham', 'Pickford')
ON CONFLICT ("userId") DO NOTHING;

`;
