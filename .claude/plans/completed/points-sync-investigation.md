# [COMPLETED] Points Sync / user_groups.points Fix

_Completed: 2026-05-11_

---

## Problem
`user_groups.points` stayed 0 after sync. Header and leaderboard never reflected earned points.

## Root Cause
`recalculateUserGroupPoints()` cast `MatchDB[]` (flat `resultHome`/`resultAway`) as `Match[]` (nested `result: {home, away}`) and checked `m.result != null` — always false. `finishedMatchesMap` was permanently empty → all users calculated as 0 pts every sync.

Secondary issues: `.update()` had no `.select()` (0-row writes invisible); all-or-nothing gate blocked `updateLocalUserGroups()` even for successful individual writes.

## Fixes Applied — `hooks/usePointsProcessor.ts`
- `recalculateUserGroupPoints()`: changed to `MatchDB` fields (`resultHome`/`resultAway`), hydrates team objects + `result: {home, away}` before calculation
- Added `.select("userId, groupId, points")` to detect 0-row writes
- Replaced `anyFailed` gate with `successfulUpdates[]` accumulator for partial success

## Verified in Production ✅
Sync now writes correct points to `user_groups.points`; header and leaderboard reflect DB values after sync.
