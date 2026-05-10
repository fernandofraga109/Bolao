-- RLS HARDENING (PHASE 3 - IDENTITY)
-- Goal: prevent email enumeration via public.user_roles.
--
-- Changes:
-- 1) Restrict SELECT on user_roles to same user, shared group, or admin.
-- 2) Restrict writes to own row (or admin), and delete only admin.

begin;

-- Helper used by policies
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
      on other."groupId" = me."groupId"
    where me."userId"::text = auth.uid()::text
      and other."userId"::text = user_roles."userId"::text
  )
);

create policy "UserRoles insert own or admin"
on public.user_roles
for insert
to authenticated
with check (public.is_admin() or auth.uid()::text = "userId"::text);

create policy "UserRoles update own or admin"
on public.user_roles
for update
to authenticated
using (public.is_admin() or auth.uid()::text = "userId"::text)
with check (public.is_admin() or auth.uid()::text = "userId"::text);

create policy "UserRoles delete admin only"
on public.user_roles
for delete
to authenticated
using (public.is_admin());

commit;