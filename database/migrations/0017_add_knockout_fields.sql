-- Migration 0017: Adiciona campos para suporte a prorrogação e pênaltis em jogos de mata-mata
-- Data: 2026-06-03

-- Tabela matches: adiciona penaltiesHome/penaltiesAway (apenas para display)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS "penaltiesHome" integer,
  ADD COLUMN IF NOT EXISTS "penaltiesAway" integer;

-- Tabela predictions: adiciona extraTimeHome/extraTimeAway (palpite de prorrogação)
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS "extraTimeHome" integer,
  ADD COLUMN IF NOT EXISTS "extraTimeAway" integer;

-- Tabelas v2 legadas (se existirem)
ALTER TABLE IF EXISTS v2_matches
  ADD COLUMN IF NOT EXISTS "penaltiesHome" integer,
  ADD COLUMN IF NOT EXISTS "penaltiesAway" integer;

ALTER TABLE IF EXISTS v2_predictions
  ADD COLUMN IF NOT EXISTS "extraTimeHome" integer,
  ADD COLUMN IF NOT EXISTS "extraTimeAway" integer;
