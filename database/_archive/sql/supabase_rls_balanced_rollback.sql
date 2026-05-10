-- ROLLBACK: restore previously working policy set
-- Use this if supabase_rls_balanced_lockdown.sql caused runtime failures.

begin;

-- -------------------------------------------------------------------
-- GROUPS
-- -------------------------------------------------------------------
drop policy if exists "Groups read authenticated" on public.groups;
drop policy if exists "Groups read own memberships" on public.groups;
drop policy if exists "Groups insert self or admin" on public.groups;
drop policy if exists "Groups update owner or admin" on public.groups;
drop policy if exists "Groups delete owner or admin" on public.groups;
drop policy if exists "Groups write admin only" on public.groups;
drop policy if exists "Public Access Groups" on public.groups;

create policy "Groups write admin only"
on public.groups
for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "Groups read authenticated"
on public.groups
for select
to authenticated
using (true);

-- -------------------------------------------------------------------
-- USER_GROUPS
-- -------------------------------------------------------------------
drop policy if exists "UserGroups read own groups or admin" on public.user_groups;
drop policy if exists "UserGroups insert own or admin" on public.user_groups;
drop policy if exists "UserGroups update own or admin" on public.user_groups;
drop policy if exists "UserGroups delete own or admin" on public.user_groups;
drop policy if exists "UserGroups read authenticated" on public.user_groups;
drop policy if exists "Public Access UserGroups" on public.user_groups;

create policy "UserGroups delete own or admin"
on public.user_groups
for delete
to authenticated
using ((auth.uid() = "userId") or is_admin());

create policy "UserGroups insert own or admin"
on public.user_groups
for insert
to authenticated
with check ((auth.uid() = "userId") or is_admin());

create policy "UserGroups read authenticated"
on public.user_groups
for select
to authenticated
using (true);

create policy "UserGroups update own or admin"
on public.user_groups
for update
to authenticated
using ((auth.uid() = "userId") or is_admin())
with check ((auth.uid() = "userId") or is_admin());

-- -------------------------------------------------------------------
-- PREDICTIONS
-- -------------------------------------------------------------------
drop policy if exists "Predictions read same user or same group or admin" on public.predictions;
drop policy if exists "Predictions insert own or admin" on public.predictions;
drop policy if exists "Predictions update own or admin" on public.predictions;
drop policy if exists "Predictions delete own or admin" on public.predictions;
drop policy if exists "Predictions read authenticated" on public.predictions;
drop policy if exists "Public Access Predictions" on public.predictions;

create policy "Predictions delete own or admin"
on public.predictions
for delete
to authenticated
using ((auth.uid() = "userId") or is_admin());

create policy "Predictions insert own or admin"
on public.predictions
for insert
to authenticated
with check ((auth.uid() = "userId") or is_admin());

create policy "Predictions read authenticated"
on public.predictions
for select
to authenticated
using (true);

create policy "Predictions update own or admin"
on public.predictions
for update
to authenticated
using ((auth.uid() = "userId") or is_admin())
with check ((auth.uid() = "userId") or is_admin());

-- -------------------------------------------------------------------
-- TOURNAMENT_PREDICTIONS
-- -------------------------------------------------------------------
drop policy if exists "TournPreds read same user or same group or admin" on public.tournament_predictions;
drop policy if exists "TournPreds insert own or admin" on public.tournament_predictions;
drop policy if exists "TournPreds update own or admin" on public.tournament_predictions;
drop policy if exists "TournPreds delete own or admin" on public.tournament_predictions;
drop policy if exists "TournPreds read authenticated" on public.tournament_predictions;
drop policy if exists "Public Access TournPreds" on public.tournament_predictions;

create policy "TournPreds delete own or admin"
on public.tournament_predictions
for delete
to authenticated
using ((auth.uid() = "userId") or is_admin());

create policy "TournPreds insert own or admin"
on public.tournament_predictions
for insert
to authenticated
with check ((auth.uid() = "userId") or is_admin());

create policy "TournPreds read authenticated"
on public.tournament_predictions
for select
to authenticated
using (true);

create policy "TournPreds update own or admin"
on public.tournament_predictions
for update
to authenticated
using ((auth.uid() = "userId") or is_admin())
with check ((auth.uid() = "userId") or is_admin());

-- -------------------------------------------------------------------
-- USER_ROLES
-- -------------------------------------------------------------------
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

commit;

-- Verify effective policies after rollback:
-- select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('groups','user_groups','predictions','tournament_predictions','user_roles')
-- order by tablename, cmd, policyname;
