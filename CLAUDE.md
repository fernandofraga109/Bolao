# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run preview  # Preview production build
```

No test suite is configured.

## Architecture

**Bolão Copa 2026** is a React SPA for World Cup prediction pools. Users join groups, predict match outcomes, earn points, and compete on leaderboards.

### State Management

All runtime state lives in `contexts/DatabaseContext.tsx`, which composes several custom hooks:

- `useUserSystem` — auth, user profiles, group membership
- `useMatchSystem` — match data, predictions, scoring
- `useGroupSystem` — group creation/joining
- `useLeaderboard` — ranking calculations
- `useSyncSystem` — background data sync with Supabase and external APIs
- `usePointsProcessor` — points calculation from match results
- `usePasswordRecovery` — password reset flow

`App.tsx` is the root orchestrator (~20KB) — it consumes `DatabaseContext` and renders pages.

### Data Flow

1. `data/initialData.ts` seeds the in-memory state on startup
2. Supabase fetches hydrate state on auth
3. `useSyncSystem` polls external APIs (Football Data API) and writes results back to Supabase
4. Supabase Realtime pushes updates to connected clients

### External Integrations

- **Supabase** — PostgreSQL + Auth + Realtime. Client in `services/supabase.ts`
- **Football Data API** — match/standings data, proxied via Vite (`vite.config.ts`) to avoid CORS
- **Google Gemini** — AI match predictions via `services/geminiService.ts` and `api/gemini-prediction.ts`
- **Google Sign-In** — loaded via CDN in `index.html`

### Key Directories

- `components/pages/` — full-page views (Matches, Leaderboard, Stats, Tournament, Admin)
- `components/ui/` — reusable UI components
- `hooks/` — all business logic; hooks are the main unit of functionality
- `api/` — thin wrappers around Football Data API and Gemini
- `database/sql/` — Supabase migrations and RLS policies (25+ files)
- `data/` — static tournament data (teams, matches, stadiums)
- `types.ts` — all shared TypeScript interfaces
- `constants.ts` — app-wide constants and initial state values

### Known Limitation

Auto-sync runs inside `useSyncSystem` via `setInterval` — it only executes while the admin dashboard tab is open. The planned fix is to migrate sync to Supabase Edge Functions + `pg_cron`.

## Environment Variables

See `.env.example` for required variables (Supabase URL/key, Football Data API key, Gemini API key).

---

## Session Protocol

**At the start of every new session:** read [docs/SESSION_MEMORY.md](docs/SESSION_MEMORY.md) before anything else. It contains the current state of the project, last task executed, next step, and key technical decisions.

**Update [docs/SESSION_MEMORY.md](docs/SESSION_MEMORY.md) at these checkpoints:**
- After completing each significant task
- Before starting a complex task (record intent and current state)
- If a critical error occurs, record the broken state before attempting a fix

---

## Agent Delegation

Use sub-agents (`.claude/agents/`) when the task is clearly scoped to one layer:

**Delegate to `backend` agent when:**
- Writing or modifying Supabase SQL migrations (`database/sql/`)
- Changing RLS policies or database schema
- Modifying hooks that interface directly with Supabase (`hooks/useSyncSystem.ts`, `hooks/usePointsProcessor.ts`, etc.)
- Working on `services/supabase.ts` or `api/` wrappers
- Debugging data sync, auth flows, or scoring logic

**Delegate to `frontend` agent when:**
- Building or modifying React components (`components/`)
- Changing page layout, routing, or navigation (`components/pages/`, `components/BottomNav.tsx`)
- Working on UI state, modals, toasts, or visual feedback
- Adjusting Tailwind styles or responsive behavior

**Handle in the main session when:**
- The task spans both layers (e.g., adding a new feature end-to-end)
- Coordinating state between `DatabaseContext.tsx` and a component
- Updating `types.ts` or `constants.ts` that both layers depend on

---

## Project Conventions

### Commit Pattern
```
type(scope): short description

Types: feat, fix, refactor, chore, docs
Scopes: auth, sync, matches, leaderboard, admin, ui, db, hooks
Examples:
  feat(sync): migrate background sync to edge functions
  fix(leaderboard): correct points tiebreaker order
  chore(db): add RLS policy for group-scoped predictions
```

### Folder Structure
```
hooks/          — all business logic; one hook per concern
components/
  pages/        — full-page views (one per route)
  ui/           — reusable, stateless UI primitives
database/sql/   — Supabase migrations (numbered or descriptive)
services/       — external client setup (supabase.ts, geminiService.ts)
api/            — thin fetch wrappers (Football Data API, Gemini)
data/           — static seed data (teams, matches, stadiums)
types.ts        — all shared TypeScript interfaces
constants.ts    — app-wide constants and initial state
```

### Coding Conventions
- State lives in hooks; components only render and dispatch
- No direct Supabase calls from components — always go through `DatabaseContext`
- All shared types go in `types.ts`; no inline interface declarations in components
- Prefer updating an existing hook over creating a new one for closely related logic
