-- Backfill competition codes for existing records
-- Run after the schema migration that adds the new columns.

begin;

-- Ensure columns exist
alter table public.groups
  add column if not exists "competitionCode" text default 'WC';

alter table public.matches
  add column if not exists "competitionCode" text default 'WC';

alter table public.teams
  add column if not exists "standingsCompetitionCode" text default 'WC';

-- Backfill groups with a safe default when missing
update public.groups
set "competitionCode" = 'WC'
where "competitionCode" is null
   or btrim("competitionCode") = '';

-- Backfill matches with a safe default when missing
update public.matches
set "competitionCode" = 'WC'
where "competitionCode" is null
   or btrim("competitionCode") = '';

-- Backfill teams standings cache with a safe default when missing
update public.teams
set "standingsCompetitionCode" = 'WC'
where "standingsCompetitionCode" is null
   or btrim("standingsCompetitionCode") = '';

commit;
