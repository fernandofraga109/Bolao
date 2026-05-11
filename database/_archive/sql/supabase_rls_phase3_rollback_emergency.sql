-- EMERGENCY ROLLBACK: undo phase 3 identity + hotfix + recovery scripts
-- Target rollback of:
-- - supabase_rls_phase3_identity_hardening.sql
-- - supabase_rls_phase3_identity_hotfix_uuid_text.sql
-- - supabase_rls_recovery_group_predictions_scoped.sql
--
-- Result: restores broad read behavior used before phase 3.
-- Note: this is less secure; use only to recover production behavior quickly.

begin;

-- Keep helper available for any other existing policies that may still reference it.
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

-- ------------------------------------------------------------
-- user_roles: rollback to broad access (pre-phase-3 behavior)
-- ------------------------------------------------------------
drop policy if exists "UserRoles read own or shared group or admin" on public.user_roles;
drop policy if exists "UserRoles insert own or admin" on public.user_roles;
drop policy if exists "UserRoles update own or admin" on public.user_roles;
drop policy if exists "UserRoles delete admin only" on public.user_roles;
drop policy if exists "Public Access UserRoles" on public.user_roles;

create policy "Public Access UserRoles"
on public.user_roles
for all
to authenticated
using (true)
with check (true);

-- ------------------------------------------------------------
-- groups: rollback recovery scoped read
-- ------------------------------------------------------------
drop policy if exists "Groups read own memberships" on public.groups;

-- If a permissive groups policy already exists elsewhere, this won't conflict.
-- We still ensure authenticated select is available.
drop policy if exists "Groups read authenticated" on public.groups;
create policy "Groups read authenticated"
on public.groups
for select
to authenticated
using (true);

-- ------------------------------------------------------------
-- user_groups: rollback scoped read
-- ------------------------------------------------------------
drop policy if exists "UserGroups read own groups or admin" on public.user_groups;
drop policy if exists "UserGroups read authenticated" on public.user_groups;

create policy "UserGroups read authenticated"
on public.user_groups
for select
to authenticated
using (true);

-- ------------------------------------------------------------
-- predictions: rollback scoped read
-- ------------------------------------------------------------
drop policy if exists "Predictions read same user or same group or admin" on public.predictions;
drop policy if exists "Predictions read authenticated" on public.predictions;

create policy "Predictions read authenticated"
on public.predictions
for select
to authenticated
using (true);

-- ------------------------------------------------------------
-- tournament_predictions: rollback scoped read
-- ------------------------------------------------------------
drop policy if exists "TournPreds read same user or same group or admin" on public.tournament_predictions;
drop policy if exists "TournPreds read authenticated" on public.tournament_predictions;

create policy "TournPreds read authenticated"
on public.tournament_predictions
for select
to authenticated
using (true);

commit;
