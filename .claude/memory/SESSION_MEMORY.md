# SESSION MEMORY — Bolão Copa do Mundo 2026

_Read this first at the start of every session. Update after every significant task._

---

## Project Overview

React SPA for World Cup prediction pools. Users join groups, predict match outcomes, earn points, and compete on leaderboards. Stack: React + TypeScript + Vite + Supabase (PostgreSQL + Auth + Realtime) + Tailwind CSS.

Current branch: `feature/03/claude-code`

---

## Current Architecture

- All runtime state in hooks composed by `contexts/DatabaseContext.tsx`
- `App.tsx` (~20KB) is root orchestrator — consumes context, renders pages
- No direct Supabase calls from components — always through `DatabaseContext`
- Sync runs via `setInterval` inside `useSyncSystem` (only active while admin tab is open — known limitation)
- Football Data API proxied via Vite (`vite.config.ts`) to avoid CORS
- Supabase schema configurable via `VITE_SUPABASE_SCHEMA` env var (use `dev` for development)

Key hooks: `useUserSystem`, `useMatchSystem`, `useGroupSystem`, `useLeaderboard`, `useSyncSystem`, `usePointsProcessor`, `usePasswordRecovery`

---

## Recently Completed

### 2026-05-10 — Sprint 3 (branch: feature/03/claude-code)
- **Test infrastructure**: Vitest + RTL + happy-dom; 33 tests passing (scoring + leaderboard)
- **UI/UX**: code splitting in `vite.config.ts`; empty state in `MatchesPage` with "Entrar em um grupo" button
- **Docs**: `docs/DEPLOY_VERCEL.md` — full Vercel deploy guide
- **Agent**: `.claude/agents/test-runner.md` — sole agent authorized to write/edit tests

### 2026-05-09 — Schema cleanup (branch: feature/02/ai)
- `0003_teams_natural_key.sql` — UNIQUE(code, externalTeamId) on `teams`
- `0004_standings_group_nullable.sql` — `team_standings.group` nullable; PK changed to `(teamId, competitionCode)`
- `data/competitions.ts` — `type: "CUP" | "LEAGUE"` added to `CompetitionOption`
- `services/liveScoreService.ts` — removed hardcoded `"WC"`; `group` now `string | null`
- `hooks/useSyncSystem.ts` — ranking via JSON map, CUP guard removed, dedup by `teamId|competitionCode`
- `components/TournamentStandings.tsx` — removed hardcoded `leagueCodes`; `group = null` renders as "Tabela"

---

## Current Pending Tasks

### IMMEDIATE — "What's New" Modal + changelog-updater agent
Full plan at `C:\Users\migue\.claude\plans\tem-como-fazer-algum-robust-hammock.md`

Files to create/modify:
1. `data/releases.ts` — static releases array with `CURRENT_VERSION`, `version`, `date`, `changes[]`
2. `components/ui/WhatsNewModal.tsx` — modal using existing `ModalShell`; PT-BR content
3. `App.tsx` — `useState(showWhatsNew)` + `useEffect` comparing `bolao_last_seen_version` in localStorage vs `CURRENT_VERSION`
4. `.claude/agents/changelog-updater.md` — agent that bumps version and prepends entry to `data/releases.ts`
5. `CLAUDE.md` — rule: invoke `changelog-updater` after any significant feature (mirrors `test-runner` pattern)

Logic: `localStorage.getItem('bolao_last_seen_version') !== CURRENT_VERSION` → show modal → on close, save version.

### BACKLOG — Run migrations on Supabase
Order:
1. `database/migrations/0001_create_tables.sql`
2. `database/migrations/0002_fix_teams_fks_indexes.sql`
3. `database/migrations/0003_teams_natural_key.sql`
4. `database/migrations/0004_standings_group_nullable.sql`
5. `database/rls/current.sql`
6. `database/seed/system_config.sql`

After migrations: test full sync (WC + BSA) from admin dashboard.

### BACKLOG — Production deploy
Follow `docs/DEPLOY_VERCEL.md` — create `vercel.json` as first step.

---

## Known Issues

| Issue | Status |
|-------|--------|
| Sync only runs while admin tab is open | Known limitation; planned fix: Edge Functions + pg_cron |
| RLS 403 errors (resolved) | Fixed via `supabase_rls_*.sql` migrations |
| Migrations not yet applied to Supabase | Pending manual run in SQL Editor |

---

## Important Files

| File | Purpose |
|------|---------|
| `contexts/DatabaseContext.tsx` | Central state — all hooks composed here |
| `App.tsx` | Root orchestrator; routing and page rendering |
| `hooks/useSyncSystem.ts` | Background sync with Football Data API + Supabase |
| `hooks/usePointsProcessor.ts` | Points calculation from match results |
| `services/supabase.ts` | Supabase client singleton |
| `services/liveScoreService.ts` | Football Data API fetch wrapper |
| `data/competitions.ts` | Competition list with type (CUP/LEAGUE) |
| `components/TournamentStandings.tsx` | Standings display; handles nullable group |
| `database/migrations/` | Supabase schema migrations (0001–0004) |
| `database/rls/current.sql` | Current RLS policies |
| `types.ts` | All shared TypeScript interfaces |
| `constants.ts` | App-wide constants and initial state |

---

## Technical Decisions

| Decision | Reason |
|----------|--------|
| State in hooks, components only render | Clear separation; hooks are independently testable |
| Supabase client singleton | Avoids multiple connections and duplicated state |
| Sync via `setInterval` in admin tab | Temporary; definitivo: Edge Functions + pg_cron |
| RLS group-scoped on all tables | Users only access their own group's data |
| Proxy Vite for Football Data API | Circumvents CORS without exposing key in frontend |
| Google Sign-In via CDN in `index.html` | Simple integration; tradeoff: external dependency in HTML |
| `teams.code` (TLA) not UNIQUE | TLA not globally unique — collisions expected (e.g., "COR" in BSA); real key: `externalTeamId` |
| FK `competitionCode` DEFERRABLE | Sync upserts competition + matches in same flow; DEFERRED avoids FK ordering errors |
| Vitest + happy-dom (not jsdom) | jsdom v27 has ESM-only deps incompatible with Vitest worker pool |
| `test-runner` as dedicated agent | Prevents feature agents from editing tests to force passage |
| Code splitting by library | React, Supabase, Gemini are heavy stable deps — separate chunks improve browser cache |
| Schema `dev` via `VITE_SUPABASE_SCHEMA` | Isolates dev data without a separate Supabase project |

---

## Next Session Starting Point

**Branch:** `feature/03/claude-code`

**First action:** implement the "What's New" modal (plan already approved — see IMMEDIATE task above).

Start with `data/releases.ts`, then `components/ui/WhatsNewModal.tsx`, then wire into `App.tsx`.

_Last updated: 2026-05-11_
