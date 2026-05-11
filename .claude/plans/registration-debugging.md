# Registration / Group Join — Investigation & Fix Plan

_Status: COMPLETE — awaiting end-to-end production verification_  
_Last updated: 2026-05-11_

---

## Problem Summary

New users attempting to register with a valid group code receive:

> "Código de grupo inválido."

The group code exists in the database and existing members belong to the group. The issue is 100% reproducible for new users attempting to join during registration.

---

## Confirmed Root Cause

**Timing trap: groups list is empty at registration time because unauthenticated clients cannot fetch groups.**

### Cause Chain

1. `register(name, email, pass, code, groupsList)` in `hooks/useUserSystem.ts:303` validates the group code by searching `groupsList`
2. `groupsList` is sourced from `DatabaseContext.groups`, passed in from `App.tsx`
3. `DatabaseContext` at `contexts/DatabaseContext.tsx:318–320` skips the Supabase groups fetch when `isAuthenticated === false`:
   ```ts
   isAuthenticated
     ? supabase.from("groups").select("*")
     : Promise.resolve({ data: null, error: null })
   ```
4. Pre-registration: user has no session → `isAuthenticated` is false → groups list is empty (falls back to seed data only)
5. RLS policy `groups_select` at `database/rls/current.sql:112` is `FOR SELECT TO authenticated` — the anon role cannot query the `groups` table even if we tried
6. Result: `groupsList.find(g => g.code === code)` never finds a match → returns the error message

### Why Existing Users Are Unaffected

Once authenticated, the context re-fetches and populates `groups` from Supabase. Authenticated users can validate codes correctly.

---

## Affected Systems / Files

| File | Location | Role in failure |
|------|----------|-----------------|
| `hooks/useUserSystem.ts` | Lines 303–320 | `register()` searches passed `groupsList`; never queries DB directly |
| `contexts/DatabaseContext.tsx` | Lines 298, 318–320 | Skips groups fetch when `!isAuthenticated` |
| `database/rls/current.sql` | Lines 112–116 | `groups_select` requires `authenticated` role |
| `App.tsx` | Line ~217 | Passes `db.groups` (empty) into `register()` |

---

## Fix Design

### Part A — RLS: Allow anon SELECT on `groups`

Add a new policy permitting the `anon` role to read from `groups`. Groups contain no PII (only: id, name, code, adminId, createdAt, competitionCode). Group codes are shared explicitly by users and are not secret.

```sql
CREATE POLICY "groups_select_anon"
  ON groups
  FOR SELECT
  TO anon
  USING (true);
```

This must be applied in Supabase (dashboard or via migration). Update `database/rls/current.sql` to reflect the current policy state.

### Part B — Code: Direct fetch in `register()`

Modify `hooks/useUserSystem.ts` `register()` function. When `groupsList` lookup misses, perform a targeted query:

```ts
// Try passed list first (fast path for authenticated users)
let group = groupsList.find(g => g.code.toUpperCase() === groupCode.toUpperCase());

// If not found, query DB directly (handles pre-auth registration)
if (!group && supabase) {
  const { data } = await supabase
    .from("groups")
    .select("*")
    .eq("code", groupCode.toUpperCase())
    .single();
  if (data) group = mapGroupDBToGroup(data); // use existing mapper
}

if (!group) return { success: false, message: "Código de grupo inválido." };
```

This is a fallback — it only fires when the list fails. No change to the happy path.

---

## Implementation Steps

1. Apply the anon RLS policy in Supabase dashboard (SQL editor or migration)
2. Update `database/rls/current.sql` to reflect the new policy
3. Modify `hooks/useUserSystem.ts` register() with the fallback query
4. Test locally (dev schema) with a real group code as an unauthenticated user
5. Test in production
6. Commit: `fix(auth): allow anon group lookup during registration`

---

## Risks and Rollback

- **Risk**: anon SELECT on groups is additive and non-destructive. No data exposed beyond what a user would see after joining.
- **Rollback**: `DROP POLICY "groups_select_anon" ON groups;` — instant, no data loss.
- **Edge case**: group code casing. Current code normalizes to `.toUpperCase()` on both sides. DB stores codes in whatever case the admin created them. Confirm the `.eq()` filter handles this (Supabase text comparison is case-sensitive by default — may need `.ilike()` or `.eq("code", code.toUpperCase())` with DB values also uppercased at creation time).

---

## Validation Strategy

1. Open app as unauthenticated user
2. Navigate to registration form
3. Enter a valid group code from the database
4. Submit — should proceed past group validation
5. Confirm `user_groups` row created in Supabase dashboard
6. Confirm new user appears in group leaderboard after login
7. Check: invalid code still returns "Código de grupo inválido." (regression check)

---

## Additional Root Cause Found During Testing

The original fix (anon RLS + fallback query) solved group code validation. However a second failure was discovered: with Supabase email confirmation enabled, `signInWithPassword()` is called immediately after `signUp()` but fails because the email is unconfirmed. The function returns early, and `addUserToGroup()` never executes. After confirmation, nothing resumed the join.

**Second fix applied:**
- `register()`: if `signInWithPassword()` fails with confirmation-required error and `authUserId` is known, save group ID to `localStorage.setItem("bolao_pending_group_${authUserId}", group.id)`
- New `resumePendingGroupJoin(userId)` callback: reads localStorage, checks DB for existing membership, inserts `user_groups` row if missing, updates `activeGroupId`, cleans up localStorage
- `syncSession()` + `onAuthStateChange`: both call `resumePendingGroupJoin(sessionUser.id)` after `ensureProfileForAuthUser` — fires after email confirmation redirect

## Completion Checklist

- [x] Anon RLS policy applied in Supabase (migration 0005 confirmed applied)
- [x] `database/rls/current.sql` updated
- [x] `hooks/useUserSystem.ts`: fallback DB query in `register()`
- [x] `hooks/useUserSystem.ts`: `resumePendingGroupJoin` + localStorage persistence for email-confirmation flow
- [x] TypeScript check: no errors in modified file
- [x] Test suite: 43 tests passing
- [ ] Production test: full registration flow (group code → email confirm → land in group)
