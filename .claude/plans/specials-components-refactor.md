# Plan: Specials Components Refactor

_Status: **DEFERRED** — safety net in place, refactor not started. Created 2026-06-06. Last updated 2026-06-06._

> **Not executing now — deferred to "soon".** A characterization-test safety net
> was built first (see "Pre-refactor safety net" below) so the move can be done
> later with confidence that live behavior is unchanged. When picking this up,
> run `npm test` (baseline **109 green**) before and after each phase.

## Pre-refactor safety net (DONE — 2026-06-06)

Built via the `test-runner` agent **before** any refactor, since the app is in
production. Suite went **67 → 109 tests** (10 files, all green). New tests are
co-located beside each source file:

| Test file | Cases | Covers |
|---|---|---|
| `components/ExtraPhasePredictionsCard.test.tsx` | 6 | Phase A |
| `components/GroupClassificationsCard.test.tsx` | 7 | Phase A |
| `components/KnockoutClassificationsCard.test.tsx` | 7 | Phase A |
| `components/AdminSpecialsOverrides.test.tsx` | 7 | Phase A |
| `components/pages/StatsPage.test.tsx` | 7 | Phase C |
| `components/pages/MatchesPage.test.tsx` | 3 | Phase C |
| `components/LeaderboardDetails.test.tsx` | 4 | Phase C |
| `components/AdminDashboard.test.tsx` | 1 (smoke) | Phase B |

**Coverage vs. risk going into the refactor:**
- **Phase A — well covered.** Tests lock the exact things a move/extraction can
  break: the "show other members' predictions" accordions toggle; picks stay
  hidden ("Oculto") until lock then reveal team codes; locked-vs-unlocked
  disables Save; `onPredict` / `updateCompetitionAwards` fire with correct args.
- **Phase C — covered.** `PredictionCard`, `CollapsibleSection`, `MatchGroup`,
  `StatBadge` render + toggle correctly.
- **Phase B — thin net (by design).** `AdminDashboard` has only a smoke-mount
  test. Deep behavior (sync menu, awards form, DB inspector, user/group mgmt) is
  **untested** → still requires manual smoke-test of every admin action. Highest
  residual risk; keep it last and isolated.

**Behavior locked in as-is (NOT to be "fixed" by the refactor):**
1. `ExtraPhasePredictionsCard`: knockout phases with no fixtures fall back to the
   global tournament `lockDate` for their badge (future lock → all "Aberto",
   past lock → all "Em Andamento").
2. `OtherExtraPhasePredictions` keys rows by `userId` (fine for the current
   one-prediction-per-phase shape; would collide if that ever changes).

---


## Problem Summary

Several large component files mix a primary component with inline sub-components,
and the tournament/specials domain is scattered flat across `components/`. The
Phase 4 work already started a `components/specials/` folder
(`TournamentPredictionsCard`, `PlayerCombobox`, `OtherUsersPredictions`). This
plan consolidates the rest of that domain and breaks up the worst god-files.

This is a **structure-only** refactor: no behavior changes, no prop-contract
changes visible to callers beyond import paths. Each phase must keep `tsc` clean
and all 67 tests green.

## Motivation

- Duplicated "show other members' predictions" accordion pattern lives inline in
  4 different card files — same shape as the just-extracted `OtherUsersPredictions`.
- `AdminDashboard.tsx` is 1905 lines in a single component (hard to navigate, risky to edit).
- Page files carry inline render helpers that obscure the page's own logic.

---

## Execution Phases (each independently shippable)

### Phase A — Consolidate the specials/ domain folder  ← recommended first
Move tournament/specials cards + their inline "Other…" sub-components into `components/specials/`:

| File | Inline sub-component to extract | Target |
|------|-------------------------------|--------|
| `ExtraPhasePredictionsCard.tsx` | `OtherExtraPhasePredictions` (L432) | `specials/ExtraPhasePredictionsCard.tsx` + `specials/OtherExtraPhasePredictions.tsx` |
| `GroupClassificationsCard.tsx` | `OtherGroupClassifications` (L475) | `specials/GroupClassificationsCard.tsx` + `specials/OtherGroupClassifications.tsx` |
| `KnockoutClassificationsCard.tsx` | `AllKnockoutPredictionsCard` (L461), `OtherKnockoutPredictions` (L550) | `specials/KnockoutClassificationsCard.tsx` + 2 files |
| `AdminSpecialsOverrides.tsx` | — | `specials/AdminSpecialsOverrides.tsx` |

- Update imports in `SpecialsPage.tsx`, `AdminPage.tsx`, `AdminDashboard.tsx`.
- Consider a shared `OtherPredictionsAccordion` primitive — the 4 "Other…" components
  share the collapse + `getUserName`/`getTeamCode`/`getTeamFlag` helpers. Evaluate
  during Phase A; only abstract if the shape genuinely matches (don't force it).

### Phase B — Break up AdminDashboard.tsx (1905 lines)
- Survey the internal sections (tabs/panels) and extract each into `components/admin/`.
- Highest risk — do last, isolated, with manual smoke test of every admin action.
- Coordinates with the deferred large-file initiative.

### Phase C — Page render-helper extraction (low priority)
- `StatsPage.tsx`: `PredictionCard` (L129), `CollapsibleSection` (L266) → `components/stats/`
- `MatchesPage.tsx`: `MatchGroup` (L29) → co-locate or `components/matches/`
- `LeaderboardDetails.tsx`: `StatBadge` (L24) → keep inline (too small) unless reused

---

## Validation Strategy

- After each file move: `npx tsc --noEmit` clean + `npx vitest run` (67 passing).
- Manual smoke test of the affected screen (specials page, admin panel).
- One commit per file/group — small, revertible.

## Risks

| Risk | Mitigation |
|---|---|
| Import churn across many callers | Grep each component name before moving; update all call sites in the same commit |
| Over-abstracting the "Other…" accordion | Only extract a shared primitive if 3+ usages match exactly; otherwise just relocate |
| AdminDashboard regression | Phase B isolated, last, with manual test of every admin action |

## Deferred / Out of Scope

- No logic/behavior changes — pure structure.
- `usePointsProcessor` / hook-layer refactors are separate.

---

## Appendix — Proposed `src/` structure (under evaluation)

### Template proposed by the user

```
src/                    # Código Fonte
├── assets/             # Imagens, ícones, fontes locais
├── components/         # Componentes globais e reutilizáveis
│   ├── Button.tsx
│   └── Input.tsx
├── context/            # Contextos globais (ex: AuthContext)
├── hooks/              # Custom hooks (ex: useAuth, useDebounce)
├── layouts/            # Layouts de página (ex: AuthLayout, DashboardLayout)
├── pages/              # Páginas/telas (Home/, Login/)
├── services/           # Integrações com APIs (Supabase, Axios)
├── styles/             # Estilos globais
├── utils/              # Helpers (formatadores, etc.)
├── App.tsx             # Raiz da aplicação
└── main.tsx
```

### Current reality (important context)

- App code lives at the **repo root**, NOT in `src/`. `src/` today only holds
  `src/test/` scaffolding.
- Alias `@/*` → `./*` (tsconfig) and Vite `@` → repo root. Most imports are
  relative (`../types`, `../../contexts/...`), so they're move-fragile.
- `api/` is **Vercel serverless functions** — by platform convention it MUST stay
  at the repo root. It cannot move under `src/`.

### Current → template mapping

| Current (root) | Template equivalent | Note |
|---|---|---|
| `components/` | `src/components/` | mostly type-based today; see critique |
| `components/ui/` | `src/components/` primitives | matches `Button.tsx`/`Input.tsx` idea |
| `components/pages/` | `src/pages/` | template wants per-page folders (`Home/`, `Login/`) |
| `contexts/` | `src/context/` | naming differs (`contexts` vs `context`) |
| `hooks/` | `src/hooks/` | 1:1 |
| `services/` | `src/services/` | 1:1 |
| `utils/` | `src/utils/` | 1:1 |
| `public/` assets, inline SVGs | `src/assets/` | no `assets/` today |
| _(none)_ | `src/layouts/` | no layout layer today (App.tsx holds shell) |
| _(none)_ | `src/styles/` | Tailwind via `index.css`/CDN; little global CSS |
| `api/` | — | STAYS at root (Vercel) |
| `data/`, `database/` | — | not in template; keep at root |

### My assessment (honest)

**What the template gets right**
- It's the conventional, instantly-recognizable Vite layout — good for onboarding.
- It adds three buckets we genuinely lack and would benefit from: `layouts/`
  (extract the app shell/nav out of `App.tsx`), `assets/` (consolidate icons/images),
  and per-page folders (a page + its local parts live together).

**Where I'd diverge for THIS repo**
1. **Don't do a blanket `src/` move right now.** It rewrites nearly every import
   path plus `tsconfig`, `vite.config`, entry HTML, and risks the Vercel build —
   all for a mostly cosmetic gain, while we're mid-feature (Phase 5 pending). High
   churn / low value. If we ever do it, it's an isolated chore on a clean branch
   with the `@/*` alias flipped to `./src/*` in one commit, and `api/` left at root.
2. **The template is type-based** (`components/`, `hooks/`, `pages/`). For an app
   with clear domains (specials, admin, matches, leaderboard, auth), **domain/feature
   colocation scales better** and directly cures the "god folder" we're fixing. The
   `components/specials/` work is exactly this — I'd keep going that way rather than
   re-flattening into one big `components/`.
3. `context/` vs existing `contexts/` — keep `contexts/`; renaming buys nothing.

**Recommended adapted target (hybrid: shared-by-type + features-by-domain)**

```
components/
├── ui/                 # shared primitives (Button, Input, ModalShell, PlayerCombobox*)
├── layouts/            # app shell, nav, page chrome (extracted from App.tsx)
└── <domain>/           # feature folders, colocated card + sub-parts
    ├── specials/       # ← started: TournamentPredictionsCard, PlayerCombobox, Other*
    ├── admin/          # AdminDashboard split (Phase B)
    ├── matches/        # MatchCard, MatchGroup
    └── leaderboard/    # Leaderboard, LeaderboardDetails, StatBadge
pages/                  # thin page wrappers that compose domain components
hooks/  services/  utils/  contexts/   # unchanged
assets/                # NEW: consolidate icons/images
api/                   # UNCHANGED — Vercel functions, stays at root
```

\* `PlayerCombobox` is reusable enough to graduate to `ui/` later; it sits in
`specials/` for now since that's its only caller.

**Bottom line:** adopt the *ideas* (layouts, assets, per-page/per-domain
colocation) incrementally via Phases A–C above. Treat the literal `src/`-root move
as a separate, optional, low-priority chore — net churn is high and the payoff is
small for this codebase.

### Decision needed
- [ ] Adopt the hybrid domain layout (recommended) — continue Phases A–C, no `src/` move
- [ ] Full `src/`-root migration as a separate later chore (y/n?)
- [ ] Add `layouts/` + `assets/` now, defer the rest

---

## Completed (this initiative)

- **2026-06-06** — `components/specials/` created. Extracted `PlayerCombobox` +
  `OtherUsersPredictions` from `TopScorerCard`; renamed `TopScorerCard` →
  `TournamentPredictionsCard`. Fixed combobox display bug (focus cleared the
  name) + goalkeeper position filter. `tsc` clean, 67 tests green.
