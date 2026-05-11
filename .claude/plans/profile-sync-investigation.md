# Profile Name Sync — Investigation & Fix Plan

_Status: PENDING — start after Phase 2 complete_  
_Last updated: 2026-05-11_

---

## Problem Summary

When a user's display name is changed directly in the `user_roles` table in Supabase, the app initially reflects the change (via Realtime). However, within minutes the database value reverts to the previous name. The overwrite happens silently with no user action.

---

## Confirmed Root Cause

**Divergent sources of truth + a background path that overwrites DB with stale auth metadata.**

### The Two Sources

| Source | Where | When written |
|--------|-------|--------------|
| `auth.users.user_metadata.display_name` | Supabase Auth service | Written once at signup via `api/supabase-signup.ts:73` |
| `user_roles.displayName` | App database | Written at signup and on explicit user edits |

These can diverge after manual DB edits, and the app does not sync them.

### The Revert Mechanism

**Location:** `contexts/DatabaseContext.tsx:738–754` (`updateUser`)

```ts
const updateUser = async (id: string, data: Partial<UserDB>) => {
  setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
  if (isSupabaseEnabled() && supabase) {
    const payload: Record<string, any> = {};
    if ("name" in data && data.name !== undefined)
      payload.displayName = data.name;  // ← writes user.name to DB
    // ...
    if (Object.keys(payload).length > 0) {
      await supabase.from("user_roles").update(payload).eq("userId", id);
    }
  }
};
```

`updateUser()` is general-purpose — it writes whatever `name` is in the payload back to `user_roles.displayName`. If any background path calls this with a stale name derived from auth metadata, it overwrites the DB.

### Likely Trigger Paths

The exact caller needs to be confirmed (Phase 3A investigation):

1. **`syncSession()` / `onAuthStateChange`** — `hooks/useUserSystem.ts:189–246`. Called on app mount and every auth state change. Calls `ensureProfileForAuthUser()` with `session.user.user_metadata` (stale). While `ensureProfileForAuthUser` returns early if the user exists, something in this chain may call `updateUser()` after.

2. **Background sync** — `hooks/useBackgroundSync.ts` triggers every 3 minutes. If it calls a profile refresh that re-hydrates from auth metadata and then calls `updateUser()`, it would overwrite the DB.

3. **Admin operations** — Any admin flow that touches user records may inadvertently include the name field.

---

## Affected Systems / Files

| File | Location | Role in failure |
|------|----------|-----------------|
| `hooks/useUserSystem.ts` | Lines 141–246 | `ensureProfileForAuthUser`, `syncSession`, `onAuthStateChange` — sources stale auth metadata |
| `contexts/DatabaseContext.tsx` | Lines 738–754 | `updateUser()` — writes name back to DB unconditionally |
| `api/supabase-signup.ts` | Lines 73–79 | Writes name to auth metadata at signup; never updated after |

---

## Fix Design

### Phase 3A — Diagnostic Logging (Investigation)

Add a temporary caller tag to `updateUser()` to capture when and why `name` is included in the payload:

```ts
const updateUser = async (id: string, data: Partial<UserDB>, _caller?: string) => {
  if ("name" in data) {
    console.warn("[PROFILE] updateUser called with name:", data.name, "caller:", _caller ?? "unknown");
    console.trace();
  }
  // ... rest of function
};
```

Deploy to staging, change a DB name, wait for the revert, then inspect console for the trigger.

### Phase 3B — Targeted Fix (After 3A)

**Most likely fix**: Remove `name` from the `updateUser()` payload in whatever background path triggers the overwrite. Name should only be updated when the user explicitly changes it via the profile form.

**Alternative fix**: In `syncSession()` / `ensureProfileForAuthUser()`, after setting the initial profile from auth metadata, do a fresh query on `user_roles` and use the DB value as the authoritative name — overwriting the auth metadata value in React state. This prevents the stale metadata from ever being used to write back.

**Simplest targeted guard**: In `updateUser()`, before writing `displayName` to the DB, check if the payload `name` differs from the current DB value. Only write if different. This prevents a no-op that overwrites a manual edit:

```ts
// Guard: only write name if explicitly changed by user action
// (not from background hydration of stale auth metadata)
```

The exact approach depends on Phase 3A findings.

### Long-Term (Out of Scope for This Sprint)

When user explicitly changes their name, sync both `user_roles.displayName` AND `auth.user_metadata.display_name`. This eliminates the divergence permanently.

---

## Investigation Steps

1. Deploy Phase 3A logging to staging or production
2. Change `user_roles.displayName` directly in Supabase dashboard
3. Note the current value and timestamp
4. Wait 3–5 minutes (background sync cycle)
5. Check console for "[PROFILE] updateUser called with name:" — captures the revert event
6. Identify the exact caller from the stack trace
7. Design Phase 3B fix targeting that caller
8. Apply fix and retest

---

## Risks and Rollback

- Phase 3A: read-only investigation (adds logging only) — zero risk
- Phase 3B: targeted change to one code path — assess at implementation time
- Worst case: if guard is too aggressive, user's own name changes might not persist — easily detected and reverted

---

## Validation Strategy

1. Change `user_roles.displayName` in Supabase dashboard (e.g., append " TEST")
2. Note the timestamp
3. Observe Realtime update in app (should show immediately)
4. Wait ≥5 minutes without interacting
5. Reload the app
6. Verify the name still shows the updated value
7. Query `user_roles` directly to confirm DB value has not reverted

---

## Completion Checklist

- [ ] Phase 3A: Diagnostic logging deployed
- [ ] Phase 3A: Revert trigger identified and documented here
- [ ] Phase 3B: Fix implemented targeting the identified caller
- [ ] Production validation: name change persists through 3+ sync cycles
- [ ] Diagnostic logging removed after fix confirmed
- [ ] SESSION_MEMORY.md updated
