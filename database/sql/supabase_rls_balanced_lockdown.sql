-- BALANCED RLS LOCKDOWN
-- Goal: reduce data exposure and privilege-escalation risk without breaking
-- current app flows (group visibility, group members, and group predictions).

begin;

-- -------------------------------------------------------------------
-- 0) Helper: admin check (uuid/text-safe)
-- -------------------------------------------------------------------
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

-- -------------------------------------------------------------------
-- 1) USER_ROLES: remove broad access and block self-escalation to ADMIN
-- -------------------------------------------------------------------
drop policy if exists "Public Access UserRoles" on public.user_roles;
drop policy if exists "UserRoles read own or shared group or admin" on public.user_roles;
drop policy if exists "UserRoles insert own or admin" on public.user_roles;
drop policy if exists "UserRoles update own or admin" on public.user_roles;
drop policy if exists "UserRoles delete admin only" on public.user_roles;

create policy "UserRoles read own or shared group or admin"
on public.user_roles
for select
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
  or exists (
    select 1
    from public.user_groups me
    join public.user_groups other
      on other."groupId"::text = me."groupId"::text
    where me."userId"::text = auth.uid()::text
      and other."userId"::text = user_roles."userId"::text
  )
);

create policy "UserRoles insert own or admin"
on public.user_roles
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid()::text = "userId"::text
    and coalesce(role, 'USER') = 'USER'
  )
);

create policy "UserRoles update own or admin"
on public.user_roles
for update
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
)
with check (
  public.is_admin()
  or (
    auth.uid()::text = "userId"::text
    and coalesce(role, 'USER') = 'USER'
  )
);

create policy "UserRoles delete admin only"
on public.user_roles
for delete
to authenticated
using (public.is_admin());

-- -------------------------------------------------------------------
-- 2) GROUPS: keep read for authenticated users (required by current
-- join-by-code flow), but scope writes to creator/admin
-- -------------------------------------------------------------------
drop policy if exists "Groups read authenticated" on public.groups;
drop policy if exists "Groups read own memberships" on public.groups;
drop policy if exists "Groups write admin only" on public.groups;
drop policy if exists "Public Access Groups" on public.groups;

create policy "Groups read authenticated"
on public.groups
for select
to authenticated
using (true);

create policy "Groups insert self or admin"
on public.groups
for insert
to authenticated
with check (
  public.is_admin()
  or "adminId"::text = auth.uid()::text
);

create policy "Groups update owner or admin"
on public.groups
for update
to authenticated
using (
  public.is_admin()
  or "adminId"::text = auth.uid()::text
)
with check (
  public.is_admin()
  or "adminId"::text = auth.uid()::text
);

create policy "Groups delete owner or admin"
on public.groups
for delete
to authenticated
using (
  public.is_admin()
  or "adminId"::text = auth.uid()::text
);

-- -------------------------------------------------------------------
-- 3) USER_GROUPS: remove broad read and keep scoped membership visibility
-- -------------------------------------------------------------------
drop policy if exists "Public Access UserGroups" on public.user_groups;
drop policy if exists "UserGroups read authenticated" on public.user_groups;
drop policy if exists "UserGroups read own groups or admin" on public.user_groups;
drop policy if exists "UserGroups insert own or admin" on public.user_groups;
drop policy if exists "UserGroups update own or admin" on public.user_groups;
drop policy if exists "UserGroups delete own or admin" on public.user_groups;

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

create policy "UserGroups insert own or admin"
on public.user_groups
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid()::text = "userId"::text
    and exists (
      select 1
      from public.groups g
      where g.id::text = user_groups."groupId"::text
    )
  )
);

create policy "UserGroups update own or admin"
on public.user_groups
for update
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
)
with check (
  public.is_admin()
  or auth.uid()::text = "userId"::text
);

create policy "UserGroups delete own or admin"
on public.user_groups
for delete
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
);

-- -------------------------------------------------------------------
-- 4) PREDICTIONS: scope reads by own/shared-group/admin
-- and writes by own + membership of prediction group
-- -------------------------------------------------------------------
alter table public.predictions
  add column if not exists "groupId" text;

drop policy if exists "Public Access Predictions" on public.predictions;
drop policy if exists "Predictions read authenticated" on public.predictions;
drop policy if exists "Predictions read same user or same group or admin" on public.predictions;
drop policy if exists "Predictions insert own or admin" on public.predictions;
drop policy if exists "Predictions update own or admin" on public.predictions;
drop policy if exists "Predictions delete own or admin" on public.predictions;

create policy "Predictions read same user or same group or admin"
on public.predictions
for select
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
  or (
    predictions."groupId" is not null
    and exists (
      select 1
      from public.user_groups me
      join public.user_groups owner
        on owner."groupId"::text = me."groupId"::text
      where me."userId"::text = auth.uid()::text
        and owner."userId"::text = predictions."userId"::text
        and owner."groupId"::text = predictions."groupId"::text
    )
  )
);

create policy "Predictions insert own or admin"
on public.predictions
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid()::text = "userId"::text
    and predictions."groupId" is not null
    and exists (
      select 1
      from public.user_groups ug
      where ug."userId"::text = auth.uid()::text
        and ug."groupId"::text = predictions."groupId"::text
    )
  )
);

create policy "Predictions update own or admin"
on public.predictions
for update
to authenticated
using (
  public.is_admin()
  or (
    auth.uid()::text = "userId"::text
    and (
      predictions."groupId" is null
      or exists (
        select 1
        from public.user_groups ug
        where ug."userId"::text = auth.uid()::text
          and ug."groupId"::text = predictions."groupId"::text
      )
    )
  )
)
with check (
  public.is_admin()
  or (
    auth.uid()::text = "userId"::text
    and predictions."groupId" is not null
    and exists (
      select 1
      from public.user_groups ug
      where ug."userId"::text = auth.uid()::text
        and ug."groupId"::text = predictions."groupId"::text
    )
  )
);

create policy "Predictions delete own or admin"
on public.predictions
for delete
to authenticated
using (
  public.is_admin()
  or (
    auth.uid()::text = "userId"::text
    and (
      predictions."groupId" is null
      or exists (
        select 1
        from public.user_groups ug
        where ug."userId"::text = auth.uid()::text
          and ug."groupId"::text = predictions."groupId"::text
      )
    )
  )
);

-- -------------------------------------------------------------------
-- 5) TOURNAMENT_PREDICTIONS: scoped read (own/shared-group/admin)
-- and own/admin write
-- -------------------------------------------------------------------
drop policy if exists "Public Access TournPreds" on public.tournament_predictions;
drop policy if exists "TournPreds read authenticated" on public.tournament_predictions;
drop policy if exists "TournPreds read same user or same group or admin" on public.tournament_predictions;
drop policy if exists "TournPreds insert own or admin" on public.tournament_predictions;
drop policy if exists "TournPreds update own or admin" on public.tournament_predictions;
drop policy if exists "TournPreds delete own or admin" on public.tournament_predictions;

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

create policy "TournPreds insert own or admin"
on public.tournament_predictions
for insert
to authenticated
with check (
  public.is_admin()
  or auth.uid()::text = "userId"::text
);

create policy "TournPreds update own or admin"
on public.tournament_predictions
for update
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
)
with check (
  public.is_admin()
  or auth.uid()::text = "userId"::text
);

create policy "TournPreds delete own or admin"
on public.tournament_predictions
for delete
to authenticated
using (
  public.is_admin()
  or auth.uid()::text = "userId"::text
);

commit;

-- Suggested verification query:
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('groups', 'user_groups', 'predictions', 'tournament_predictions', 'user_roles')
-- order by tablename, cmd, policyname;
