# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

**Current branch:** `feature/03/claude-code`  
**Test suite:** 33 tests passing (Vitest + RTL + happy-dom)

**Feature memories:** `.claude/memory/features/sync-system.md`

---

## Current Pending Tasks

### IMMEDIATE — "What's New" Modal + changelog-updater agent

Full plan at `C:\Users\migue\.claude\plans\tem-como-fazer-algum-robust-hammock.md`

Files to create/modify:
1. `data/releases.ts` — static releases array with `CURRENT_VERSION`, `version`, `date`, `changes[]`
2. `components/ui/WhatsNewModal.tsx` — modal using existing `ModalShell`; PT-BR content
3. `App.tsx` — `useState(showWhatsNew)` + `useEffect` comparing `bolao_last_seen_version` in localStorage vs `CURRENT_VERSION`; on close, save version
4. `.claude/agents/changelog-updater.md` — agent that bumps version and prepends entry to `data/releases.ts`
5. `CLAUDE.md` — rule: invoke `changelog-updater` after any significant feature (mirrors `test-runner` pattern)

Logic: show modal when `localStorage.getItem('bolao_last_seen_version') !== CURRENT_VERSION`.

### BACKLOG — Apply migrations to Supabase

Run in order in SQL Editor:
1. `database/migrations/0001_create_tables.sql`
2. `database/migrations/0002_fix_teams_fks_indexes.sql`
3. `database/migrations/0003_teams_natural_key.sql`
4. `database/migrations/0004_standings_group_nullable.sql`
5. `database/rls/current.sql`
6. `database/seed/system_config.sql`

After migrations: test full WC + BSA sync from admin dashboard. Verify WC groups show "Grupo A/B/..." and BSA shows single "Tabela" block.

### BACKLOG — Production deploy

Follow `docs/DEPLOY_VERCEL.md`. Create `vercel.json` first.

---

## Recently Completed

### 2026-05-11 — Memory system overhaul
- Moved session memory from `docs/SESSION_MEMORY.md` → `.claude/memory/SESSION_MEMORY.md`
- Created `.claude/memory/features/sync-system.md` for sync subsystem detail
- Updated `CLAUDE.md`: fixed directory references, added missing hooks/scripts, separated stable rules from transient state
- Fixed garbled UTF-16 line in `.gitignore`; added `.claude/cache|history|tmp` ignores

### 2026-05-10 — Sprint 3 (feature/03/claude-code)
- Test infrastructure: Vitest + RTL + happy-dom; 33 tests passing
- UI/UX: code splitting in `vite.config.ts`; empty state in `MatchesPage` with "Entrar em um grupo" button
- Docs: `docs/DEPLOY_VERCEL.md`
- Agent: `.claude/agents/test-runner.md`

### 2026-05-09 — Schema cleanup (feature/02/ai)
- Migrations 0003 (teams UNIQUE) and 0004 (standings group nullable)
- `data/competitions.ts`: added `type: "CUP" | "LEAGUE"`
- `useSyncSystem`: dedup by `teamId|competitionCode`, ranking via JSON map
- `TournamentStandings`: removed hardcoded `leagueCodes`; nullable group renders as "Tabela"

---

## Known Issues

| Issue | Status |
|-------|--------|
| Sync only runs while admin tab is open | Known limitation — planned fix: Edge Functions + pg_cron (not started) |
| Migrations not yet applied to Supabase | Pending manual run |

---

## Next Session Starting Point

**Branch:** `feature/03/claude-code`

**First action:** implement the "What's New" modal (plan already approved).  
Start with `data/releases.ts` → `components/ui/WhatsNewModal.tsx` → wire into `App.tsx`.

_Last updated: 2026-05-11_
