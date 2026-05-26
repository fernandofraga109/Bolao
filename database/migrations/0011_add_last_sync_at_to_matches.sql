-- Migration 0011: Add "lastSyncAt" and "syncLocked" to matches
-- "lastSyncAt": tracks when each match was last synchronized from the API (stale data detection).
-- "syncLocked": when true, the sync process will skip this match entirely (admin manual override).

-- 1. Add "lastSyncAt" and "syncLocked" to matches
ALTER TABLE IF EXISTS matches ADD COLUMN IF NOT EXISTS "lastSyncAt" timestamptz;
ALTER TABLE IF EXISTS matches ADD COLUMN IF NOT EXISTS "syncLocked" boolean NOT NULL DEFAULT false;

-- 2. Add "lastSyncAt" and "syncLocked" to v2_matches (if exists)
ALTER TABLE IF EXISTS v2_matches ADD COLUMN IF NOT EXISTS "lastSyncAt" timestamptz;
ALTER TABLE IF EXISTS v2_matches ADD COLUMN IF NOT EXISTS "syncLocked" boolean NOT NULL DEFAULT false;

-- 3. Cleanup: drop old snake_case column if it was created by mistake
ALTER TABLE IF EXISTS matches DROP COLUMN IF EXISTS last_sync_at;
ALTER TABLE IF EXISTS v2_matches DROP COLUMN IF EXISTS last_sync_at;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
