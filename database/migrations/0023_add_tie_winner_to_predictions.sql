-- Migration 0023: Adiciona campo tieWinnerTeamId na tabela predictions
-- Data: 2026-06-06
-- Motivo: Permitir que usuários indiquem a seleção vencedora nos pênaltis
--         quando palpitam empate em jogos de mata-mata (Regulamento 1).
--         O bônus de +3 pts é aplicado somente se o jogo realmente for para
--         disputa de pênaltis (duration = PENALTY_SHOOTOUT).

ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS "tieWinnerTeamId" text;

-- Tabela v2_predictions legada (se existir)
ALTER TABLE IF EXISTS v2_predictions
  ADD COLUMN IF NOT EXISTS "tieWinnerTeamId" text;
