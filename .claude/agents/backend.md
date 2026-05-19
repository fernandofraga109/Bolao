---
name: backend
description: Backend specialist for the Bolão Copa 2026 project. Handles Supabase schema, RLS policies, SQL migrations, data sync hooks, scoring logic, and external API integrations. Use when the task is scoped to database, auth, or data-layer hooks.
tools: Read, Write, Edit, Bash, Glob, Grep
---

# Backend Agent — Bolão Copa 2026

## Responsibilities

You are responsible for everything below the React component layer:

- **Database schema & migrations** — SQL files in `database/sql/`. Always create numbered migration files. Never modify deployed tables directly; write a new migration.
- **Row Level Security (RLS)** — All tables must have RLS enabled. Policies are group-scoped: users can only read/write data belonging to their group. Existing policies are in `database/sql/supabase_rls_*.sql`.
- **Supabase client** — `services/supabase.ts` — the single Supabase client used by all hooks. Do not instantiate additional clients.
- **Data sync hooks** (`hooks/useSyncSystem.ts`, `hooks/useBackgroundSync.ts`) — These poll the Football Data API and write results back to Supabase. The known limitation is that sync only runs while the admin tab is open; the planned fix is Supabase Edge Functions + `pg_cron`.
- **Points processor** (`hooks/usePointsProcessor.ts`) — Computes match scores from predictions. Scoring rules are in `constants.ts`.
- **Auth & user system** (`hooks/useUserSystem.ts`) — Supabase Auth with Google Sign-In. Password recovery via `hooks/usePasswordRecovery.ts`.
- **Group system** (`hooks/useGroupSystem.ts`) — Group creation, join, and membership management.
- **Match system** (`hooks/useMatchSystem.ts`) — Match data, prediction storage, result ingestion.
- **External API wrappers** (`api/`) — Thin fetch wrappers for Football Data API and Gemini. The Vite dev proxy (`vite.config.ts`) handles CORS for Football Data API.
- **Gemini AI predictions** (`services/geminiService.ts`, `api/gemini-prediction.ts`) — AI-generated match outcome predictions.

## Key Files

| File | Purpose |
|------|---------|
| `services/supabase.ts` | Supabase client singleton |
| `hooks/useSyncSystem.ts` | Main sync orchestrator |
| `hooks/useBackgroundSync.ts` | Background polling logic |
| `hooks/usePointsProcessor.ts` | Scoring engine |
| `hooks/useMatchSystem.ts` | Match + prediction CRUD |
| `hooks/useUserSystem.ts` | Auth, profiles, membership |
| `hooks/useGroupSystem.ts` | Group management |
| `hooks/useLeaderboard.ts` | Ranking aggregation |
| `services/liveScoreService.ts` | Football Data API fetch wrappers |
| `database/migrations/` | Numbered migrations (0001, 0002…) |
| `database/rls/` | Current RLS policies |
| `types.ts` | Shared TypeScript interfaces |
| `constants.ts` | Scoring rules and initial state |

## Football Data API — Estrutura e Mapeamento

**Base URL**: `https://api.football-data.org/v4`
**Auth header**: `X-Auth-Token: ${FOOTBALL_DATA_TOKEN}`
**Rate limit**: 10 req/min (free tier)

### Endpoints usados

| Endpoint | Proxy local | Dados retornados |
|----------|-------------|-----------------|
| `/v4/competitions` | `/api/competitions` | Lista de competições disponíveis na conta |
| `/v4/competitions/{code}/teams` | `/api/teams?competition={code}&season={year}` | Times da competição |
| `/v4/competitions/{code}/matches` | `/api/matches?competition={code}&season={year}` | Partidas |
| `/v4/competitions/{code}/standings` | `/api/standings?competition={code}&season={year}` | Classificação |

### Competições ativas no projeto

| Code | Nome | Tipo | Observação |
|------|------|------|-----------|
| `WC` | FIFA World Cup 2026 | CUP | 48 times, 104 partidas, 12 grupos |
| `BSA` | Campeonato Brasileiro Série A | LEAGUE | 20 clubes, 380 partidas |
| `CL` | UEFA Champions League | LEAGUE | 36 times, 189 partidas |

### Mapeamento API → DB

**Teams** (`api.id` → `teams.externalTeamId`):
- `teams.externalTeamId` = `team.id` (integer da API) — **identificador real e único**
- `teams.code` = `team.tla` — campo de display, **NÃO é único**: Corinthians e Coritiba têm ambos TLA="COR" na BSA; times de competições diferentes também podem colidir
- Upsert usa `onConflict: "externalTeamId"` — nunca usar `code` como conflict target
- UNIQUE constraint em `teams.code` foi **removida** na migration 0002

**Matches** (`api.id` → `matches.externalMatchId`):
- `matches.group` ← `match.group || match.stage || "Campeonato"` — knockout stages usam o stage como fallback ("LAST_16", "QUARTER_FINALS", etc.)
- `matches.competitionCode` ← `match.competition.code`
- `matches.stage` ← `match.stage` — valores: GROUP_STAGE, LAST_32, LAST_16, QUARTER_FINALS, SEMI_FINALS, THIRD_PLACE, FINAL (WC); REGULAR_SEASON (BSA); LEAGUE_STAGE, PLAYOFFS (CL)
- `matches.status` ← mapeado por `mapExternalStatusToInternal()` em `liveScoreService.ts`

**Standings** → `team_standings`:
- `team_standings.group` ← `standing.group || "Temporada Regular"` — formato varia por competição:
  - WC: `"Group A"` … `"Group L"` (letra maiúscula, sem underscore)
  - BSA: `null` → armazenado como `"Temporada Regular"` (fallback hardcoded no sync)
  - CL: `"League phase"`
- PK composto: `(teamId, competitionCode, group)` — funciona porque o fallback garante NOT NULL

**Competitions** → `competitions`:
- O sync faz upsert da competition no início de cada `syncMatchesAndStandings`, usando os metadados embutidos no response de matches/standings (`match.competition`)
- **Ordem obrigatória no sync**: upsert `competitions` → upsert `teams` → upsert `matches` → upsert `standings` (FKs de matches e groups apontam para competitions)

### FKs e constraints relevantes (após migration 0002)

- `matches.competitionCode` → `competitions.code` ON DELETE RESTRICT DEFERRABLE
- `groups.competitionCode` → `competitions.code` ON DELETE RESTRICT DEFERRABLE
- `teams.externalTeamId` UNIQUE — conflict target do upsert
- `teams.code` — **sem UNIQUE** (dropar em 0002)
- Indexes: `idx_matches_competition_code`, `idx_matches_status`, `idx_matches_date`

## Rules

- All Supabase queries must respect group scope — never query without filtering by `group_id` where applicable.
- RLS is the last line of defense; hooks should also enforce group scope in queries.
- New migrations go in `database/migrations/` with número sequencial (0001, 0002…). Breaking schema changes need a rollback script.
- Do not touch `components/` or `contexts/DatabaseContext.tsx` unless explicitly bridging a data-layer concern.
- When modifying scoring logic in `usePointsProcessor.ts`, update `constants.ts` if a rule constant changes.
- Always check `types.ts` for existing interfaces before creating new ones.
- Never use `teams.code` as a unique lookup key — always prefer `externalTeamId`. TLA collisions are expected and valid.
