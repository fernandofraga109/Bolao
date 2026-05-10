-- RECOVERY HOTFIX: scoped reads for groups/predictions with uuid/text-safe comparisons
-- Run this after identity hotfix when app still misses predictions/group/leaderboard data.

begin;

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
    where ur."userId"::text = auth.uid()::text
      and ur.role = 'ADMIN'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- GROUPS: user sees groups where they are a member (or admin)
drop policy if exists "Groups read own memberships" on public.groups;

create policy "Groups read own memberships"
on public.groups
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.user_groups ug
    where ug."groupId"::text = public.groups.id::text
      and ug."userId"::text = auth.uid()::text
  )
);

-- USER_GROUPS: user can read memberships for their own groups
drop policy if exists "UserGroups read authenticated" on public.user_groups;
drop policy if exists "UserGroups read own groups or admin" on public.user_groups;

create policy "UserGroups read own groups or admin"
on public.user_groups
for select
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
  or exists (
    select 1
    from public.user_groups me
    where me."groupId"::text = user_groups."groupId"::text
      and me."userId"::text = auth.uid()::text
  )
);

-- PREDICTIONS: own rows, shared-group rows, or admin
drop policy if exists "Predictions read authenticated" on public.predictions;
drop policy if exists "Predictions read same user or same group or admin" on public.predictions;

create policy "Predictions read same user or same group or admin"
on public.predictions
for select
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
  or exists (
    select 1
    from public.user_groups me
    join public.user_groups owner
      on owner."groupId"::text = me."groupId"::text
    where me."userId"::text = auth.uid()::text
      and owner."userId"::text = predictions."userId"::text
  )
);

-- TOURNAMENT_PREDICTIONS: same scoped read
drop policy if exists "TournPreds read authenticated" on public.tournament_predictions;
drop policy if exists "TournPreds read same user or same group or admin" on public.tournament_predictions;

create policy "TournPreds read same user or same group or admin"
on public.tournament_predictions
for select
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
  or exists (
    select 1
    from public.user_groups me
    join public.user_groups owner
      on owner."groupId"::text = me."groupId"::text
    where me."userId"::text = auth.uid()::text
      and owner."userId"::text = tournament_predictions."userId"::text
  )
);

commit;
