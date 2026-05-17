# Fix: predictions.points not updated during sync → StatsPage shows 0 pts

_Status: DONE — 2026-05-16_

---

## Symptom

`StatsPage` (Histórico de Palpites) shows 0 pts for predictions that clearly earned points (e.g. CA Mineiro 3×1, user predicted 2×0 → MatchCard shows 7 pts, StatsPage shows 0 pts). Happens consistently after page reload.

---

## Root Cause Analysis

### Bug A — `upsertPrediction` poisons the idempotency check in `batchProcessPointsForMatches`

`batchProcessPointsForMatches` (in `hooks/usePointsProcessor.ts`) is the function responsible for writing `predictions.points` during sync. Its idempotency guard is:

```ts
if (pred.points !== pts) {
  updatesToUpsert.push(...);
}
```

Where `pred` comes from `dbRef.current.predictions` — the **local React state**, NOT a fresh DB fetch.

When it calls `upsertPrediction(updatesToUpsert)` to write the points, `upsertPrediction` (in `DatabaseContext.tsx:1082`) **always updates local state first** (`setPredictions(...)`) before attempting the DB write:

```ts
// Local state updated immediately — regardless of DB success
setPredictions((prev) => { ... });

// DB write attempted after
const { error } = await supabase.from("predictions").upsert(...);
if (error) throw new Error(...);
```

If the DB write fails (for any reason), the error is caught and silenced in `batchProcessPointsForMatches`:

```ts
try {
  await dbRef.current.upsertPrediction(updatesToUpsert);
} catch (err) {
  console.debug("[SYNC] Upsert de predictions limitado por RLS ..."); // silenced!
}
```

**Result:** Local state now shows `points: 7` (updated), but the DB still has `null`. On the next sync, `pred.points === pts` (both 7 from local state) → the idempotency check skips the upsert → DB is never fixed. Every page reload reads `points: null` from the DB → StatsPage shows 0 pts.

### Bug B — The comment/assumption about RLS is wrong

The catch block comment says "expected RLS behavior". But the `predictions_update` RLS policy allows **any authenticated user** to update any prediction row (`USING (true) WITH CHECK (true)`). The failure is likely a different error (constraint mismatch, missing column, network, etc.) that gets silenced and misattributed.

---

## Fix

### Approach

Move the responsibility for updating `predictions.points` into `recalculateUserGroupPoints`, which:
1. Already fetches predictions **fresh from the DB** (not local state) — no poisoning issue
2. Already calculates exact points per prediction via `calculatePoints()`
3. Already has all the data needed (group config, match results via `finishedMatchesMap`)

Add one step: after computing `pointsByUser`, batch-update `predictions.points` directly in the DB for predictions where the stored value differs.

### Changes

**`hooks/usePointsProcessor.ts` — `recalculateUserGroupPoints`:**

1. Expand the predictions query to also select `points`:
   ```ts
   const { data: preds, error } = await supabase
     .from("predictions")
     .select("userId, matchId, groupId, homeScore, awayScore, points")
     .eq("groupId", groupId);
   ```

2. While iterating predictions to build `pointsByUser`, also track which predictions need their `points` column updated:
   ```ts
   const predPointsUpdates: { userId: string; matchId: string; groupId: string; points: number }[] = [];

   (preds || []).forEach((p) => {
     if (!pointsByUser[p.userId]) pointsByUser[p.userId] = 0;
     const match = finishedMatchesMap.get(p.matchId);
     if (match) {
       const pts = calculatePoints(...);
       pointsByUser[p.userId] += pts;
       // Track if stored points differ from calculated
       if (p.points !== pts) {
         predPointsUpdates.push({ userId: p.userId, matchId: p.matchId, groupId, points: pts });
       }
     }
   });
   ```

3. After the `user_groups` upsert (if no error), batch-update `predictions.points`:
   ```ts
   if (predPointsUpdates.length > 0) {
     for (const upd of predPointsUpdates) {
       await supabase
         .from("predictions")
         .update({ points: upd.points })
         .eq("userId", upd.userId)
         .eq("matchId", upd.matchId)
         .eq("groupId", upd.groupId);
     }
   }
   ```
   Note: `predictions_update` RLS allows any authenticated user to update any row.

4. Remove (or stop relying on) `batchProcessPointsForMatches` for this purpose — it should only call `recalculateUserGroupPoints` which handles everything:
   - In `batchProcessPointsForMatches`, remove the `upsertPrediction` call and just let `recalculateUserGroupPoints` (called at the end) handle both `user_groups.points` AND `predictions.points`.
   - Remove the silent try/catch — it was masking real errors.

---

## Files changed

| File | Change |
|------|--------|
| `hooks/usePointsProcessor.ts` | Expand predictions query to include `points`; track and batch-update `predictions.points` inside `recalculateUserGroupPoints`; remove `upsertPrediction` call from `batchProcessPointsForMatches` |

---

## Why this is better

| Before | After |
|--------|-------|
| Reads local state for idempotency → poisoned by `setPredictions` | Reads from DB → always accurate |
| Uses `upsertPrediction` which updates local state before DB | Uses direct `supabase.update()` — no local state side effects |
| Silent catch masks real errors | Errors are logged properly |
| Two separate code paths for `user_groups.points` and `predictions.points` | Single function handles both atomically |

---

## Verification

1. Admin runs sync after matches finish
2. Open StatsPage — predictions for finished matches show correct pts (not 0)
3. Hard-reload page — pts still show correctly (confirming DB was actually updated)
4. Query Supabase directly: `SELECT matchId, points FROM predictions WHERE userId = '<uid>'` — `points` column has non-null values for finished matches

---

## Progress

- [x] Expand `preds` query in `recalculateUserGroupPoints` to include `points` (2026-05-16)
- [x] Build `predPointsUpdates` list alongside `pointsByUser` (2026-05-16)
- [x] Batch-upsert `predictions.points` after `user_groups` upsert via direct supabase call (2026-05-16)
- [x] Remove poisoning `upsertPrediction` call from `batchProcessPointsForMatches` (2026-05-16)
