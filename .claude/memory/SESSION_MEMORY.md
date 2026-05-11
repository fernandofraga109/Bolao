# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current branch:** `feature/03/claude-code`  
**Test suite:** 43 tests passing (Vitest + RTL + happy-dom)

**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Current Sprint: Feature Resumption

Production stabilization sprint completed 2026-05-11. All three P0/P1 issues verified in production. Resuming feature work.

---

## Active Plans

| Priority | Item | Plan |
|----------|------|------|
| **Next** | "What's New" modal + changelog-updater agent | `.claude/plans/whats-new-modal.md` |
| After | FIFA ranking in match cards + dynamic underdog bonus text | `.claude/plans/ux-improvements.md` |
| Ongoing | Production Vercel finalization | `docs/DEPLOY_VERCEL.md` |

---

## Completed — Production Stabilization (2026-05-11)

All archived in `.claude/plans/completed/`.

**Phase 1 — Registration fix:**  
Anon RLS on `groups` (migration 0005) + fallback DB query in `register()` + `resumePendingGroupJoin()` to complete group join after email confirmation redirect.

**Phase 2 — Points sync fix:**  
Root cause: `MatchDB` (flat `resultHome`/`resultAway`) was cast as `Match` (nested `result`) — guard was always false, `finishedMatchesMap` permanently empty, all users got 0 pts. Fixed in `hooks/usePointsProcessor.ts`: use `MatchDB` fields + hydrate teams; also added `.select()` write validation + `successfulUpdates[]` accumulator.

**Phase 3 — Profile name:**  
Verified working in production without code changes. Diagnostic approach in `completed/profile-sync-investigation.md` if it resurfaces.

---

## Previously Completed

### 2026-05-11 — Migrations aplicadas + tabela funcionando
- Todas as migrations SQL (`0001`–`0005`) aplicadas no Supabase
- `TournamentStandings` exibindo corretamente

### 2026-05-10–11 — Sprint 3 infrastructure
- Test suite: Vitest + RTL + happy-dom; 43 tests
- Code splitting, `DEPLOY_VERCEL.md`, agents, memory system overhaul

---

## Known Architectural Notes

| Note | Status |
|------|--------|
| Two sources of truth: auth metadata vs `user_roles.displayName` | Monitor — if name revert resurfaces, see `completed/profile-sync-investigation.md` |
| Sync is user-triggered, not automatic | Mitigated — any user can trigger. Edge Functions + pg_cron still viable upgrade. |

---

## Next Action

Implement "What's New" modal. Plan ready at `.claude/plans/whats-new-modal.md`.  
Start with `data/releases.ts` → `components/ui/WhatsNewModal.tsx` → wire into `App.tsx` → `changelog-updater` agent → `CLAUDE.md` rule.

_Last updated: 2026-05-11_
