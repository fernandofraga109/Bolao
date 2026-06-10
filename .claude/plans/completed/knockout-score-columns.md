# Plan: Knockout Score Flat Columns + Full Display

_Status_: DONE — 2026-06-09

---

## Problem Summary

The app currently stores knockout match scores (regular time, extra time, penalties) exclusively in the `score` JSONB column on `v2_matches`. This has two consequences:

1. All display code does `match.score?.duration`, `match.score?.regularTime.home`, etc. — fragile, unchecked JSON navigation.
2. Several screens (UserAuditModal/rank, StatsPage prediction cards, TournamentStandings/tabela knockout cards) don't show extra time or penalty results at all — only the final aggregated score.
3. The admin has no way to manually override extra time or penalty scores on a finished knockout match.

---

## Goal

- Add flat columns `regularHome`, `regularAway`, `extraTimeHome`, `extraTimeAway` to `v2_matches`.
- Keep existing `penaltiesHome`, `penaltiesAway` flat columns (already in migration 0017).
- Retire all `match.score?.…` usages in R1 scoring, MatchCard, and display logic in favor of flat columns.
- Expose an admin modal for editing extra time and penalty results on knockout matches.
- Show extra time + penalty info in: UserAuditModal (rank), StatsPage (prediction cards), TournamentStandings (tabela knockout cards).

---

## Duration / Winner Inference (no extra column needed)

| Flat column state | Inferred duration | Inferred winner |
|---|---|---|
| `extraTimeHome == null` | REGULAR | N/A |
| `extraTimeHome != null && penaltiesHome == null` | EXTRA_TIME | compare regularHome vs regularAway after 90+ET |
| `penaltiesHome != null` | PENALTY_SHOOTOUT | `penaltiesHome > penaltiesAway` → HOME_TEAM |

This eliminates `score.duration` and `score.winner` lookups entirely.

---

## Affected Files (scoped)

| File | Change |
|---|---|
| `database/migrations/0027_add_regular_extratime_cols.sql` | new migration |
| `types.ts` | `MatchDB` + `Match` interfaces |
| `utils/scoring.ts` | `getR1MatchScoringResult` — use flat cols |
| `hooks/useSyncSystem.ts` | populate flat cols on sync |
| `components/MatchCard.tsx` | use flat cols, remove `score?.` reads |
| `components/AdminDashboard.tsx` | new KnockoutEditModal |
| `components/UserAuditModal.tsx` | show ET + penalties in audit row |
| `components/pages/StatsPage.tsx` | show ET + penalties in PredictionCard |
| `components/TournamentStandings.tsx` | show ET + penalties in knockout match row |
| `docs/features/scoring.md` (if exists) | update |
| `.claude/memory/SESSION_MEMORY.md` | update on completion |

---

## Phases

---

### Phase 1 — Database Migration ✅ DONE

**Goal:** Add the four flat columns to `v2_matches` (and `matches` for safety).

**Migration file:** `database/migrations/0027_add_regular_extratime_cols.sql`

```sql
ALTER TABLE v2_matches
  ADD COLUMN IF NOT EXISTS "regularHome"   integer,
  ADD COLUMN IF NOT EXISTS "regularAway"   integer,
  ADD COLUMN IF NOT EXISTS "extraTimeHome" integer,
  ADD COLUMN IF NOT EXISTS "extraTimeAway" integer;

ALTER TABLE IF EXISTS matches
  ADD COLUMN IF NOT EXISTS "regularHome"   integer,
  ADD COLUMN IF NOT EXISTS "regularAway"   integer,
  ADD COLUMN IF NOT EXISTS "extraTimeHome" integer,
  ADD COLUMN IF NOT EXISTS "extraTimeAway" integer;
```

**Validation:**
- Run migration on Supabase dev.
- `SELECT regularHome, regularAway, extraTimeHome, extraTimeAway FROM v2_matches LIMIT 5;` returns without error.
- Existing rows have NULLs (expected).

**Backfill note:** The sync system (Phase 2) will populate values on the next sync run. No SQL backfill needed since the API is live and future syncs will fill them. If needed, admin can trigger a manual sync.

---

### Phase 2 — Sync System: Populate Flat Columns ✅ DONE

**Goal:** When `useSyncSystem` upserts a match from the Football Data API response, write the four new columns from `score.regularTime`, `score.extraTime`, and `score.penalties`.

**File:** `hooks/useSyncSystem.ts`

**Logic (inside the match upsert payload builder):**
```ts
regularHome:   score?.regularTime?.home ?? null,
regularAway:   score?.regularTime?.away ?? null,
extraTimeHome: score?.extraTime?.home   ?? null,
extraTimeAway: score?.extraTime?.away   ?? null,
// penaltiesHome/Away already handled
```

Keep the `score` JSONB write in place for now (remove in Phase 4 cleanup if desired — not required for correctness).

**Validation:**
- Trigger a manual sync from admin.
- Query: `SELECT id, "regularHome", "extraTimeHome", "penaltiesHome" FROM v2_matches WHERE "penaltiesHome" IS NOT NULL;`
- Should return finished penalty-shootout matches with all columns populated.

---

### Phase 3 — Types + Scoring Utils ✅ DONE

**Goal:** Surface flat columns in TypeScript types and update R1 scoring to use them.

#### 3a — `types.ts`

Add to `MatchDB`:
```ts
regularHome?:   number;
regularAway?:   number;
extraTimeHome?: number;
extraTimeAway?: number;
```

Add to `Match` (the hydrated type):
```ts
regularHome?:   number;
regularAway?:   number;
extraTimeHome?: number;
extraTimeAway?: number;
```

#### 3b — `utils/scoring.ts` — `getR1MatchScoringResult`

Current: reads `score?.regularTime.home / away` from the JSONB payload.  
New: use `match.regularHome / regularAway` flat cols when present; fall back to `score?.regularTime` for backward compatibility during transition.

```ts
export function getR1MatchScoringResult(
  match: Pick<Match, 'regularHome' | 'regularAway' | 'score' | 'result'>,
  fallbackHome: number,
  fallbackAway: number,
): { home: number; away: number } {
  if (match.regularHome != null && match.regularAway != null) {
    return { home: match.regularHome, away: match.regularAway };
  }
  // backward compat: JSONB
  const rt = match.score?.regularTime;
  if (rt) return { home: rt.home, away: rt.away };
  return { home: fallbackHome, away: fallbackAway };
}
```

Update all call-sites in `useLeaderboard.ts`, `usePointsProcessor.ts`, `UserAuditModal.tsx` to pass the match object (they already pass `(match as any).score`, so this is a drop-in refactor).

#### 3c — Add duration/winner inference helpers

> **Design note — two concerns:**
>
> 1. **Who advances in a knockout tiebreaker** (`getKnockoutAdvancingTeamId`) — used for the `whoClassifiesTeamId` bonus in R1. Returns the advancing team for BOTH EXTRA_TIME and PENALTY_SHOOTOUT, because a user who predicted "home team advances" should earn +3 regardless of whether the home team scored in ET or won on penalties. Returns `undefined` for REGULAR duration (no tiebreaker occurred, match was decided in 90 min — no "who classifies" question was ever meaningful).
>
> 2. **Display winner label** — for any finished match, compare `match.result.home > match.result.away` directly in display code. No helper needed.
>
> **R1 scoring rule (corrected):** `whoClassifiesTeamId` bonus is awarded when `duration IN ('EXTRA_TIME', 'PENALTY_SHOOTOUT')` AND the user's pick matches the advancing team. Previously only checked for PENALTY_SHOOTOUT — this was a gap.
>
> Example:
> - regularTime 1×1, extraTime 1×0 → `result = { home: 2, away: 1 }`, duration = EXTRA_TIME → `getKnockoutAdvancingTeamId` returns `homeTeam.id` ✓
> - regularTime 1×1, penalties 4×3 → duration = PENALTY_SHOOTOUT → returns `homeTeam.id` ✓
> - regularTime 2×1, no ET → duration = REGULAR → returns `undefined` (no "classifies" bonus applicable) ✓

```ts
export function getMatchDuration(
  match: Pick<Match, 'extraTimeHome' | 'penaltiesHome' | 'score'>
): 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' {
  if (match.penaltiesHome != null) return 'PENALTY_SHOOTOUT';
  if (match.extraTimeHome != null) return 'EXTRA_TIME';
  return match.score?.duration ?? 'REGULAR'; // backward compat
}

// Returns the team id that advanced through the knockout tiebreaker.
// Works for both EXTRA_TIME (winner from result) and PENALTY_SHOOTOUT (winner from penalties).
// Returns undefined for REGULAR matches — no tiebreaker, no "classifies" bonus applicable.
export function getKnockoutAdvancingTeamId(
  match: Pick<Match, 'extraTimeHome' | 'penaltiesHome' | 'penaltiesAway' | 'result' | 'homeTeam' | 'awayTeam' | 'score'>
): string | undefined {
  const duration = getMatchDuration(match);

  if (duration === 'PENALTY_SHOOTOUT') {
    if (match.penaltiesHome != null && match.penaltiesAway != null) {
      return match.penaltiesHome > match.penaltiesAway ? match.homeTeam.id : match.awayTeam.id;
    }
    // backward compat: flat cols not yet populated
    return match.score?.winner === 'HOME_TEAM' ? match.homeTeam.id : match.awayTeam.id;
  }

  if (duration === 'EXTRA_TIME') {
    // result is cumulative (regularTime + extraTime), so comparing it gives the ET winner
    if (match.result) {
      return match.result.home > match.result.away ? match.homeTeam.id : match.awayTeam.id;
    }
  }

  return undefined;
}
```

**Replace all existing `match.score?.duration` and `match.score?.winner` reads** across:
- `components/MatchCard.tsx` — use `getMatchDuration` + `getKnockoutAdvancingTeamId`
- `components/UserAuditModal.tsx`
- `hooks/useLeaderboard.ts`
- `hooks/usePointsProcessor.ts`

**Scoring call-sites:** replace `const realWhoClassifiesId = isShootout ? ... : undefined` with `const realWhoClassifiesId = getKnockoutAdvancingTeamId(match)` — the `undefined` for REGULAR is preserved, and ET now correctly returns a winner.

**In phases 6/7/8 (display):** to label the match winner for any duration, compare `match.result.home > match.result.away` directly.

**Validation:** `tsc --noEmit` clean. Verify in tests that a user predicting 1-1 + correct advancing team on an ET match now earns the +3 bonus.

---

### Phase 4 — MatchCard.tsx: Use Flat Columns ⬅️ START HERE (next session)

**Goal:** Replace all `match.score?.…` reads in MatchCard with flat columns + helpers from Phase 3. No visual change — this is an internal refactor.

Specific replacements:
- `match.score?.duration === "EXTRA_TIME" || ...` → `getMatchDuration(match) !== 'REGULAR'`
- `match.score?.duration === "PENALTY_SHOOTOUT"` → `getMatchDuration(match) === 'PENALTY_SHOOTOUT'`
- `match.score?.winner === "HOME_TEAM" ? match.homeTeam?.id : match.awayTeam?.id` → `getKnockoutAdvancingTeamId(match)`
- `match.result` (full time) in "Após Prorrogação" block → use `match.extraTimeHome != null ? { home: match.extraTimeHome + (match.regularHome ?? 0), ... }` — actually the current display shows `match.result` (full aggregated) for this block, which is correct (final after ET). Keep that.
- `displayResult` memo for R1 → call `getR1MatchScoringResult(match, match.result.home, match.result.away)`

**Validation:**
- Existing knockout matches still show correct score blocks (regular / ET / penalties).
- No visual regression.

---

### Phase 5 — AdminMatchCard: Inline Score Editing on Jogos Screen ✅ DONE

**Status:** REVISED (replaces original modal approach + absorbs 5.a concern)

**Motivation for revision:** The original Phase 5 added a "Placar Mata-Mata" panel to `AdminDashboard` requiring the admin to navigate away from Jogos to edit scores. Keeping score editing in the Jogos screen (where the admin is already looking at the match) is far more ergonomic. A dedicated `AdminMatchCard` also avoids polluting the regular `MatchCard` with admin-only complexity.

#### What gets deleted (already shipped in prior commit)
- `components/AdminKnockoutScoreModal.tsx` — delete
- "Placar Mata-Mata" panel in `AdminDashboard.tsx` + related state (`knockoutEditMatch`) — remove
- `getMatchPhase` import added to `AdminDashboard.tsx` — remove if unused elsewhere

#### New file: `components/AdminMatchCard.tsx`

Used in `MatchesPage` instead of `MatchCard` when `isAdmin === true`. Calls `useDatabase()` directly — no prop-drilling of save callbacks (avoids extending `onAdminSaveMatch` signature).

**Sections (always visible):**

```
┌─────────────────────────────────────────────────┐
│  DATE · TIME · STATUS BADGE                     │
│                                                 │
│  [Flag] TEAM A  [inputs: result H × A]  [Flag]  │
│                                                 │
│  ── Placar de Tempo Regular (R1) ──             │  ← only for FINISHED knockout
│    regularHome × regularAway                    │
│                                                 │
│  ── Prorrogação ──  [Limpar]                    │  ← only for FINISHED knockout
│    extraTimeHome × extraTimeAway (optional)     │
│                                                 │
│  ── Pênaltis ──  [Limpar]                       │  ← only for FINISHED knockout
│    penaltiesHome × penaltiesAway (optional)     │
│                                                 │
│  Resultado Final (R2): X × Y  ← live preview   │  ← derived, read-only
│                                                 │
│  STATUS [select]         [SALVAR EDIÇÃO]        │
│  [Bloquear Sync]                                │
└─────────────────────────────────────────────────┘
```

**Score sections visibility rule:**
- "Resultado" inputs (top, existing admin flow): always shown — saves `resultHome/resultAway`
- Flat score section (regularTime + ET + penalties): shown when `(isFinished || isLive) && isKnockout`
  - `isKnockout = getMatchPhase(match.stage, match.group) !== 'groups'`
  - Rationale: if the external API stops sending score breakdown during a live knockout match (regularTime / extraTime split), the admin can patch values in real time without waiting for FINISHED status

**Save logic (single button, single `updateMatch` call):**

```ts
// Always saved
resultHome: parseInt(resultHomeInput)
resultAway: parseInt(resultAwayInput)
status: adminStatus  // via existing onAdminSaveMatch or direct db call

// Only when isFinished && isKnockout
regularHome: numOrNull(regularHomeInput)    // mandatory for knockout
regularAway: numOrNull(regularAwayInput)
extraTimeHome: hasET ? numOrNull(extraHomeInput) : null
extraTimeAway: hasET ? numOrNull(extraAwayInput) : null
penaltiesHome: hasPen ? numOrNull(penHomeInput) : null
penaltiesAway: hasPen ? numOrNull(penAwayInput) : null

// 5.a fix — derived, keeps R2 correct
// result = regular + ET delta (penalties don't add to result)
resultHome = regularHome + (extraTimeHome ?? 0)   // when hasET
resultHome = regularHome                           // when !hasET
```

> **5.a baked in:** `resultHome/resultAway` are always derived from `regularHome + extraTimeHome` and included in the save payload. No separate fix needed.

**"Resultado Final (R2)" live preview** (read-only, updates as admin types):
```
Tempo Regular: 1 × 1
+ Prorrogação: 1 × 0
─────────────────────
Resultado Final: 2 × 1
```
Only shown when isFinished && isKnockout && regularHome input is non-empty.

**After save:** `db.refetchMatches()` to force local re-hydration.

#### Changes to `MatchesPage.tsx`

- Import `AdminMatchCard`
- When `isAdmin === true`, render `<AdminMatchCard>` instead of `<MatchCard isAdmin={true}>`
- `MatchCard` no longer receives `isAdmin` from MatchesPage (admin path fully separated)

#### Changes to `MatchCard.tsx`

- Remove `isAdmin`, `onAdminSaveMatch`, `onAdminToggleSyncLock` props entirely — now dead code since admin gets its own card
- Remove the admin footer section (status selector + salvar edição + sync lock)
- `MatchCardProps` interface simplified

> **Risk:** existing tests or call-sites that pass `isAdmin` to `MatchCard` need updating. Grep for `isAdmin` before deleting.

**Validation:**
- Admin on Jogos tab, opens a FINISHED knockout match → sees regularTime + ET + penalties inputs below the main score
- Admin fills in ET (1×0) with regular (1×1) → preview shows "Resultado Final: 2×1" → saves → MatchCard immediately reflects ET block
- Admin clears ET → preview shows "Resultado Final: 1×1" → saves → ET block disappears
- R1 scoring uses regularHome (1×1) ✓, R2 scoring uses resultHome (2×1) ✓
- Group-stage FINISHED matches: no flat score section shown (only result inputs + status)
- LIVE knockout matches: flat score section shown (API fallback for missing score breakdown)
- SCHEDULED knockout matches: no flat score section (match hasn't started)

---

### Phase 6 — UserAuditModal: Show ET + Penalties ✅ DONE

**Goal:** In the rank screen's audit view, each match row should show extra time result and penalties when applicable, mirroring the MatchCard display.

**File:** `components/UserAuditModal.tsx`

**Where to add:** Below the existing match result display in each audit row.

**What to show (same logic as MatchCard):
- If `getMatchDuration(match) !== 'REGULAR'`: show "Após Prorrogação: X × Y" (using `match.result`, the full aggregated score)
- If `getMatchDuration(match) === 'PENALTY_SHOOTOUT'`: show "Pênaltis: X × Y"

**Note:** R1 scoring in the audit already uses `getR1MatchScoringResult` (Phase 3), so the points are correct. The ET/penalties display here is purely informational.

**Validation:**
- A R1 group with a finished penalty-shootout match shows both the regular time score (the scored prediction) and the penalty result in the audit.

---

### Phase 7 — StatsPage: PredictionCard ET + Penalties ✅ DONE

**Goal:** The `PredictionCard` component inside `StatsPage.tsx` shows the match result vs user prediction. Add ET and penalties info when applicable.

**File:** `components/pages/StatsPage.tsx`

**Current state:** The "Scores area" block shows `match.result.home × match.result.away` and the user's prediction. No ET or penalties.

**What to add:**
- Below the "resultado" label, if `getMatchDuration(match) !== 'REGULAR'`, add a small "Prorrog." and/or "Pênaltis" sub-row in the same compact style.

**Validation:**
- A finished knockout match card in StatsPage shows ET/penalties sub-row.

---

### Phase 8 — TournamentStandings (Tabela): Knockout Match Row ✅ DONE

**Goal:** In the Tabela screen's knockout view, each match row shows `match.result.home × match.result.away`. For knockouts that went to ET or penalties, add an indicator below the score.

**File:** `components/TournamentStandings.tsx`

**Where:** Around line 762–771 where `match.result?.home` and `match.result?.away` are displayed.

**What to add:**
- Same compact ET/penalties block as MatchCard (reuse styling).
- "Prorr." badge if extraTimeHome != null.
- "Pên. X×Y" if penaltiesHome != null.

**Validation:**
- Knockout matches in the Tabela view show the score with ET/penalties annotation when applicable.

---

### Phase 9 — Documentation Update ✅ DONE

**Files to update:**
- `docs/database/schema.md` (if exists) — add new columns to `v2_matches` section.
- `docs/features/scoring.md` (if exists) — note that R1 uses `regularHome/Away` flat cols, not JSONB.
- `.claude/memory/SESSION_MEMORY.md` — move plan to completed, add brief summary.

---

## Risk Notes

| Risk | Mitigation |
|---|---|
| Existing finished matches have `regularHome = null` until next sync | `getR1MatchScoringResult` falls back to `score.regularTime` JSONB; no scoring regression. |
| Admin edits `regularHome/Away` incorrectly | Admin can re-open modal and reset. Keep JSONB as audit trail. |
| Large AdminDashboard.tsx (already ~1348 lines) | Extract KnockoutScoreModal as a separate file in `components/ui/` or inline as a small sub-component. |
| `score` JSONB removal | Do NOT remove the JSONB column — keep it as sync audit trail. Only retire the reads in app logic. |

---

## Validation Strategy (end-to-end)

1. Create a test match in dev with penalty shootout data.
2. Sync → verify flat columns populated.
3. Open MatchCard (Jogos) — verify regular/ET/penalties blocks.
4. Open audit modal (Rank) — verify match row has ET/penalties.
5. Open StatsPage — verify PredictionCard has ET/penalties.
6. Open Tabela → knockout view — verify match row has ET/penalties annotation.
7. Admin edit modal: change penalties, verify update persists and MatchCard reflects it.
8. Run `tsc --noEmit` + test suite green.

---

## Deferred / Out of Scope

- Removing the `score` JSONB column (keep for API audit trail).
- Backfilling old completed matches via SQL (sync will handle it going forward).
- R2 scoring changes (R2 always uses full time result regardless of ET/penalties).
