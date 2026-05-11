# Points Sync — Investigation & Fix Plan

_Status: PENDING — start after Phase 1 complete_  
_Last updated: 2026-05-11_

---

## Problem Summary

Users with valid predictions for FINISHED matches still show 0 or stale points on the leaderboard. Points appear correct in-memory immediately after sync but do not persist to `user_groups.points`. On page reload, the DB value (0 or stale) overrides in-memory state, so the leaderboard regresses.

---

## Confirmed Root Causes

Multiple compounding issues in `hooks/usePointsProcessor.ts`.

### 1. Silent Update Failure — No Write Validation

**Location:** `hooks/usePointsProcessor.ts:85–89`

The `.update({ points })` call on `user_groups` does not chain `.select()`:
```ts
const { error: updateError } = await supabase
  .from("user_groups")
  .update({ points: update.points })
  .eq("userId", update.userId)
  .eq("groupId", update.groupId);
```

Supabase returns `error: null` and `data: null` when a filter matches 0 rows. The code only checks `error` — it never knows if any rows were actually updated.

### 2. `updateLocalUserGroups()` Is React-Only

**Location:** `contexts/DatabaseContext.tsx:1176–1192`

After the DB update attempt, `dbRef.current.updateLocalUserGroups(finalUpdates)` patches React state. This function only updates `useState` — it makes no Supabase call. If the DB write above silently failed, the UI looks correct until reload.

### 3. Leaderboard Prioritizes DB Value

**Location:** `hooks/useLeaderboard.ts:86–92`

The leaderboard reads `user_groups.points` from the DB snapshot first. If DB has 0, leaderboard shows 0 regardless of React state. In-memory corrections are invisible after reload.

### 4. `batchProcessPointsForMatches` Silently Swallows RLS Errors

**Location:** `hooks/usePointsProcessor.ts:154–160`

Individual `predictions.points` upserts are wrapped in a try/catch that logs only a debug message ("comportamento esperado"). If the upsert fails (e.g., RLS), the failure is invisible — and `recalculateUserGroupPoints()` then uses the stale predictions as its input.

### 5. Possible Filter Casing Mismatch (To Confirm in Phase 2A)

DB columns are `"userId"` and `"groupId"` (quoted camelCase in SQL). The JS `.eq()` calls use the same strings, but if the Supabase JS client translates column names differently across schema versions, filters could silently match 0 rows.

---

## Affected Systems / Files

| File | Location | Role in failure |
|------|----------|-----------------|
| `hooks/usePointsProcessor.ts` | Lines 85–98 | Update call missing `.select()` |
| `hooks/usePointsProcessor.ts` | Lines 154–160 | Silent swallow of predictions upsert failure |
| `hooks/useLeaderboard.ts` | Lines 86–92 | DB value takes priority; stale 0 wins on reload |
| `contexts/DatabaseContext.tsx` | Lines 1176–1192 | `updateLocalUserGroups` is React state only |

---

## Fix Design

### Phase 2A — Add Write Validation (Safe, Minimal)

In `recalculateUserGroupPoints()`:

```ts
const { data: updated, error: updateError } = await supabase
  .from("user_groups")
  .update({ points: update.points })
  .eq("userId", update.userId)
  .eq("groupId", update.groupId)
  .select("userId, groupId, points");  // ← validate write

if (updateError) {
  console.error("[POINTS] DB update error:", updateError, { userId: update.userId, groupId: update.groupId });
  anyFailed = true;
} else if (!updated || updated.length === 0) {
  console.error("[POINTS] Update matched 0 rows — filter mismatch?", { userId: update.userId, groupId: update.groupId });
  anyFailed = true;
}
```

This surfaces both RLS failures and filter mismatches without changing behavior.

### Phase 2B — Diagnose Filter Values (If 2A Shows 0 Rows)

If 2A logs confirm 0 rows updated: compare the `userId`/`groupId` values in the JS payload against the actual UUID values in `user_groups`. Check whether the client uses the correct schema for the composite PK.

### Phase 2C — Surface Errors to User (Optional)

If silent failures are common, add a visible warning in the admin sync UI that "X group point updates failed." This is UX polish, not a correctness fix.

---

## Investigation Steps

1. Deploy Phase 2A logging to staging/production
2. Trigger manual sync with a user who has predictions for a FINISHED match
3. Inspect console logs for "[POINTS] DB update error" or "0 rows" messages
4. Cross-reference `userId`/`groupId` values with actual DB rows
5. Implement targeted fix based on findings
6. Retest: trigger sync → query `user_groups` → reload → verify leaderboard

---

## Risks and Rollback

- Phase 2A is additive (only adds `.select()` and logging) — zero behavior change, rollback trivial
- Phase 2B/2C changes depend on findings — assess risk at that point
- No schema changes required for any phase

---

## Validation Strategy

1. Have a user with predictions for ≥1 FINISHED match
2. Trigger manual sync
3. Query `SELECT "userId", "groupId", points FROM user_groups WHERE points > 0` — should return rows
4. Reload app — leaderboard should show same values
5. Repeat after 5-minute background sync interval passes

---

## Completion Checklist

- [ ] Phase 2A: `.select()` validation added and deployed
- [ ] Phase 2A: Logs reviewed; root cause of 0 rows (if any) identified
- [ ] Phase 2B: Filter fix applied (if needed)
- [ ] Production test: points persist across reload
- [ ] SESSION_MEMORY.md updated
