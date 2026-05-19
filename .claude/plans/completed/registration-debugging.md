# [COMPLETED] Registration / Group Join Fix

_Completed: 2026-05-11_

---

## Problem
New users got "Código de grupo inválido." with valid group codes. After fix, email confirmation redirect did not join the group.

## Root Causes
1. `DatabaseContext` skips groups fetch when `!isAuthenticated` → `groupsList` empty pre-auth. RLS `groups_select` was `TO authenticated` only — anon couldn't read groups even if queried.
2. With Supabase email confirmation enabled, `signInWithPassword()` fails before `addUserToGroup()` runs → group join never happened on confirmation redirect.

## Fixes Applied
- `database/migrations/0005_groups_anon_select.sql` — `groups_select` policy extended to `anon, authenticated`
- `database/rls/current.sql` — updated to reflect migration
- `hooks/useUserSystem.ts` — fallback direct DB query in `register()` when in-memory list misses
- `hooks/useUserSystem.ts` — `resumePendingGroupJoin()`: saves `group.id` to localStorage before early return; completes join from `syncSession` + `onAuthStateChange` after email confirmation

## Verified in Production ✅
Full flow: register → confirm email → land in app inside the group.
