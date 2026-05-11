# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run test suite (Vitest)
npm run test:watch # Run tests in watch mode
npm run test:ui    # Open Vitest UI
```

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

## Persistent Session Memory Protocol

Persistent project memory lives in: `.claude/memory/SESSION_MEMORY.md`

This file is the authoritative cross-session project state. Treat stale or missing memory as a project integrity issue.

**At the start of EVERY session:**
1. Read [.claude/memory/SESSION_MEMORY.md](.claude/memory/SESSION_MEMORY.md)
2. Reconstruct: current project state, architecture, pending tasks, known issues, important technical decisions
3. Do this BEFORE planning or editing any files

**Update `.claude/memory/SESSION_MEMORY.md` at these checkpoints:**
- After completing each significant task
- Before starting a complex task (record intent and current state)
- If a critical error occurs, record the broken state before attempting a fix

**Memory file rules — keep it concise and actionable:**
- DO NOT store: full conversations, chain-of-thought reasoning, repetitive logs, temporary debugging notes, large code snippets
- ONLY store: current project status, architecture decisions, important constraints, pending tasks, known issues, relevant modified files, next recommended action
- Before editing: read the entire file, merge and compress, remove obsolete content, rewrite sections cleanly — never blindly append
- Required sections: Project Overview · Current Architecture · Recently Completed · Current Pending Tasks · Known Issues · Important Files · Technical Decisions · Next Session Starting Point

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

### Testing Rules
- The `test-runner` agent (`.claude/agents/test-runner.md`) is the **only** agent authorized to create, edit, or delete test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `src/test/**`).
- Feature agents (`frontend`, `backend`) **must never** touch test files — not even to fix a failing test.
- After implementing a feature, invoke the `test-runner` agent so it can write or update tests.
- If tests fail after a feature is implemented, the `test-runner` reports the failure and the feature agent fixes the implementation — never the other way around.
