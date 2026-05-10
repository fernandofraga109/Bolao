-- RLS HARDENING (PHASE 2)
-- Goal: restrict reads to authenticated user context:
-- - own rows
-- - or users that share at least one group
-- - admin always allowed
--
-- Prerequisite: phase 1 already executed (public.is_admin exists).

begin;

-- ------------------------------------------------------------
-- predictions: replace broad authenticated read with scoped read
-- ------------------------------------------------------------
drop policy if exists "Predictions read authenticated" on public.predictions;

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
      on owner."groupId" = me."groupId"
    where me."userId"::text = auth.uid()::text
      and owner."userId"::text = predictions."userId"::text
  )
);

-- ------------------------------------------------------------
-- tournament_predictions: same scoping strategy
-- ------------------------------------------------------------
drop policy if exists "TournPreds read authenticated" on public.tournament_predictions;

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
      on owner."groupId" = me."groupId"
    where me."userId"::text = auth.uid()::text
      and owner."userId"::text = tournament_predictions."userId"::text
  )
);

-- ------------------------------------------------------------
-- user_groups: member can read membership for groups they belong to
-- ------------------------------------------------------------
drop policy if exists "UserGroups read authenticated" on public.user_groups;

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
    where me."groupId" = user_groups."groupId"
      and me."userId"::text = auth.uid()::text
  )
);

commit;
