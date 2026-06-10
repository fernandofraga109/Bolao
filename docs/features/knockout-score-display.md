# Knockout Score Display

Documents the exact score breakdown display pattern for knockout matches across all three screens that show scores. Each screen shows the same flat columns (`regularHome/Away`, `extraTimeHome/Away`, `penaltiesHome/Away`, `result`) but in different layouts suited to its context.

---

## Flat Column Reference

| Column | Source | Meaning |
|---|---|---|
| `regularHome / regularAway` | `score.regularTime` from API | Goals scored in 90 min — **R1 scoring base** |
| `extraTimeHome / extraTimeAway` | `score.extraTime` from API | Goals scored **only during ET** (delta, not cumulative) |
| `penaltiesHome / penaltiesAway` | `score.penalties` from API | Penalty shootout result |
| `result.home / result.away` | `score.fullTime` from API | **Cumulative** = regular + ET (penalties do not add to result) |

Duration inferred by `getMatchDuration(match)`:
- `penaltiesHome != null` → `PENALTY_SHOOTOUT`
- `extraTimeHome != null` → `EXTRA_TIME`
- else → `REGULAR`

---

## Display Pattern per Screen

### UserAuditModal — Expanded match row

Context: audit of a user's prediction. Main grid shows cumulative result vs prediction.
Sub-lines appear below the grid when `getMatchDuration !== 'REGULAR'`:

```
┌─────────────────────┬──────────────────────┐
│   Resultado real    │       Palpite         │
│       2 – 1         │       1 – 1           │
└─────────────────────┴──────────────────────┘

Tempo Regular (R1): 1 – 1    ← regularHome/Away
Após Prorrogação:   2 – 1    ← match.result (cumulative)
Pênaltis:           4 – 3    ← penaltiesHome/Away (if PENALTY_SHOOTOUT)
```

> "Resultado real" in the main grid always shows the cumulative `match.result`. The sub-lines break it down so the user understands what R1 scored against (regular time).

---

### StatsPage — PredictionCard

Context: user's personal stats history. Main score shows cumulative result (already the "final" answer). Sub-lines below "resultado" label appear when `getMatchDuration !== 'REGULAR'`:

```
   2 × 1              ← match.result (cumulative)
  resultado
  Regular  1×1        ← regularHome/Away
  Prorrog. 1×0        ← extraTimeHome/Away (ET delta only)
  Pên.     4×3        ← penaltiesHome/Away
  palpite
   1 × 1
```

> ET delta (not cumulative) is shown here because the main score already is the cumulative — showing the delta communicates what happened specifically in extra time.

---

### TournamentStandings — Knockout bracket row

Context: tabela mata-mata view. Main score shows **regular time** (not cumulative) so it's immediately clear what the 90-min result was. Sub-lines below:

```
   1 × 1              ← regularHome/Away (main, fallback: match.result)
   Prorr.  1×0        ← extraTimeHome/Away (ET delta)
   Pên.    4×3        ← penaltiesHome/Away
   Agreg.  2×1        ← match.result (cumulative, for completeness)
```

> Fallback: if `regularHome` is null (match not yet synced with flat cols), the main score falls back to `match.result`.

---

## Null Safety / Backward Compat

All flat columns are `integer | null`. Rows synced before migration 0027 will have `null` values — display blocks are guarded by `!= null` checks so nothing extra renders for group-stage or pre-migration matches.

`getMatchDuration` falls back to `score.duration` JSONB for matches without flat cols yet, so duration inference also degrades gracefully.

---

## Files

| File | Role |
|---|---|
| `utils/scoring.ts` | `getMatchDuration`, `getKnockoutAdvancingTeamId`, `getR1MatchScoringResult` |
| `components/MatchCard.tsx` | Jogos tab — shows regular/ET/penalties block on finished knockout matches |
| `components/AdminMatchCard.tsx` | Admin Jogos tab — editable inputs for all flat cols |
| `components/UserAuditModal.tsx` | Rank tab → audit expanded row |
| `components/pages/StatsPage.tsx` | Stats tab → PredictionCard scores area |
| `components/TournamentStandings.tsx` | Tabela tab → knockout bracket row |
