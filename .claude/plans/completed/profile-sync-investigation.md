# [COMPLETED] Profile Name Revert Fix

_Completed: 2026-05-11_

---

## Problem
Changes to `user_roles.displayName` in Supabase reverted after a short time.

## Root Cause (Suspected)
App uses two sources of truth: `auth.user_metadata.display_name` (written at signup, never updated) and `user_roles.displayName` (the DB authority). A background path was suspected to call `updateUser()` with stale auth metadata name, overwriting manual DB edits.

## Status
Verified in production without requiring code changes — the issue did not reproduce in the current build. Likely stabilized by the Phase 1/2 changes that corrected the auth state flow and sync cycle timing.

## If It Resurfaces
The diagnostic approach is documented in the original investigation plan. Short version: add a `console.trace()` inside `updateUser()` whenever `name` is in the payload, identify the background caller, and remove the name field from that path.

Files to check: `hooks/useUserSystem.ts:141–246`, `contexts/DatabaseContext.tsx:738–754`.
