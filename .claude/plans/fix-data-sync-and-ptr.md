# Fix: Data Sync Reliability + Pull-to-Refresh Global

_Status: IN PROGRESS — 2026-05-16 — branch `fix/data-sync-and-ptr`_

---

## Problem 1 — Other users' predictions not appearing

### Root cause (confirmed)

`hydratedUsers` in `hooks/useUserSystem.ts` (lines 59–138) filters each user's predictions using that user's own `resolvedActiveGroupId` — computed from `localStorage` and `user.activeGroupId` from the database.

The problem: this computation runs on the **viewer's device**, not on Fernando's. So:
- `localStorage.getItem('bolao_active_group_${fernando.id}')` → **null** on the viewer's device
- `fernando.activeGroupId` in the DB → may be null or point to a different group

Result: `resolvedActiveGroupId` for Fernando resolves to the wrong group (or null), and his predictions with `groupId = viewer's active group` are discarded at lines 87–90.

```ts
// Bug is here — resolvedActiveGroupId is computed per-user but using the VIEWER's data
const isExactGroupPrediction = !!resolvedActiveGroupId && p.groupId === resolvedActiveGroupId;
if (!isExactGroupPrediction && !isLegacyPrediction) return;  // Fernando's predictions discarded
```

### Fix

Compute `viewerActiveGroupId` (the current user's active group) BEFORE the `hydratedUsers` memo and use it to filter OTHER users' predictions. The current user still uses their own resolution logic.

**`hooks/useUserSystem.ts`:**

1. Add `viewerActiveGroupId` memo before `hydratedUsers`:
   ```ts
   const viewerActiveGroupId = useMemo(() => {
     if (!currentUserId) return undefined;
     const fromStorage = localStorage.getItem(`bolao_active_group_${currentUserId}`);
     const myGroups = db.userGroups.filter(ug => ug.userId === currentUserId).map(ug => ug.groupId);
     return (fromStorage && myGroups.includes(fromStorage) ? fromStorage : undefined)
       || db.users.find(u => u.id === currentUserId)?.activeGroupId
       || myGroups[0];
   }, [currentUserId, db.users, db.userGroups]);
   ```

2. In the predictions loop inside `hydratedUsers`, use different group IDs per user type:
   ```ts
   // For the viewer: use their own resolvedActiveGroupId (existing logic)
   // For other users: use viewerActiveGroupId
   const effectiveGroupId = user.id === currentUserId ? resolvedActiveGroupId : viewerActiveGroupId;
   const isExactGroupPrediction = !!effectiveGroupId && p.groupId === effectiveGroupId;
   ```

3. Add `viewerActiveGroupId` to the `hydratedUsers` dependency array.

**File:** `hooks/useUserSystem.ts`

---

## Problem 2 — user_groups zeroes out during sync

### Root cause (confirmed)

In `hooks/usePointsProcessor.ts`, `recalculateUserGroupPoints` (lines 39–42):

```ts
const { data: preds } = await supabase
  .from("predictions")
  .select("userId, matchId, homeScore, awayScore")
  .eq("groupId", groupId);
```

If this query returns **0 results** (timing issue, wrong schema, silent error), `pointsByUser` stays empty and every member gets `points: 0`:

```ts
const finalUpdates = members.map((u) => ({
  points: pointsByUser[u.userId] || 0,  // → 0 for everyone
}));
```

Then each member is updated via individual UPDATE calls in a loop — Realtime fires one event per row, so non-admin viewers see zeroed points before the correction arrives.

Two sub-problems:
- **Sub-problem A:** No safety guard — if `preds` unexpectedly returns empty, everyone gets zeroed
- **Sub-problem B:** Sequential updates fire N Realtime events; UI sees intermediate state

### Fix

**`hooks/usePointsProcessor.ts`:**

1. **Safety guard:** if `preds` returns 0 results but the group already has members with points > 0, skip the update (data looks inconsistent — do not overwrite):
   ```ts
   if (!preds || preds.length === 0) {
     const hasExistingPoints = members.some(m => (m.points ?? 0) > 0);
     if (hasExistingPoints) {
       console.warn(`⚠️ Empty predictions for group ${groupId} with existing points — skipping update`);
       continue;
     }
   }
   ```

2. **Batch upsert** instead of individual loop — replace the `for` loop with a single call:
   ```ts
   const { error: upsertError } = await supabase
     .from("user_groups")
     .upsert(finalUpdates, { onConflict: "userId,groupId" });
   ```
   One operation → one Realtime event → no intermediate states visible to other clients.

3. Remove the `for (const update of finalUpdates)` loop and `successfulUpdates` array — replace with the upsert above.

4. Call `dbRef.current.updateLocalUserGroups(finalUpdates)` directly after the upsert (if no error).

**File:** `hooks/usePointsProcessor.ts`

---

## Problem 3 — Pull-to-refresh only on the Matches screen

### Approach: global wrapper in App.tsx

Instead of adding the hook to each page individually, create a single wrapper on the main content container in `App.tsx`. The `onRefresh` calls all three refetches: `refetchMatches + refetchPredictions + refetchTeamStandings`.

**`App.tsx`:**

1. Expand `handleRefreshData` to include `refetchTeamStandings`:
   ```ts
   const handleRefreshData = async () => {
     await Promise.all([
       db.refetchMatches(),
       db.refetchPredictions(),
       db.refetchTeamStandings(),
     ]);
   };
   ```

2. Move the `usePullToRefresh` hook and `PullToRefreshIndicator` to `App.tsx`, removing them from `MatchesPage`.

3. Wrap the `<main>` content with `containerRef` and `handlers`:
   ```tsx
   <main ref={containerRef} className="..." {...handlers}>
     <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
     {/* existing pages */}
   </main>
   ```

4. Remove the current pull-to-refresh integration from `MatchesPage.tsx` (props, hook, indicator) — it now lives only in `App.tsx`.

5. Remove the `onRefreshData` prop from the `MatchesPage` interface.

**Files changed:**
- `App.tsx` — add hook + indicator + expand handleRefreshData
- `components/pages/MatchesPage.tsx` — remove PTR integration (props + hook + indicator)

---

## Critical files

| File | Change |
|------|--------|
| `hooks/useUserSystem.ts` | `viewerActiveGroupId` memo; filter predictions with `effectiveGroupId` |
| `hooks/usePointsProcessor.ts` | Safety guard; batch upsert instead of loop |
| `App.tsx` | Global PTR; `handleRefreshData` with 3 refetches |
| `components/pages/MatchesPage.tsx` | Remove PTR (prop + hook + indicator) |

---

## Verification

- **Fix 1:** Two users in the same group, both with predictions. Without any reload or PTR, both should appear in "O que a galera acha". PTR should also show both.
- **Fix 2:** Admin runs sync. Other users viewing the leaderboard should NOT see points zero out — they should go directly from old value to new value, or remain unchanged.
- **Fix 3:** On any tab (Matches, Leaderboard, Tournament, Stats), drag down → indicator appears → release → data re-fetched from Supabase.

---

## Progress

- [x] Fix 1 — `hydratedUsers` predictions filter using `viewerActiveGroupId` (2026-05-16)
- [x] Fix 2 — `usePointsProcessor` safety guard + batch upsert (2026-05-16)
- [x] Fix 3 — Global PTR in App.tsx (2026-05-16)
