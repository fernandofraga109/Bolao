# Production Stabilization Plan

_Sprint reprioritization: 2026-05-11_  
_Status: IN PROGRESS — Phase 1 active_

---

## Context

After deploying to Vercel, three critical production issues were discovered that block core user flows. Sprint priorities shifted away from the "What's New" modal to stabilize the app before resuming feature work.

---

## Shared Root Cause Theme

All three issues trace back to the same architectural tension: **the app maintains two sources of truth (Supabase auth metadata vs database tables), and reconciliation logic either runs before data is available or resolves in the wrong direction.**

---

## Issues and Priority

| Priority | Issue | Status | Plan File |
|----------|-------|--------|-----------|
| P0 | Registration / group join broken | **ACTIVE** | `registration-debugging.md` |
| P1 | `user_groups.points` not updating | Pending | `points-sync-investigation.md` |
| P1 | User profile name reverts | Pending | `profile-sync-investigation.md` |
| P2 | Dynamic underdog bonus display | Backlog | — |
| P2 | FIFA ranking in match cards | Backlog | — |

---

## Execution Order

### Phase 1 — Registration Fix [P0] ← AWAITING MIGRATION APPLY
- Fix: add anon RLS on `groups` + direct DB fetch in `register()` ✓
- Migration: `database/migrations/0005_groups_anon_select.sql` — must be applied in Supabase
- Gate: registration works end-to-end for new users

### Phase 2 — Points Persistence Fix [P1]
- Fix: validate `.update()` writes via `.select()`, surface silent failures
- Gate: `user_groups.points` updates reliably after sync

### Phase 3 — Profile Name Fix [P1]
- Fix: identify and block the background path overwriting `user_roles.displayName`
- Gate: manual DB name changes persist through sync cycles

### Phase 4 — P2 UX
- Dynamic underdog bonus display
- FIFA ranking in match cards

### Phase 5 — Deferred Feature Work
- "What's New" modal (plan: `tem-como-fazer-algum-robust-hammock.md` in global plans)
- changelog-updater agent
- Production Vercel finalization

---

## Completion Tracking

- [ ] Phase 1: Registration fix verified in production (migration 0005 must be applied first)
- [ ] Phase 2: Points persistence fix verified in production
- [ ] Phase 3: Profile overwrite fix verified in production
- [ ] Phase 4: P2 UX improvements
- [ ] Phase 5: Resume deferred feature work
