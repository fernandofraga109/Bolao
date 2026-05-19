-- =============================================================================
-- Migration 0005: Allow anon role to SELECT from groups
--
-- Problem: new users attempting to register with a valid group code receive
-- "Código de grupo inválido." because the groups table is only readable by
-- authenticated users. At registration time, the user has no session yet,
-- so the client cannot fetch groups to validate the code.
--
-- Fix: extend the groups_select policy to include the anon role. Group data
-- (id, name, code, competitionCode) contains no PII — codes are shared
-- explicitly by group admins.
-- =============================================================================
SET search_path TO public;

DROP POLICY IF EXISTS "groups_select" ON groups;
DROP POLICY IF EXISTS "groups_select_anon" ON groups;

CREATE POLICY "groups_select" ON groups
    FOR SELECT TO anon, authenticated USING (true);
