-- Add 'ranking' column update permission for authenticated users
-- Run this in Supabase SQL Editor if you're getting 403 errors when syncing team rankings

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Grant update permission on 'ranking' column to authenticated users
GRANT UPDATE (ranking) ON public.teams TO authenticated;

-- Verify the grant was successful
SELECT * FROM information_schema.table_privileges 
WHERE table_name = 'teams' AND privilege_type = 'UPDATE';
