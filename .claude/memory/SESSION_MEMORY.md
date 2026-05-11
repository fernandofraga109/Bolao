# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current branch:** `feature/03/claude-code`  
**Test suite:** 33 tests passing (Vitest + RTL + happy-dom)

**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Current Sprint: Production Stabilization

Sprint reprioritized on 2026-05-11 after discovering critical production regressions on Vercel.

**Master plan:** `.claude/plans/production-stabilization-plan.md`

### Phase 1: Registration Fix [P0] — IMPLEMENTED, AWAITING E2E VERIFICATION

**Two-part fix applied:**

1. **Group code validation (RLS + fallback query):** Migration 0005 applied. `register()` now falls back to a direct DB query when the in-memory groups list is empty (pre-auth timing).

2. **Post-confirmation group join (email flow):** When Supabase email confirmation is enabled, `signInWithPassword()` fails immediately after signup. Group ID is now saved to `localStorage("bolao_pending_group_${userId}")` before returning. `resumePendingGroupJoin()` executes in `syncSession` + `onAuthStateChange` after confirmation redirect to complete the `user_groups` insert.

**Remaining:** Test the full flow end-to-end in production (register → confirm email → verify group membership).  
**Plan:** `.claude/plans/registration-debugging.md`

### Pending — Phase 2: Points Persistence [P1]

**Problem:** `user_groups.points` stays 0 after sync; leaderboard regresses on reload.  
**Root cause:** `.update()` has no `.select()` validation; silent write failures go undetected.  
**Plan:** `.claude/plans/points-sync-investigation.md`

### Pending — Phase 3: Profile Name Reverts [P1]

**Problem:** Manual `user_roles.displayName` changes revert within minutes.  
**Root cause:** A background path calls `updateUser()` with stale auth metadata name, overwriting DB.  
**Fix:** Phase 3A — identify caller via diagnostic logging; Phase 3B — targeted fix.  
**Plan:** `.claude/plans/profile-sync-investigation.md`

---

## Deferred Work

| Item | Plan |
|------|------|
| "What's New" modal + changelog-updater agent | Global plan: `tem-como-fazer-algum-robust-hammock.md` — resume after stabilization |
| P2: Dynamic underdog bonus display | No plan yet |
| P2: FIFA ranking in match cards | No plan yet |
| Production Vercel finalization | Blocked on P0/P1 fixes |

---

## Recently Completed

### 2026-05-11 — Production stabilization planning
- Ran 3 parallel Explore agents; confirmed root causes for all 3 production issues
- Created `.claude/plans/` directory with 4 structured plan files
- Reprioritized sprint from "What's New" modal to stabilization

### 2026-05-11 — Migrations aplicadas + tabela funcionando
- Todas as migrations SQL (`0001`–`0004` + RLS + seed) aplicadas no Supabase
- `TournamentStandings` exibindo corretamente: WC mostra grupos (GROUP_A, GROUP_B…), BSA mostra bloco único "Tabela"
- Sync refatorado: qualquer usuário pode acionar manualmente (não mais restrito ao admin)

### 2026-05-10–11 — Sprint 3 infrastructure
- Test suite: Vitest + RTL + happy-dom; 33 tests passing
- Code splitting in `vite.config.ts`; empty state in `MatchesPage`
- Docs: `docs/DEPLOY_VERCEL.md`; Agents: `test-runner.md`
- Memory system: moved to `.claude/memory/`, created `features/sync-system.md`, updated `CLAUDE.md`

---

## Known Issues / Architectural Notes

| Issue | Status |
|-------|--------|
| Sync is user-triggered, not automatic | Mitigated — any user can trigger. Edge Functions + pg_cron still viable upgrade path. |
| Two sources of truth for user names (auth metadata vs `user_roles`) | Active bug — tracked in Phase 3 plan |
| Groups not accessible pre-auth (RLS) | Active bug — tracked in Phase 1 plan |

---

## Next Action

Test the full registration flow in production:
1. Register with a valid group code
2. Confirm email via the link
3. Verify you land in the app inside the group (leaderboard shows you)

After Phase 1 is confirmed stable: begin Phase 2 (points persistence fix).

_Last updated: 2026-05-11_
