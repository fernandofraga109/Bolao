-- Migration 0019: Adiciona campos penaltiesHome/penaltiesAway na tabela predictions
-- Data: 2026-06-04
-- Motivo: Permitir que usuários palpitem o placar de pênaltis em jogos de mata-mata

-- Tabela predictions: adiciona penaltiesHome/penaltiesAway (palpite de pênaltis)
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS "penaltiesHome" integer,
  ADD COLUMN IF NOT EXISTS "penaltiesAway" integer;

-- Tabela v2_predictions legada (se existir)
ALTER TABLE IF EXISTS v2_predictions
  ADD COLUMN IF NOT EXISTS "penaltiesHome" integer,
  ADD COLUMN IF NOT EXISTS "penaltiesAway" integer;
