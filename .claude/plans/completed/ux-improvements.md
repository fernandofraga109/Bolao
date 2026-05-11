# P2 UX Improvements

_Status: COMPLETED_  
_Last updated: 2026-05-11_

---

## Overview

Two small display improvements. Independent of each other — can be done in any order or in the same commit.

---

## Improvement 1: Dynamic Underdog Bonus in Scoring Rules

### Problem
`components/RulesSection.tsx` displays static text for the Zebra Bonus rule. If a group has a custom `underdog_min_rank_diff`, the displayed threshold doesn't match what actually applies.

### Current State
`RulesSection` is a standalone component with no props — it renders static text. It doesn't know about the active group's configuration.

### Investigation Needed Before Implementing
1. Check how `RulesSection` is used in `App.tsx` or pages — confirm it's rendered in a context where the active group is accessible
2. Check if `groups` table has a `underdog_min_rank_diff` column (check `database/migrations/0001_create_tables.sql` and `types.ts`)
3. Check `constants.ts` or `systemConfig` for the global default

### Fix Approach
- Pass `minRankDiff: number` as a prop to `RulesSection`
- Parent reads: `group?.underdog_min_rank_diff ?? systemConfig?.underdog_min_rank_diff ?? 10`
- Display: `"...diferença de ranking FIFA for maior que ${minRankDiff} posições"`

### Affected Files
- `components/RulesSection.tsx` — add `minRankDiff` prop, replace hardcoded value
- Wherever `RulesSection` is rendered — pass the prop

---

## Improvement 2: FIFA Ranking in Match Cards

### Problem
Match cards show team names but not their FIFA ranking. Users can't easily see which team is the underdog.

### Current State
`components/MatchCard.tsx` already reads `match.homeTeam?.ranking` and `match.awayTeam?.ranking` internally (for underdog bonus calculation). It just doesn't display them.

Lines to look at: ~222–224 (home team name), ~333–335 (away team name).

### Fix Approach
Below each team name, conditionally render the ranking:

```tsx
<span className="text-xs font-black text-center text-slate-200 uppercase tracking-tight leading-none h-8 flex items-center">
  {match.homeTeam.name}
</span>
{match.homeTeam.ranking && (
  <span className="text-[10px] text-slate-400 text-center">
    #{match.homeTeam.ranking}
  </span>
)}
```

Requirements:
- Only render when `ranking` is truthy (not 0 or undefined)
- Same layout for home and away team
- Keep visual hierarchy clean — ranking is secondary to team name
- Must not break mobile layout (teams area is already narrow)

### Affected Files
- `components/MatchCard.tsx` — add ranking display below team name (×2, home + away)

---

## Execution Order

Both can be done independently. Suggested order:
1. FIFA ranking in MatchCard (simpler, self-contained)
2. Dynamic underdog bonus in RulesSection (requires investigation of schema first)

---

## Completion Checklist

### Improvement 1 — Underdog Bonus
- [x] Confirmed `underdog_min_rank_diff` column exists in `groups` schema (types.ts:121)
- [x] `RulesSection.tsx` updated with `minRankDiff` prop (default 10)
- [x] `MatchesPage` passes `minRankDiff` down to `RulesSection`
- [x] Value chain: `App.tsx` → `MatchesPage` → `RulesSection` using `currentGroup?.underdog_min_rank_diff ?? db.systemConfig.underdog_min_rank_diff ?? 10`

### Improvement 2 — FIFA Ranking
- [x] `MatchCard.tsx` updated — `#{ranking}` shown below team name when truthy
- [x] Conditional render: `{match.homeTeam.ranking ? ... : null}` (same for away)
- [x] Build passes clean (vite build ✓)
