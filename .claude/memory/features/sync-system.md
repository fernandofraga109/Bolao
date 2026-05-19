# Sync System — Feature Memory

_Complex subsystem: Football Data API integration, Supabase writes, known limitation, planned migration._

---

## Architecture

Two hooks compose the sync layer:

- **`hooks/useSyncSystem.ts`** — orchestrates full sync: competitions → matches → standings → team rankings. Called from AdminDashboard. Holds the `setInterval` loop.
- **`hooks/useBackgroundSync.ts`** — lighter background sync variant.

External data flows through:
- `services/liveScoreService.ts` — fetch wrapper for Football Data API
- `api/matches.ts`, `api/standings.ts`, `api/competitions.ts` — thin endpoint wrappers
- `api/sync-team-rankings.ts` — fetches `data/team-ranking.json` and maps to DB

---

## Vite Proxy Configuration

All Football Data API calls must go through the Vite proxy (configured in `vite.config.ts`). Three proxies are defined:

| Vite path | Target |
|-----------|--------|
| `/api/matches` | `https://api.football-data.org` |
| `/api/standings` | `https://api.football-data.org` |
| `/api/competitions` | `https://api.football-data.org` |

The proxy injects the `X-Auth-Token` header and rewrites path parameters (competition code, season). Never call Football Data API directly from frontend code — CORS will block it.

---

## Sync Logic Details

### Standings dedup
- Dedup key: `teamId|competitionCode` (not including `group` — changed in migration 0004)
- `onConflict: "teamId, competitionCode"`
- `group` is nullable: WC → `"Group A"` etc., BSA → `null` (renders as "Tabela" in UI)

### Team rankings
- Fetched via `getWcRankingMap()` before the team loop (Phase 1.5a)
- Stored in `data/team-ranking.json`
- Fallback rank: `rankingMap[teamCode.toUpperCase()] ?? 999`

### Competition types
- `data/competitions.ts` has `type: "CUP" | "LEAGUE"` on each entry
- Used in `TournamentStandings.tsx` to decide whether to show group tabs or a single "Tabela"

---

## Sync Trigger Model

Sync is **user-triggered**: any user can request a sync from the UI. The original `setInterval` approach (admin-tab-only) was replaced with on-demand sync calls.

**Status:** Mitigated. Real-time freshness (e.g. live scores auto-updating) is still not guaranteed without user action.

**Future upgrade path:** Supabase Edge Functions + `pg_cron` for fully server-side, tab-independent sync. Not started — consider if stale data becomes a user complaint.

Do not design features that assume continuous background sync — it does not exist yet.

---

## Migrations Applied (all applied to Supabase as of 2026-05-11)

| Migration | Effect |
|-----------|--------|
| `0001_create_tables.sql` | Base schema |
| `0002_fix_teams_fks_indexes.sql` | FK fixes and indexes |
| `0003_teams_natural_key.sql` | UNIQUE(code, externalTeamId) on `teams` |
| `0004_standings_group_nullable.sql` | `team_standings.group` nullable; PK = `(teamId, competitionCode)` |
| `database/rls/current.sql` | RLS policies |
| `database/seed/system_config.sql` | System config seed |

---

## Key Files

| File | Role |
|------|------|
| `hooks/useSyncSystem.ts` | Main sync orchestrator |
| `hooks/useBackgroundSync.ts` | Background sync variant |
| `services/liveScoreService.ts` | Football Data API fetch wrapper |
| `api/matches.ts` | Match endpoint wrapper |
| `api/standings.ts` | Standings endpoint wrapper |
| `api/sync-team-rankings.ts` | Rankings sync |
| `data/competitions.ts` | Competition list with CUP/LEAGUE type |
| `data/team-ranking.json` | Static FIFA/world ranking data |
| `components/TournamentStandings.tsx` | Standings UI; handles nullable group |
| `vite.config.ts` | Proxy config for Football Data API |

_Last updated: 2026-05-11_
