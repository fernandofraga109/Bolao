-- Migration: add_underdog_config
-- Adds configurable underdog bonus threshold to system_config (global default)
-- and groups (per-group override, nullable = use global).

-- Global default on system_config
ALTER TABLE public.system_config
  ADD COLUMN IF NOT EXISTS underdog_min_rank_diff integer DEFAULT 10;

-- Per-group override (nullable = use global default)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS underdog_min_rank_diff integer;
