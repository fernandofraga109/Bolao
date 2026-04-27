-- Adiciona colunas necessárias para agrupamento por rodadas e fases em partidas
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS stage TEXT,
ADD COLUMN IF NOT EXISTS matchday INTEGER;

-- Comentários para documentação
COMMENT ON COLUMN matches.stage IS 'Fase da competição (ex: REGULAR_SEASON, LAST_16, etc.)';
COMMENT ON COLUMN matches.matchday IS 'Número da rodada (útil para ligas de pontos corridos)';
