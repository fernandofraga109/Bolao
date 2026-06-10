# Estratégia de Testes — Bolão Copa 2026

> Estado atual dos testes + estratégia recomendada, a partir de `package.json`, `src/test/` e arquivos `*.test.*`.
> Última análise: 2026-06-10.

---

## 1. Stack e comandos

| Ferramenta | Uso |
|---|---|
| **Vitest 4** | Test runner |
| **@testing-library/react** | Testes de componentes |
| **@testing-library/user-event** | Simulação de interação |
| **@testing-library/jest-dom** | Matchers de DOM |
| **happy-dom** | Ambiente DOM headless |

```bash
npm run test        # roda toda a suíte uma vez (vitest run)
npm run test:watch  # modo watch
npm run test:ui     # interface visual do Vitest
```

Setup global: `src/test/setup.ts`. Mock do Supabase: `src/test/mocks/supabase.ts`.

---

## 2. Regras de autoria de testes (do projeto)

> Definidas em `CLAUDE.md` / `docs/conventions/testing-rules.md` — **devem ser respeitadas**.

- O agente **`test-runner`** é o **único** autorizado a criar/editar/deletar arquivos de teste (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `src/test/**`).
- Agentes de feature (`frontend`, `backend`) **nunca** tocam em testes — nem para corrigir um teste quebrado.
- Após implementar uma feature, invocar o `test-runner` para escrever/atualizar testes.
- Se um teste falha após uma feature: o `test-runner` reporta, e o **agente de feature corrige a implementação** — nunca o contrário (não se "ajusta o teste para passar").

---

## 3. Cobertura atual (inventário)

### Testes unitários (lógica pura) — prioridade alta ✅

| Arquivo | O que cobre |
|---|---|
| `utils/scoring.test.ts` | **Núcleo de pontuação**: categorias R1/R2, bônus underdog, "placar isolado", "quem se classifica", regra do empate, base de comparação mata-mata |
| `hooks/useLeaderboard.test.ts` | Cálculo/ordenação do ranking |

### Testes de componentes/integração

| Arquivo | O que cobre |
|---|---|
| `components/AdminDashboard.test.tsx` | Painel admin |
| `components/AdminSpecialsOverrides.test.tsx` | Overrides de resultados oficiais |
| `components/ExtraPhasePredictionsCard.test.tsx` | Palpite extra de fase (R2) |
| `components/GroupClassificationsCard.test.tsx` | Classificados de grupos (R2) |
| `components/KnockoutClassificationsCard.test.tsx` | Classificados de mata-mata (R2) |
| `components/LeaderboardDetails.test.tsx` | Detalhe/auditoria do ranking |
| `components/pages/MatchesPage.test.tsx` | Listagem e palpites de partidas |
| `components/pages/StatsPage.test.tsx` | Estatísticas do usuário |

---

## 4. Pirâmide e prioridades

```
        ╱ E2E (ausente hoje) ╲          ← oportunidade futura
      ╱  Integração/componentes ╲       ← parcial (páginas + cards)
    ╱   Unitário (scoring, hooks)  ╲     ← base sólida; manter 100% verde
```

**Funcionalidades críticas que exigem cobertura forte:**

1. **`utils/scoring.ts`** — qualquer regressão corrompe o ranking de todos. Cobertura unitária ampla é mandatória.
2. **`usePointsProcessor`** — agregação/persistência de pontos (R1/R2 + torneio + fase, upsert seguro, guarda anti-zeramento). Hoje **sem teste dedicado** → lacuna prioritária.
3. **Hidratação de usuário/grupo** (`useUserSystem.hydratedUsers`) — filtro de palpites por grupo ativo do viewer. Lacuna.
4. **Pipeline de sync** (`useSyncSystem`) — fases, lock, fallback de season, tratamento de `429`. Lacuna (depende de mock de `liveScoreService`).

---

## 5. Padrões de teste recomendados

### Unitário (funções puras)
- Testar `utils/scoring.ts` por **tabela de casos** (input → categoria/pts esperados), cobrindo bordas: empate real, mata-mata com prorrogação/pênaltis, "placar isolado" com 1 vs N acertadores, divisão de pontos R2 do campeão/artilheiro.

### Hooks
- Usar `renderHook` + mock do Supabase (`src/test/mocks/supabase.ts`). Validar atualização otimista e recálculo.

### Componentes
- Renderizar com props hidratadas; usar `user-event` para palpitar; assertar badge de pontos, cor por categoria e travamento por `lockDate`.
- **Não** depender de rede — mockar `services/*`.

### Datas / lock
- Usar `vi.useFakeTimers()` para validar `lockDate` e travamento por fase (R2).

---

## 6. Lacunas e recomendações

| Lacuna | Recomendação |
|---|---|
| `usePointsProcessor` sem teste | Cobrir agregação R1/R2, upsert `defaultToNull:false`, guarda anti-zeramento |
| `useSyncSystem` sem teste | Mockar `liveScoreService`; validar ordem das fases, lock e `RATE_LIMIT_*` |
| Hidratação de palpites por grupo | Testar `useUserSystem` (viewer vê palpites de terceiros pelo grupo do viewer) |
| Sem E2E | Avaliar Playwright para fluxos críticos (login → palpitar → ver ranking) |
| Cobertura não medida | Habilitar `vitest --coverage` e definir meta para `utils/` e `hooks/` |

---

## 7. Checklist ao mexer em pontuação

- [ ] Atualizar/adicionar casos em `utils/scoring.test.ts` (via `test-runner`).
- [ ] Garantir que cor/label na UI deriva da **categoria** (não de threshold de pts).
- [ ] Validar consistência DB ↔ UI do `tieWinnerTeamId`.
- [ ] Rodar `npm run test` — suíte 100% verde antes de marcar feature como concluída.
