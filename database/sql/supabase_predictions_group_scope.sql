-- PREDICTIONS PER GROUP (user can predict same match differently by group)
-- Safe migration: keeps old rows and enables new writes with groupId.

begin;

-- 1) Add groupId column
alter table public.predictions
  add column if not exists "groupId" text;

-- 2) Drop old PK (userId, matchId) if present
alter table public.predictions
  drop constraint if exists predictions_pkey;

-- 3) Add surrogate primary key for row identity
alter table public.predictions
  add column if not exists id uuid default gen_random_uuid();

alter table public.predictions
  alter column id set not null;

alter table public.predictions
  add constraint predictions_pkey primary key (id);

-- 4) New uniqueness: one prediction per user+group+match
-- Note: for legacy rows with groupId NULL, PostgreSQL allows multiple NULLs.
-- New app writes include groupId, so this constraint enforces the intended rule.
alter table public.predictions
  add constraint predictions_user_group_match_unique
  unique ("userId", "groupId", "matchId");

-- 5) Helpful index for group queries
create index if not exists predictions_group_user_match_idx
  on public.predictions ("groupId", "userId", "matchId");

-- 6) RLS policies for predictions with group ownership semantics
-- Read all authenticated (same behavior as current app)
drop policy if exists "Predictions read authenticated" on public.predictions;
create policy "Predictions read authenticated"
on public.predictions
for select
to authenticated
using (true);

-- Insert/update/delete only for own rows and only in groups where user is member
-- (admins still allowed via is_admin)
drop policy if exists "Predictions insert own or admin" on public.predictions;
create policy "Predictions insert own or admin"
on public.predictions
for insert
to authenticated
with check (
  (
    auth.uid() = "userId"
    and exists (
      select 1
      from public.user_groups ug
      where ug."userId" = auth.uid()
        and ug."groupId" = public.predictions."groupId"
    )
  )
  or public.is_admin()
);

drop policy if exists "Predictions update own or admin" on public.predictions;
create policy "Predictions update own or admin"
on public.predictions
for update
to authenticated
using (
  (
    auth.uid() = "userId"
    and exists (
      select 1
      from public.user_groups ug
      where ug."userId" = auth.uid()
        and ug."groupId" = public.predictions."groupId"
    )
  )
  or public.is_admin()
)
with check (
  (
    auth.uid() = "userId"
    and exists (
      select 1
      from public.user_groups ug
      where ug."userId" = auth.uid()
        and ug."groupId" = public.predictions."groupId"
    )
  )
  or public.is_admin()
);

drop policy if exists "Predictions delete own or admin" on public.predictions;
create policy "Predictions delete own or admin"
on public.predictions
for delete
to authenticated
using (
  (
    auth.uid() = "userId"
    and exists (
      select 1
      from public.user_groups ug
      where ug."userId" = auth.uid()
        and ug."groupId" = public.predictions."groupId"
    )
  )
  or public.is_admin()
);

commit;
