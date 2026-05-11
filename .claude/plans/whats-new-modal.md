# What's New Modal + changelog-updater Agent

_Status: READY TO IMPLEMENT_  
_Last updated: 2026-05-11_

---

## Context

After the production stabilization sprint, we resume the "What's New" modal. This was the previous sprint's immediate priority. Purpose: show users a modal on first load after a new version is deployed, summarizing what changed.

---

## Design

**Show condition:** `localStorage.getItem("bolao_last_seen_version") !== CURRENT_VERSION`  
**On close:** `localStorage.setItem("bolao_last_seen_version", CURRENT_VERSION)`  
**Language:** PT-BR throughout

---

## Implementation Plan

### 1. `data/releases.ts` — static release history

```ts
export const CURRENT_VERSION = "1.1.0";

export interface Release {
  version: string;
  date: string;        // "2026-05-11"
  changes: string[];   // PT-BR descriptions
}

export const RELEASES: Release[] = [
  {
    version: "1.1.0",
    date: "2026-05-11",
    changes: [
      "Cadastro e entrada em grupos corrigidos",
      "Pontuação agora sincroniza corretamente com o banco de dados",
    ],
  },
];
```

### 2. `components/ui/WhatsNewModal.tsx` — modal component

- Uses existing `ModalShell` (`components/ui/ModalShell.tsx`)
- Shows latest release version + date + change list
- Single "Entendido!" button to close
- No close-on-backdrop-click (user must acknowledge)

### 3. `App.tsx` — wire the modal

Add to existing state:
```ts
const [showWhatsNew, setShowWhatsNew] = useState(false);

useEffect(() => {
  const seen = localStorage.getItem("bolao_last_seen_version");
  if (seen !== CURRENT_VERSION) setShowWhatsNew(true);
}, []);

const handleWhatsNewClose = () => {
  localStorage.setItem("bolao_last_seen_version", CURRENT_VERSION);
  setShowWhatsNew(false);
};
```

Render: `{showWhatsNew && <WhatsNewModal onClose={handleWhatsNewClose} />}`

Only show after auth is ready and user is logged in (check `authReady && currentUser`).

### 4. `.claude/agents/changelog-updater.md` — new agent

Agent responsible for bumping `CURRENT_VERSION` and prepending a new entry to `RELEASES` in `data/releases.ts`. Mirrors the `test-runner` pattern: invoked explicitly after any significant feature merge.

### 5. `CLAUDE.md` — add rule

Add alongside the `test-runner` rule:
> After any significant feature: invoke `changelog-updater` to bump version and prepend release entry.

---

## Affected Files

| File | Change |
|------|--------|
| `data/releases.ts` | Create new |
| `components/ui/WhatsNewModal.tsx` | Create new |
| `App.tsx` | Add state + useEffect + render |
| `.claude/agents/changelog-updater.md` | Create new |
| `CLAUDE.md` | Add changelog-updater rule |

---

## Risks / Notes
- No Supabase changes needed — localStorage only
- Modal should only render if user is authenticated (don't flash during login)
- `CURRENT_VERSION` in `data/releases.ts` is the single source of truth

---

## Validation
1. Clear localStorage (`bolao_last_seen_version`)
2. Load app + login → modal should appear
3. Click close → modal disappears, key set in localStorage
4. Reload → modal should not appear again
5. Bump `CURRENT_VERSION` → modal appears again on next load

---

## Completion Checklist
- [ ] `data/releases.ts` created
- [ ] `components/ui/WhatsNewModal.tsx` created
- [ ] `App.tsx` wired
- [ ] `changelog-updater` agent created
- [ ] `CLAUDE.md` rule added
- [ ] Validated end-to-end
