
/**
 * SCRIPT DE MIGRAÇÃO E ATUALIZAÇÃO DE TIMES
 * -----------------------------------------
 * Este script faz 3 coisas:
 * 1. Insere as seleções com os IDs OFICIAIS da API (ex: Brasil 'bra' -> '764').
 * 2. Atualiza a tabela 'matches' para apontar para esses novos IDs.
 * 3. Atualiza palpites de campeão para os novos IDs.
 * 
 * COMO USAR:
 * 1. Copie o texto dentro das crases ( ` ) abaixo.
 * 2. Vá no Supabase > SQL Editor.
 * 3. Cole e execute.
 */

export const UPDATE_TEAMS_SQL = `
-- ==========================================================
-- 1. INSERIR NOVOS TIMES (Dados vindos do teams-groups.json)
-- ==========================================================

INSERT INTO public.teams (id, name, code, flag) VALUES
('769', 'Mexico', 'MEX', 'https://crests.football-data.org/769.svg'),
('774', 'South Africa', 'RSA', 'https://crests.football-data.org/9396.svg'),
('772', 'South Korea', 'KOR', 'https://crests.football-data.org/772.png'),
('828', 'Canada', 'CAN', 'https://crests.football-data.org/canada.svg'),
('8030', 'Qatar', 'QAT', 'https://crests.football-data.org/8030.svg'),
('788', 'Switzerland', 'SUI', 'https://crests.football-data.org/788.svg'),
('764', 'Brazil', 'BRA', 'https://crests.football-data.org/764.svg'),
('815', 'Morocco', 'MAR', 'https://crests.football-data.org/morocco.svg'),
('836', 'Haiti', 'HAI', 'https://crests.football-data.org/haiti.svg'),
('8873', 'Scotland', 'SCO', 'https://crests.football-data.org/814.svg'),
('771', 'United States', 'USA', 'https://crests.football-data.org/usa.svg'),
('761', 'Paraguay', 'PAR', 'https://crests.football-data.org/761.svg'),
('779', 'Australia', 'AUS', 'https://crests.football-data.org/779.svg'),
('759', 'Germany', 'GER', 'https://crests.football-data.org/759.svg'),
('9460', 'Curaçao', 'CUW', 'https://crests.football-data.org/curacao.svg'),
('1935', 'Côte d''Ivoire', 'CIV', 'https://crests.football-data.org/787.svg'),
('791', 'Ecuador', 'ECU', 'https://crests.football-data.org/791.svg'),
('8601', 'Netherlands', 'NED', 'https://crests.football-data.org/8601.svg'),
('766', 'Japan', 'JPN', 'https://crests.football-data.org/766.svg'),
('802', 'Tunisia', 'TUN', 'https://crests.football-data.org/tunisia.svg'),
('805', 'Belgium', 'BEL', 'https://crests.football-data.org/805.svg'),
('825', 'Egypt', 'EGY', 'https://crests.football-data.org/825.svg'),
('840', 'Iran', 'IRN', 'https://crests.football-data.org/iran.svg'),
('783', 'New Zealand', 'NZL', 'https://crests.football-data.org/783.svg'),
('760', 'Spain', 'ESP', 'https://crests.football-data.org/760.svg'),
('1930', 'Cape Verde', 'CPV', 'https://crests.football-data.org/cape_verde.svg'),
('801', 'Saudi Arabia', 'KSA', 'https://crests.football-data.org/saudi_arabia.svg'),
('758', 'Uruguay', 'URU', 'https://crests.football-data.org/758.svg'),
('773', 'France', 'FRA', 'https://crests.football-data.org/773.svg'),
('804', 'Senegal', 'SEN', 'https://crests.football-data.org/senegal.svg'),
('8872', 'Norway', 'NOR', 'https://crests.football-data.org/813.svg'),
('762', 'Argentina', 'ARG', 'https://crests.football-data.org/762.png'),
('778', 'Algeria', 'ALG', 'https://crests.football-data.org/algeria.svg'),
('816', 'Austria', 'AUT', 'https://crests.football-data.org/816.svg'),
('8049', 'Jordan', 'JOR', 'https://crests.football-data.org/8049.png'),
('765', 'Portugal', 'POR', 'https://crests.football-data.org/765.svg'),
('8070', 'Uzbekistan', 'UZB', 'https://crests.football-data.org/8070.png'),
('818', 'Colombia', 'COL', 'https://crests.football-data.org/818.svg'),
('770', 'England', 'ENG', 'https://crests.football-data.org/770.svg'),
('799', 'Croatia', 'CRO', 'https://crests.football-data.org/799.svg'),
('763', 'Ghana', 'GHA', 'https://crests.football-data.org/ghana.svg'),
('1836', 'Panama', 'PAN', 'https://crests.football-data.org/panama.svg')
ON CONFLICT (id) DO UPDATE SET
name = EXCLUDED.name,
code = EXCLUDED.code,
flag = EXCLUDED.flag;


-- ==========================================================
-- 2. MIGRAR DADOS EXISTENTES (Trocar ID antigo pelo Novo)
-- ==========================================================

-- Função auxiliar para atualizar as referências com segurança
DO $$ 
DECLARE
    -- Mapeamento Old ID -> New ID
    old_to_new text[][] := ARRAY[
        ['mex', '769'], ['rsa', '774'], ['kor', '772'], ['can', '828'], ['qat', '8030'],
        ['sui', '788'], ['bra', '764'], ['mar', '815'], ['hai', '836'], ['sco', '8873'],
        ['usa', '771'], ['par', '761'], ['aus', '779'], ['ger', '759'], ['cuw', '9460'],
        ['civ', '1935'], ['ecu', '791'], ['ned', '8601'], ['jpn', '766'], ['tun', '802'],
        ['bel', '805'], ['egy', '825'], ['irn', '840'], ['nzl', '783'], ['esp', '760'],
        ['cpv', '1930'], ['ksa', '801'], ['uru', '758'], ['fra', '773'], ['sen', '804'],
        ['nor', '8872'], ['arg', '762'], ['alg', '778'], ['aut', '816'], ['jor', '8049'],
        ['por', '765'], ['uzb', '8070'], ['col', '818'], ['eng', '770'], ['cro', '799'],
        ['gha', '763'], ['pan', '1836']
    ];
    rec text[];
BEGIN
    FOREACH rec SLICE 1 IN ARRAY old_to_new LOOP
        -- Atualizar Home Team nos Jogos
        UPDATE public.matches 
        SET "homeTeamId" = rec[2] 
        WHERE "homeTeamId" = rec[1];

        -- Atualizar Away Team nos Jogos
        UPDATE public.matches 
        SET "awayTeamId" = rec[2] 
        WHERE "awayTeamId" = rec[1];

        -- Atualizar Palpites de Campeão
        UPDATE public.tournament_predictions
        SET "championTeamId" = rec[2]
        WHERE "championTeamId" = rec[1];

        -- (Opcional) Apagar o time antigo para limpar o banco
        DELETE FROM public.teams WHERE id = rec[1];
    END LOOP;
END $$;
`;
