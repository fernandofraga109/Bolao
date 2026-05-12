# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run preview    # Preview production build
npm run test       # Run Vitest (single run)
npm run test:watch # Run Vitest in watch mode
npm run test:ui    # Open Vitest UI
npm run lint       # ESLint check
npm run format     # Prettier format
```

## Architecture

**Bolão Copa 2026** is a React SPA for World Cup prediction pools. Users join groups, predict match outcomes, earn points, and compete on leaderboards.

### State Management

All runtime state lives in `contexts/DatabaseContext.tsx`, which composes several custom hooks:

- `useUserSystem` — auth, user profiles, group membership
- `useMatchSystem` — match data, predictions, scoring
- `useGroupSystem` — group creation/joining
- `useLeaderboard` — ranking calculations
- `useSyncSystem` + `useBackgroundSync` — background data sync with Supabase and external APIs
- `usePointsProcessor` — points calculation from match results
- `usePasswordRecovery` — password reset flow

`App.tsx` is the root orchestrator — it consumes `DatabaseContext` and renders pages.

### Data Flow

1. `data/initialData.ts` seeds the in-memory state on startup
2. Supabase fetches hydrate state on auth
3. `useSyncSystem` polls Football Data API and writes results back to Supabase
4. Supabase Realtime pushes updates to connected clients

### External Integrations

- **Supabase** — PostgreSQL + Auth + Realtime. Client in `services/supabase.ts`
- **Football Data API** — match/standings data, proxied via Vite to avoid CORS. See `.claude/memory/features/sync-system.md`
- **Google Gemini** — AI match predictions via `services/geminiService.ts` and `api/gemini-prediction.ts`
- **Google Sign-In** — loaded via CDN in `index.html`

### Key Directories

```
hooks/             — all business logic; one hook per concern
contexts/          — React contexts; DatabaseContext.tsx is the sole runtime state root
components/
  pages/           — full-page views (one per route)
  ui/              — reusable, stateless UI primitives
  (root)           — shared layout components (Header, BottomNav, AdminDashboard, etc.)
services/          — external client setup (supabase.ts, geminiService.ts, liveScoreService.ts)
api/               — thin fetch wrappers (Football Data API, Gemini, Supabase auth)
database/
  migrations/      — numbered Supabase migrations (0001–0004, apply in order)
  rls/             — current RLS policies
  seed/            — seed SQL
  _archive/        — legacy files; do not use
data/              — static tournament data (teams, matches, stadiums, competitions)
utils/             — pure utility functions (scoring logic)
src/test/          — Vitest setup and mocks
types.ts           — all shared TypeScript interfaces
constants.ts       — app-wide constants and initial state
```

### Known Constraints

- **Sync limitation:** `useSyncSystem` uses `setInterval` and only runs while the admin tab is open. Planned fix: Supabase Edge Functions + `pg_cron`. Do not design new features around this — treat it as acknowledged debt.
- **Schema isolation:** Supabase schema is configurable via `VITE_SUPABASE_SCHEMA`. Use `dev` for development to avoid touching prod data.
- **CORS:** Football Data API must be called through the Vite proxy — never directly from the frontend.
- **TLA uniqueness:** `teams.code` (TLA) is not globally unique. Always upsert teams by `externalTeamId`, never by `code`.
- **FK ordering:** `matches.competitionCode` FK is DEFERRABLE — sync upserts competition + matches in the same flow.

## Environment Variables

See `.env.example` for required variables (Supabase URL/key, Football Data API key, Gemini API key).

---

## Persistent Session Memory Protocol

Persistent project memory lives in `.claude/memory/SESSION_MEMORY.md`.

This file is the authoritative cross-session project state. Treat stale or missing memory as a project integrity issue.

**At the start of EVERY session:**
1. Read `.claude/memory/SESSION_MEMORY.md`
2. Reconstruct: current project state, pending tasks, known issues, recent decisions
3. Do this BEFORE planning or editing any files

**Update `.claude/memory/SESSION_MEMORY.md` at these checkpoints:**
- After completing each significant task
- Before starting a complex task (record intent and current state)
- If a critical error occurs, record the broken state before attempting a fix

**Memory file rules — keep it concise and actionable:**
- DO NOT store: full conversations, chain-of-thought reasoning, logs, debugging notes, large code snippets
- ONLY store: project status, architecture decisions, constraints, pending tasks, known issues, next action
- Before editing: read the entire file, merge and compress, remove obsolete content, rewrite cleanly — never append blindly

**Feature memory files** for complex subsystems live in `.claude/memory/features/`:
- `sync-system.md` — Football Data API sync, proxy config, known limitation, migration plan

Only create feature memory files for genuinely complex subsystems. Prefer fewer, high-quality files over fragmentation.

---

## Planning & Execution Workflow

For any sufficiently complex feature, debugging effort, migration, architectural change, or production issue investigation:

### Planning Artifacts

Create structured planning documents inside:

`.claude/plans/`

Examples:
- `production-stabilization-plan.md`
- `registration-debugging.md`
- `sync-system-investigation.md`
- `migration-edge-functions.md`

These are working engineering documents — not append-only logs.

Plans should contain:
- problem summary
- suspected and confirmed root causes
- affected systems/files
- investigation findings
- execution phases
- validation strategy
- rollback/risk notes
- completion tracking
- deferred/follow-up work

Prefer:
- one primary plan per major initiative
- focused investigation files for especially complex subsystems
- progressive refinement over uncontrolled note accumulation

### Plan Lifecycle

Every plan goes through three mandatory phases. Each phase has automatic actions — do not skip them.

#### Phase 1 — Acceptance (user approves the plan)

Trigger: user says "bora", "let's do it", "aceito", "sim", or any clear approval.

Actions (do these before writing any code):
1. Create `.claude/plans/<slug>.md` with the full plan content
2. Add a row to the `Active Plans` table in `SESSION_MEMORY.md`:
   ```
   | **Next** | <short description> | `.claude/plans/<slug>.md` |
   ```
3. Only then begin implementation

Do NOT start implementation if no plan file exists yet.

#### Phase 2 — Implementation

- Edit the plan file in-place as understanding evolves (progressive refinement, not append-only)
- Keep `SESSION_MEMORY.md` "Active Plans" table up to date

#### Phase 3 — Completion (user confirms it's working)

Trigger: user confirms the feature works ("tá bom", "funciona", "show", explicit approval after testing).

Actions (all three are required):
1. **Move plan:** `.claude/plans/<slug>.md` → `.claude/plans/completed/<slug>.md`
   - Update its `_Status_` line to `DONE — YYYY-MM-DD`
2. **Update SESSION_MEMORY.md:**
   - Remove from "Active Plans" table
   - Add a brief "Completed — \<Feature\> (YYYY-MM-DD)" section with bullet summary
   - Update "Next Action"
3. **Invoke `changelog-updater` agent** to bump version and prepend a new entry to `data/releases.ts`

Do NOT mark a plan as complete until the user has explicitly confirmed it works.

---

### Planning Completion Criteria

Planning is NOT considered complete until:

- relevant plan files exist inside `.claude/plans/`
- execution phases are documented
- risks and validation strategy are recorded
- deferred/backlog work is explicitly tracked
- `SESSION_MEMORY.md` reflects the current sprint/focus
- obsolete investigation notes are consolidated or removed

Do NOT treat planning as finished after only generating analysis in-chat.

Persist important operational knowledge into the repository workflow structure.

### Session Memory Coordination

`SESSION_MEMORY.md` remains the authoritative high-level coordination layer.

Use it to track:
- current sprint focus
- active investigations
- recently completed work
- unresolved blockers
- important architectural discoveries
- next recommended action
- references to relevant plan files

Do NOT duplicate entire plans into memory.

Memory should remain:
- concise
- reconstruction-oriented
- curated
- compressed over time

Avoid append-only growth.

### Context Saturation Management

During long sessions:

- actively monitor context fragmentation and saturation
- avoid uncontrolled prompt growth
- periodically consolidate discoveries into plans/memory
- compress obsolete debugging details
- prefer phased execution over massive multi-system changes

If the session becomes too fragmented or context-heavy:
- warn about possible context degradation
- recommend checkpointing
- suggest whether to:
  - continue safely,
  - consolidate memory first,
  - or start a fresh session

Do NOT interrupt unnecessarily after every small change.

Only surface context management concerns when genuinely relevant.

### Execution Discipline

Prefer:
- investigation before implementation
- phased execution
- isolated fixes
- small safe commits
- progressive validation
- explicit root-cause documentation

Avoid:
- mixing unrelated fixes
- massive multi-system edits
- uncontrolled debugging sessions
- blind memory accumulation
- skipping operational documentation

---

## Agent Delegation

Use sub-agents (`.claude/agents/`) when the task is clearly scoped to one layer:

**Delegate to `backend` agent when:**
- Writing or modifying Supabase SQL migrations (`database/migrations/`)
- Changing RLS policies (`database/rls/`) or database schema
- Modifying hooks that interface with Supabase (`hooks/useSyncSystem.ts`, `hooks/usePointsProcessor.ts`, `hooks/useBackgroundSync.ts`, etc.)
- Working on `services/supabase.ts`, `services/liveScoreService.ts`, or `api/` wrappers
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
```

### Coding Conventions

- State lives in hooks; components only render and dispatch
- No direct Supabase calls from components — always go through `DatabaseContext`
- All shared types go in `types.ts`; no inline interface declarations in components
- Prefer updating an existing hook over creating a new one for closely related logic

### Testing Rules

- The `test-runner` agent (`.claude/agents/test-runner.md`) is the **only** agent authorized to create, edit, or delete test files (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `src/test/**`)
- Feature agents (`frontend`, `backend`) must never touch test files — not even to fix a failing test
- After implementing a feature, invoke the `test-runner` agent to write or update tests
- If tests fail after a feature is implemented, the `test-runner` reports the failure and the feature agent fixes the implementation — never the other way around

### Changelog Rules

- After any significant feature merge, invoke the `changelog-updater` agent (`.claude/agents/changelog-updater.md`) to bump `CURRENT_VERSION` and prepend a new entry to `RELEASES` in `data/releases.ts`
- The `changelog-updater` agent is the **only** agent authorized to edit `data/releases.ts`
- `CURRENT_VERSION` in `data/releases.ts` is the single source of truth for the "What's New" modal
