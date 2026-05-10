-- HOTFIX 403 AFTER PHASE 1 RLS HARDENING
-- Run this if app started returning 403 after applying phase1 script.
-- It restores SELECT policies needed by current frontend bootstrap.

begin;

-- 1) Make is_admin more resilient in policy contexts.
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

-- 2) Restore SELECT policies used by current app flow.
-- Keep permissive read for now (phase 1 objective = no breakage).

drop policy if exists "Predictions read authenticated" on public.predictions;
drop policy if exists "TournPreds read authenticated" on public.tournament_predictions;
drop policy if exists "UserGroups read authenticated" on public.user_groups;
drop policy if exists "Groups read own memberships" on public.groups;

-- predictions
create policy "Predictions read authenticated"
on public.predictions
for select
to authenticated
using (true);

-- tournament_predictions
create policy "TournPreds read authenticated"
on public.tournament_predictions
for select
to authenticated
using (true);

-- user_groups
create policy "UserGroups read authenticated"
on public.user_groups
for select
to authenticated
using (true);

-- groups (needed so frontend can resolve group names)
create policy "Groups read own memberships"
on public.groups
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.user_groups ug
    where ug."groupId" = public.groups.id
      and ug."userId" = auth.uid()
  )
);

commit;
