-- UUID STANDARDIZATION MIGRATION (ALTER TABLE)
-- This script is intended for a fresh/empty database that already has the tables created.
-- It converts key IDs and datetime text columns to stronger types and keeps FK integrity.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
-- 1) DROP CONSTRAINTS THAT BLOCK TYPE CHANGES
-- =============================================================
ALTER TABLE public.user_groups DROP CONSTRAINT IF EXISTS user_groups_groupId_fkey;
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_pkey;

ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_matchId_fkey;
ALTER TABLE public.predictions DROP CONSTRAINT IF EXISTS predictions_pkey;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_pkey;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_activeGroupId_fkey;

-- =============================================================
-- 2) CONVERT GROUP IDs TO UUID
-- =============================================================
ALTER TABLE public.groups
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE uuid
  USING (
    CASE
      WHEN id IS NULL OR id = '' THEN gen_random_uuid()
      WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN id::uuid
      ELSE gen_random_uuid()
    END
  ),
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.user_groups
  ALTER COLUMN "groupId" TYPE uuid
  USING (
    CASE
      WHEN "groupId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN "groupId"::uuid
      ELSE gen_random_uuid()
    END
  );

ALTER TABLE public.profiles
  ALTER COLUMN "activeGroupId" TYPE uuid
  USING (
    CASE
      WHEN "activeGroupId" IS NULL OR "activeGroupId" = '' THEN NULL
      WHEN "activeGroupId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN "activeGroupId"::uuid
      ELSE NULL
    END
  );

ALTER TABLE public.groups
  ADD CONSTRAINT groups_pkey PRIMARY KEY (id);

ALTER TABLE public.user_groups
  ADD CONSTRAINT user_groups_groupId_fkey
  FOREIGN KEY ("groupId") REFERENCES public.groups(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_activeGroupId_fkey
  FOREIGN KEY ("activeGroupId") REFERENCES public.groups(id) ON DELETE SET NULL;

-- =============================================================
-- 3) CONVERT MATCH IDs TO UUID + ADD EXTERNAL ID
-- =============================================================
ALTER TABLE public.matches
  ALTER COLUMN id DROP DEFAULT,
  ALTER COLUMN id TYPE uuid
  USING (
    CASE
      WHEN id IS NULL OR id = '' THEN gen_random_uuid()
      WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN id::uuid
      ELSE gen_random_uuid()
    END
  ),
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.predictions
  ALTER COLUMN "matchId" TYPE uuid
  USING (
    CASE
      WHEN "matchId" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN "matchId"::uuid
      ELSE gen_random_uuid()
    END
  );

ALTER TABLE public.matches
  ADD CONSTRAINT matches_pkey PRIMARY KEY (id);

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_pkey PRIMARY KEY ("userId", "matchId");

ALTER TABLE public.predictions
  ADD CONSTRAINT predictions_matchId_fkey
  FOREIGN KEY ("matchId") REFERENCES public.matches(id) ON DELETE CASCADE;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS "externalMatchId" text;

CREATE UNIQUE INDEX IF NOT EXISTS matches_external_match_id_uidx
  ON public.matches("externalMatchId")
  WHERE "externalMatchId" IS NOT NULL;

-- =============================================================
-- 4) DATETIME TEXT -> TIMESTAMPTZ
-- =============================================================
ALTER TABLE public.groups
  ALTER COLUMN "createdAt" TYPE timestamptz
  USING NULLIF("createdAt", '')::timestamptz;

ALTER TABLE public.user_groups
  ALTER COLUMN "joinedAt" TYPE timestamptz
  USING NULLIF("joinedAt", '')::timestamptz;

ALTER TABLE public.matches
  ALTER COLUMN date TYPE timestamptz
  USING NULLIF(date, '')::timestamptz;

ALTER TABLE public.predictions
  ALTER COLUMN timestamp TYPE timestamptz
  USING NULLIF(timestamp, '')::timestamptz;
