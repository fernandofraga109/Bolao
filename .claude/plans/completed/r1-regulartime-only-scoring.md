# Plan: Regulamento 1 — Score on Regular Time Only + "Quem se Classifica?" Rename

_Status_: DONE — 2026-06-08

---

## Problem Summary

Two changes bundled together:

1. **R1 scoring base**: R1 groups should score predictions against **regular-time only**. Currently they compare against `regularTime + extraTime`, which is wrong.
2. **Concept rename**: the "tiebreaker" input is better described as "quem se classifica?" (who advances) rather than "quem vence nos pênaltis?" (who wins on penalties) — it's more general and user-friendly.

Regulamento 2 keeps the existing behavior (extra time counts, per rule 2 of the regulamento).

---

## Implementation Summary

All phases completed 2026-06-08.

### Phase 0 — Rename: "tieWinner" → "whoClassifies"

- `types.ts`: `Prediction.whoClassifiesTeamId` (was `tieWinnerTeamId`); `PredictionDB.tieWinnerTeamId` kept (DB column unchanged).
- `scoring.ts`: params `predWhoClassifiesId`/`realWhoClassifiesId`; `classifiesBonus`; `POINTS_CLASSIFIES_BONUS = 3`.
- `hooks/useUserSystem.ts`: read from DB: `whoClassifiesTeamId: p.tieWinnerTeamId`; write to DB: `tieWinnerTeamId: whoClassifiesTeamId`.
- `components/MatchCard.tsx`: "Quem se classifica?" label, "se classifica" badge, "+X classifica" bonus badge.
- `components/UserAuditModal.tsx`: "Classifica:" label, "+X classifica" bonus badge.

### Phase 1 — New helper `getR1MatchScoringResult`

Added to `utils/scoring.ts`. Returns `score.regularTime` when `duration === EXTRA_TIME || PENALTY_SHOOTOUT`; falls back to stored result otherwise.

### Phase 2 — `usePointsProcessor.ts`

Three R1 scoring call sites updated to use `r1Result` from helper. DB upsert payload key `tieWinnerTeamId` kept.

### Phase 3 — `useLeaderboard.ts`

R1 branch updated to use `r1Result` for both `getScoreCategoryRegulamento1` and `calculatePoints` calls.

### Phase 4 — `UserAuditModal.tsx`

R1 scoring call site uses `r1Result`; display shows regularTime scores for audit.

### Phase 5 — `components/MatchCard.tsx` display

Added `displayResult` useMemo: R1 shows `regularTime`, R2 shows `match.result`. Added "Após Prorrogação" block for R1 knockout matches showing full result alongside the penalty block.

### Bug Fix — Rule 3 gap in R1

`getScoreCategoryRegulamento1` was missing the draw guard present in R2. Added: when `realHome === realAway`, return `{ type: 'outcome', ... }` immediately — no diff bonus for draws in R1.

---

## Files Changed

```
utils/scoring.ts              new helper + Rule 3 guard + renames
types.ts                      whoClassifiesTeamId rename
hooks/usePointsProcessor.ts   3 R1 scoring call sites + r1Result
hooks/useLeaderboard.ts       R1 branch r1Result
hooks/useUserSystem.ts        DB boundary mapping
components/MatchCard.tsx      displayResult + Após Prorrogação block + label renames
components/UserAuditModal.tsx R1 audit scoring + label renames
utils/scoring.test.ts         classifiesBonus rename + Rule 3 draw test fixes (via test-runner)
```

---

## Deferred / Follow-up

- Two pre-existing failures in `useLeaderboard.test.ts` (42→10, 7→5 pts) exist before these changes — not caused by this feature, tracked separately.
- DB column rename (`tieWinnerTeamId` → `whoClassifiesTeamId`) is a deferred migration if ever needed.
