-- Adiciona campos de artilheiro e outros dados especiais à tabela competitions
-- Isso permite armazenar dados da API para cálculo automático de pontos de palpites especiais
-- Aplica tanto para a tabela principal quanto para a v2_

-- Tabela principal (public.competitions)
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS "topScorerName" text,
  ADD COLUMN IF NOT EXISTS "topScorerGoals" integer,
  ADD COLUMN IF NOT EXISTS "championTeamId" uuid REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS "bestPlayerName" text,
  ADD COLUMN IF NOT EXISTS "bestGoalkeeperName" text,
  ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES teams(id),
  ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES teams(id);

-- Tabela v2 (public.v2_competitions)
ALTER TABLE v2_competitions
  ADD COLUMN IF NOT EXISTS "topScorerName" text,
  ADD COLUMN IF NOT EXISTS "topScorerGoals" integer,
  ADD COLUMN IF NOT EXISTS "championTeamId" uuid REFERENCES v2_teams(id),
  ADD COLUMN IF NOT EXISTS "bestPlayerName" text,
  ADD COLUMN IF NOT EXISTS "bestGoalkeeperName" text,
  ADD COLUMN IF NOT EXISTS "mostGoalsTeamId" uuid REFERENCES v2_teams(id),
  ADD COLUMN IF NOT EXISTS "mostConcededTeamId" uuid REFERENCES v2_teams(id);
