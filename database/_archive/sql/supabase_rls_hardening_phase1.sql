-- RLS HARDENING (PHASE 1)
-- Goal: keep current read flows working, but lock writes.
-- Safe approach for your current app architecture.
--
-- How to use:
-- 1) Run in Supabase SQL Editor.
-- 2) Test app login, leaderboard, predictions, admin actions.
-- 3) If needed, rollback by restoring old permissive policies.

begin;

-- ------------------------------------------------------------
-- 1) Helper: admin check from user_roles table
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur."userId" = auth.uid()
      and ur.role = 'ADMIN'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ------------------------------------------------------------
-- 2) Keep current read policies (no breakage)
-- We DO NOT drop these:
-- - Public Read Matches
-- - Public Read Stadiums
-- - Public Read Teams
-- - Public Read Config
--
-- And we ensure authenticated SELECT access for bootstrap tables:
-- - predictions
-- - tournament_predictions
-- - user_groups
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 3) Drop permissive write policies shown in your output
-- ------------------------------------------------------------
drop policy if exists "Public Access Groups" on public.groups;
drop policy if exists "Admin Edit Matches" on public.matches;
drop policy if exists "Public Access Predictions" on public.predictions;
drop policy if exists "Public Write Stadiums" on public.stadiums;
drop policy if exists "Public Insert Config" on public.system_config;
drop policy if exists "Public Update Config" on public.system_config;
drop policy if exists "Public Write Teams" on public.teams;
drop policy if exists "Public Access TournPreds" on public.tournament_predictions;
drop policy if exists "Public Access UserGroups" on public.user_groups;

-- ------------------------------------------------------------
-- 4) Global/domain tables: write admin only
-- ------------------------------------------------------------
create policy "Groups write admin only"
on public.groups
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Matches write admin only"
on public.matches
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Stadiums write admin only"
on public.stadiums
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Teams write admin only"
on public.teams
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "System config write admin only"
on public.system_config
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ------------------------------------------------------------
-- 5) User-owned data: own rows or admin
-- ------------------------------------------------------------
-- predictions
create policy "Predictions insert own or admin"
on public.predictions
for insert
to authenticated
with check (auth.uid() = "userId" or public.is_admin());

create policy "Predictions update own or admin"
on public.predictions
for update
to authenticated
using (auth.uid() = "userId" or public.is_admin())
with check (auth.uid() = "userId" or public.is_admin());

create policy "Predictions delete own or admin"
on public.predictions
for delete
to authenticated
using (auth.uid() = "userId" or public.is_admin());

-- tournament_predictions
create policy "TournPreds insert own or admin"
on public.tournament_predictions
for insert
to authenticated
with check (auth.uid() = "userId" or public.is_admin());

create policy "TournPreds update own or admin"
on public.tournament_predictions
for update
to authenticated
using (auth.uid() = "userId" or public.is_admin())
with check (auth.uid() = "userId" or public.is_admin());

create policy "TournPreds delete own or admin"
on public.tournament_predictions
for delete
to authenticated
using (auth.uid() = "userId" or public.is_admin());

-- user_groups
create policy "UserGroups insert own or admin"
on public.user_groups
for insert
to authenticated
with check (auth.uid() = "userId" or public.is_admin());

create policy "UserGroups update own or admin"
on public.user_groups
for update
to authenticated
using (auth.uid() = "userId" or public.is_admin())
with check (auth.uid() = "userId" or public.is_admin());

create policy "UserGroups delete own or admin"
on public.user_groups
for delete
to authenticated
using (auth.uid() = "userId" or public.is_admin());

-- ------------------------------------------------------------
-- 6) Read policies needed by current frontend bootstrap
-- ------------------------------------------------------------
create policy "Predictions read authenticated"
on public.predictions
for select
to authenticated
using (true);

create policy "TournPreds read authenticated"
on public.tournament_predictions
for select
to authenticated
using (true);

create policy "UserGroups read authenticated"
on public.user_groups
for select
to authenticated
using (true);

commit;
