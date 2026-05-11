# SESSION MEMORY — Bolão Copa do Mundo 2026

_Update this file at every significant checkpoint. Read it first at the start of every session._

---

## Status atual

- Backend: ✅ Supabase schema, RLS policies, sync hooks operacionais
- Frontend: ✅ Páginas principais implementadas (Matches, Leaderboard, Stats, Tournament, Admin)
- DB schema: ✅ Migration 0002 criada (FKs, fix TLA, índices)
- Schema dev: ✅ SQL files e client configurados para schema `dev` via env var
- Testes: ✅ Vitest + RTL configurados; 33 testes passando (scoring + leaderboard)
- Deploy: ✅ Documentação completa em `docs/DEPLOY_VERCEL.md`

---

## Última tarefa executada

**Branch:** `feature/02/ai`

Schema cleanup + standings group nullable + team ranking via JSON (4 tasks do plano aprovado):

1. **Migration `0003_teams_natural_key.sql`** — UNIQUE(code, externalTeamId) na tabela `teams`. Permite lookup pelo par natural da API sem quebrar UUID PK nem FKs existentes.

2. **Migration `0004_standings_group_nullable.sql`** — `team_standings.group` agora é nullable. PK migrada de `(teamId, competitionCode, group)` para `(teamId, competitionCode)` (NULL não pode integrar PK no PostgreSQL). Limpa linhas com "Temporada Regular" de competições CUP.

3. **`data/competitions.ts`** — campo `type: "CUP" | "LEAGUE"` adicionado à interface `CompetitionOption` e populado em todas as 8 entradas. Fallback de `getCompetitionByCode` usa `"CUP" as const`.

4. **`services/liveScoreService.ts`** — `fetchExternalStandings` usa `DEFAULT_COMPETITION_CODE` em vez de `"WC"` hardcoded. `ExternalStandingGroup.group` agora é `string | null`.

5. **`hooks/useSyncSystem.ts`**:
   - `rankingMap` buscado via `getWcRankingMap()` antes do loop de times (Fase 1.5a)
   - Dois pontos de criação de payload usam `rankingMap[teamCode.toUpperCase()] ?? 999` em vez de `999` fixo
   - Guard CUP removido (`if (!group.group && group.stage !== "REGULAR_SEASON") continue`)
   - `group: group.group || null` (antes `|| "Temporada Regular"`)
   - Dedup key: `teamId|competitionCode` (antes incluía `|group`)
   - `onConflict: "teamId, competitionCode"` (antes incluía `, group`)

6. **`components/TournamentStandings.tsx`**:
   - `isRegularSeason` usa `COMPETITION_OPTIONS.find(...)?.type === "LEAGUE"` como fallback (remove `leagueCodes` hardcoded)
   - `cachedStandings`: `groupName = standing.group ? normalizeGroupName(standing.group) : "Tabela"`
   - `buildStandingsFromExternal`: `groupName = groupEntry.group ? normalizeGroupName(groupEntry.group) : "Tabela"`

---

## Última tarefa executada (2026-05-10)

**Branch:** `feature/03/claude-code`

Planejamento e implementação de três sprints:

### Sprint 1 — Infraestrutura de Testes
- Instalado Vitest + React Testing Library + happy-dom (substituiu jsdom por incompatibilidade ESM v27)
- `vite.config.ts`: adicionado bloco `test` (environment: happy-dom, setupFiles, globals)
- `src/test/setup.ts`: importa `@testing-library/jest-dom`
- `src/test/mocks/supabase.ts`: mock do client Supabase via `vi.mock`
- `package.json`: scripts `test`, `test:watch`, `test:ui` adicionados
- `.claude/agents/test-runner.md`: agente dedicado — único autorizado a criar/editar testes
- `CLAUDE.md`: regra de testes adicionada (feature agents proibidos de tocar em `*.test.ts`)
- `utils/scoring.test.ts`: 28 testes das funções puras de pontuação
- `hooks/useLeaderboard.test.ts`: 5 testes de cálculo e ranking
- **33 testes passando**

### Sprint 2 — UI/UX
- `vite.config.ts`: code splitting (`manualChunks`) para react, supabase, gemini — reduz bundle de 617 KB
- `components/pages/MatchesPage.tsx`: empty state com botão "Entrar em um grupo" que abre GroupSwitcher
- `App.tsx`: prop `onOpenGroupSwitcher` passada para MatchesPage

### Sprint 3 — Documentação Deploy
- `docs/DEPLOY_VERCEL.md`: guia completo com 6 passos, tabela de env vars, smoke test e troubleshooting

---

## Próximo passo

Rodar migrations no Supabase SQL Editor (em ordem):

```
1. database/migrations/0001_create_tables.sql   (se schema dev ainda não existe)
2. database/migrations/0002_fix_teams_fks_indexes.sql
3. database/migrations/0003_teams_natural_key.sql
4. database/migrations/0004_standings_group_nullable.sql
5. database/rls/current.sql
6. database/seed/system_config.sql
```

Depois testar sync completo (WC e BSA) pelo admin dashboard:
- WC: standings deve ter `group = "Group A"` etc. (não "Temporada Regular")
- BSA: standings deve ter `group = null`
- Frontend Tabela WC: grupos exibidos como "Grupo A", "Grupo B"...
- Frontend Tabela BSA: bloco único "Tabela"

Quando pronto para deploy: seguir `docs/DEPLOY_VERCEL.md` (criar `vercel.json` é o primeiro passo).

---

## Decisões técnicas

| Decisão | Motivo |
|---------|--------|
| Todo estado em hooks, componentes só renderizam | Separação clara de responsabilidades; facilita testar hooks isoladamente |
| Supabase client singleton em `services/supabase.ts` | Evita múltiplas conexões e estado duplicado |
| Sync via `setInterval` no admin tab | Solução temporária; a definitiva é Edge Functions + pg_cron |
| RLS group-scoped em todas as tabelas | Segurança: usuários só acessam dados do próprio grupo |
| Proxy Vite para Football Data API | Contorna CORS sem expor chave no frontend |
| Google Sign-In via CDN em `index.html` | Integração simples sem SDK npm; tradeoff: dependência externa carregada no HTML |
| `teams.code` (TLA) sem UNIQUE | TLA não é globalmente único — colisões esperadas dentro da mesma competição (Corinthians/Coritiba = "COR") e entre competições. Chave real: `externalTeamId` |
| FK `competitionCode` DEFERRABLE | Sync faz upsert de competition + matches no mesmo fluxo; DEFERRED evita erro de FK por ordem de insert |
| Schema configurável via `VITE_SUPABASE_SCHEMA` | Permite usar schema `dev` no Supabase sem afetar dados de prod no mesmo projeto |

---

## Problemas encontrados

| Problema | Resolução |
|----------|-----------|
| RLS 403 errors em queries group-scoped | Série de migrações `supabase_rls_*.sql`; hotfix em `supabase_rls_hotfix_403.sql` |
| UUID vs text mismatch nas tabelas | Migrado via `supabase_alter_tables_uuid.sql` |
| Sync só roda com aba admin aberta | Known limitation; solução planejada: Edge Functions + pg_cron |
| CORS com Football Data API | Resolvido com proxy no `vite.config.ts` |
| TLA duplicado entre times (ex: "COR" no BSA) | DROP UNIQUE em `teams.code`; upsert sempre por `externalTeamId` |
| `matches.competitionCode` sem FK | Migration 0002: FK DEFERRABLE + upsert de competition no início do sync |

---

| Vitest + happy-dom em vez de jsdom | jsdom v27 tem dependências ESM-only incompatíveis com o pool de workers do Vitest; happy-dom não tem esse problema |
| test-runner como agente separado | Impede que agentes de feature alterem testes para forçar passagem — garante integridade dos testes |
| Code splitting por biblioteca | React, Supabase e Gemini são dependências pesadas e estáveis — chunks separados melhoram cache do browser |

_Última atualização: 2026-05-10_
