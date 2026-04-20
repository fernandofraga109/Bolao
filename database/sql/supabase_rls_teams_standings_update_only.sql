-- TEAMS: allow only standings cache updates (no inserts/deletes)
-- Run this after your base schema and RLS scripts.

begin;

-- 1) Keep reads open as your app expects.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teams'
      and policyname = 'Public Read Teams'
  ) then
    create policy "Public Read Teams"
    on public.teams
    for select
    using (true);
  end if;
end $$;

-- 2) Remove broad write policies on teams, if present.
drop policy if exists "Public Write Teams" on public.teams;
drop policy if exists "Teams write admin only" on public.teams;
drop policy if exists "Teams standings update only" on public.teams;

-- 3) RLS: allow UPDATE only (no INSERT/DELETE policy).
create policy "Teams standings update only"
on public.teams
for update
to authenticated
using (true)
with check (true);

-- 4) SQL privileges: restrict UPDATE to standings-related columns only.
revoke insert, update, delete on public.teams from authenticated;

grant update (
  "externalTeamId",
  "standingsSeason",
  "standingsStage",
  "standingsType",
  "standingsGroup",
  "standingsPosition",
  "standingsPlayedGames",
  "standingsForm",
  "standingsWon",
  "standingsDraw",
  "standingsLost",
  "standingsPoints",
  "standingsGoalsFor",
  "standingsGoalsAgainst",
  "standingsGoalDifference",
  "standingsUpdatedAt"
) on public.teams to authenticated;

commit;
