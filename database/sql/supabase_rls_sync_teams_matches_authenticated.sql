-- Allow authenticated users to sync teams and matches from external API
-- Fixes: permission denied for table teams during game sync

begin;

alter table public.teams enable row level security;
alter table public.matches enable row level security;

-- Remove restrictive policies that may block sync
-- Teams
 drop policy if exists "Teams write admin only" on public.teams;
 drop policy if exists "Teams standings update only" on public.teams;

-- Matches
 drop policy if exists "Matches write admin only" on public.matches;

-- Ensure read policies exist
 do $$
 begin
   if not exists (
     select 1 from pg_policies
     where schemaname = 'public' and tablename = 'teams' and policyname = 'Public Read Teams'
   ) then
     create policy "Public Read Teams"
     on public.teams for select to authenticated using (true);
   end if;
 end $$;

 do $$
 begin
   if not exists (
     select 1 from pg_policies
     where schemaname = 'public' and tablename = 'matches' and policyname = 'Public Read Matches'
   ) then
     create policy "Public Read Matches"
     on public.matches for select to authenticated using (true);
   end if;
 end $$;

-- Authenticated write policies for sync process
create policy "Teams sync write authenticated"
on public.teams
for all
to authenticated
using (true)
with check (true);

create policy "Matches sync write authenticated"
on public.matches
for all
to authenticated
using (true)
with check (true);

-- SQL privileges (in addition to RLS)
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.matches to authenticated;

commit;
