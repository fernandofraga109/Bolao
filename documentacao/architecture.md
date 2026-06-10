# Arquitetura da Aplicação — Bolão Copa 2026

> Documento de visão geral consolidada. Para detalhamento por domínio, ver também a pasta `docs/`.
> Última análise: 2026-06-10.

---

## 1. O que é a aplicação

Aplicação web (PWA-like, mobile-first) de **bolão de futebol** para a Copa do Mundo 2026 e outras competições. Usuários entram em **grupos** via código, fazem **palpites** de placar nas partidas e em **palpites especiais** (campeão, artilheiro, classificados, etc.), e disputam um **ranking** pontuado automaticamente conforme os resultados reais sincronizados de uma API externa de futebol.

Suporta **dois regulamentos de pontuação** (Regulamento 1 e Regulamento 2) configuráveis por grupo, e **múltiplas competições** simultâneas.

---

## 2. Stack tecnológico

| Camada | Tecnologia |
|---|---|
| UI | React 19 + TypeScript |
| Build/Dev | Vite 6 |
| Estilo | TailwindCSS (classes utilitárias, tema `brand-*`) |
| Ícones | lucide-react |
| Backend (BaaS) | Supabase — PostgreSQL + Auth + Realtime |
| Dados de futebol | football-data.org API (`/v4`) via proxy |
| IA | Google Gemini (`@google/genai`) — palpites assistidos |
| Testes | Vitest + Testing Library + happy-dom |
| Lint/Format | ESLint 9 + Prettier |

Idioma da aplicação: **português brasileiro** (pt-BR). Todo texto de UI é mantido em pt-BR.

---

## 3. Estrutura de diretórios

```
App.tsx                  — orquestrador raiz: compõe hooks, controla tabs e renderiza páginas
index.tsx                — bootstrap React + DatabaseProvider
types.ts                 — todas as interfaces TS (DB models + UI models)
constants.ts             — constantes globais, hidratação do estado inicial (JOIN em memória)

contexts/
  DatabaseContext.tsx    — RAIZ DE ESTADO: tabelas em memória, CRUD, fetch inicial, Realtime

hooks/                   — lógica de negócio (um hook por domínio)
  useUserSystem.ts       — auth, perfil, grupos, palpites (predictMatch/predictTournament)
  useMatchSystem.ts      — jogos, lockDate, sync, controles admin (finishMatch/updateLiveScore)
  useGroupSystem.ts      — criação/entrada/exclusão de grupos
  useLeaderboard.ts      — cálculo de ranking para exibição
  usePointsProcessor.ts  — cálculo e persistência de pontos (R1/R2 + torneio + fase)
  useSyncSystem.ts       — pipeline de sync com a Football-Data API
  useBackgroundSync.ts   — agenda o sync passivo (intervalo configurável)
  usePollingRefresh.ts   — re-leitura periódica do Supabase (15s) — NÃO chama API externa
  usePlayerSync.ts       — elencos (squads) e artilheiros (scorers)
  usePasswordRecovery.ts — fluxo de redefinição de senha
  usePullToRefresh.ts    — gesto pull-to-refresh mobile

components/
  pages/                 — uma view completa por tab (Matches, Leaderboard, Stats, Tournament, Admin, Specials)
  ui/                    — primitivos reutilizáveis (modais, toasts, avatar, splash, etc.)
  specials/              — cards de palpites especiais
  topscores/             — aba de artilharia
  (raiz)                 — layout e cards compartilhados (Header, BottomNav, MatchCard, ...)

services/                — clientes externos
  supabase.ts            — cliente Supabase (schema configurável)
  liveScoreService.ts    — wrappers fetch da Football-Data (via /api proxy)
  geminiService.ts       — wrapper Gemini
  seeder.ts              — seed de dados

api/                     — handlers de endpoints (Vercel Edge Functions em prod / contrato do proxy Vite em dev)
  matches.ts, teams.ts, standings.ts, scorers.ts, live-matches.ts, competitions.ts
  gemini-prediction.ts, supabase-signup.ts, sync-team-rankings.ts, api-football-live.ts (legado)

data/                    — dados estáticos bundlados (times, jogos, estádios, grupos, competições, seed inicial)
database/migrations/     — migrations SQL numeradas (0001 → 0027), aplicar em ordem
docs/                    — documentação modular por domínio (pré-existente)
utils/                   — funções puras (scoring.ts, translations.ts)
```

---

## 4. Modelo de estado (camada de dados)

### 4.1 DatabaseContext como "banco em memória"

`contexts/DatabaseContext.tsx` é o coração da arquitetura. Funciona como um **espelho do banco em memória**:

- Mantém cada tabela do Supabase como um `useState` array (`users`, `groups`, `matches`, `predictions`, etc.).
- Expõe **ações CRUD** que aplicam **atualização otimista** (muda o estado local primeiro) e depois persistem no Supabase.
- Faz o **fetch inicial** de todas as tabelas no mount (com paginação de 1000 em 1000 via `fetchAllRecords`).
- Mantém um **cache em LocalStorage** (`bolao_db_*`) como fallback, recarregado no startup.
- Assina **Supabase Realtime** (`postgres_changes`) para `matches`, `predictions`, `tournament_predictions`, `extra_phase_predictions`, `user_roles`, `groups`, `user_groups`, `system_config`, `competitions` — atualizando o estado quando outro cliente grava.

### 4.2 Modelos: DB vs UI ("hidratação")

`types.ts` define duas famílias de tipos:

- **`*DB`** (ex.: `UserDB`, `MatchDB`, `PredictionDB`) — formato normalizado, espelho das tabelas.
- **Modelos de UI** (ex.: `User`, `Match`) — versão "hidratada" com dados aninhados para consumo direto pelos componentes.

A **hidratação** (equivalente a um JOIN SQL) acontece nos hooks — principalmente em `useUserSystem.hydratedUsers`, que junta `users` + `user_groups` + `predictions` + `tournament_predictions` + `players` num único objeto `User` por usuário.

### 4.3 Fronteira DB ↔ App importante

- O campo de app `whoClassifiesTeamId` (em `Prediction`/`User.predictions`) mapeia para a coluna DB **`tieWinnerTeamId`**. Conversão acontece em `useUserSystem` (leitura e escrita). Nunca renomear a coluna sem migração.
- Campos de placar de mata-mata usam **colunas planas** (`regularHome/Away`, `extraTimeHome/Away`, `penaltiesHome/Away`) — o JSONB `score` é apenas audit trail e **não deve ser lido diretamente** pela lógica.

---

## 5. Fluxo de dados (alto nível)

```
┌─────────────┐   palpites/CRUD (otimista + persist)   ┌──────────────┐
│  Componentes │ ─────────────────────────────────────► │ DatabaseCtx  │
│  (páginas)   │ ◄───────────── estado hidratado ─────── │ (estado raiz)│
└─────────────┘                                          └──────┬───────┘
       ▲                                                        │ fetch inicial / CRUD
       │ render                                                 ▼
       │                                                  ┌──────────────┐
       │           Realtime push (postgres_changes)       │   Supabase   │
       └────────────────────────────────────────────────►│  PostgreSQL  │
                                                          └──────┬───────┘
                                          escreve resultados     │
                                                                 ▲
                                       ┌─────────────────────────┘
                                       │ syncMatchesAndStandings (admin/background)
                                ┌──────┴───────┐
                                │ Football-Data │  (via proxy /api/*)
                                │     API       │
                                └──────────────┘
```

1. **Startup:** `data/initialData.ts` semeia o estado em memória; LocalStorage hidrata o cache; ao autenticar, o `DatabaseContext` busca tudo do Supabase.
2. **Palpites/ações:** componentes despacham ações do `DatabaseContext` (via hooks) → atualização otimista + persistência no Supabase.
3. **Sync de resultados:** `useSyncSystem`/`useBackgroundSync` chamam a Football-Data, gravam matches/standings/scorers no Supabase e recalculam pontos.
4. **Propagação:** Supabase Realtime empurra mudanças para todos os clientes conectados; `usePollingRefresh` (15s) faz re-leitura defensiva do Supabase.

Detalhamento completo das chamadas externas: `docs/architecture/external-api-calls.md`.

---

## 6. Sistema de sincronização (sync)

| Aspecto | Detalhe |
|---|---|
| Pipeline | `syncMatchesAndStandings(code)` em `hooks/useSyncSystem.ts` |
| Chamadas externas/sync | 4 paralelas (`teams`, `matches`, `standings`, `scorers`) + 1 condicional (`live-matches`, só com jogo ao vivo) |
| Gatilhos | Sync manual (botão Admin), background sync (`useBackgroundSync`, intervalo `sync_interval_ms`), bootstrap de competição (criar grupo de competição nova) |
| Lock distribuído | `acquire_sync_lock` (função PostgreSQL, lock atômico de 60s) evita syncs concorrentes |
| Proxy | Token `FOOTBALL_DATA_TOKEN` injetado no servidor; frontend nunca chama `api.football-data.org` direto |
| Rate limit | Plano free limita req/min; `429` vira `RATE_LIMIT_<s>`. Reduzir frequência é a alavanca principal |

### ⚠️ Limitação conhecida (débito técnico)

O **sync automático só roda enquanto há uma aba do app aberta** de um usuário (admin para sync manual; qualquer usuário logado para background sync). Não há sync 24/7 independente de browser. Solução futura planejada: **Supabase Edge Function + pg_cron**.

---

## 7. Integrações externas

| Serviço | Uso | Onde |
|---|---|---|
| **Supabase** | DB, Auth, Realtime | `services/supabase.ts`, `DatabaseContext` |
| **football-data.org** | Jogos, classificação, artilheiros, elencos | `services/liveScoreService.ts` via `/api/*` |
| **Google Gemini** | Sugestão de palpite por IA | `services/geminiService.ts`, `/api/gemini-prediction` |
| **Google Sign-In** | Auth externo (CDN) | `index.html` |

Provedor alternativo `api-football.com` (`api/api-football-live.ts`) existe como referência mas **não está conectado** a nenhum fluxo.

---

## 8. APIs / endpoints utilizados

### Football-Data (via proxy `/api/*`)

| Caminho frontend | Endpoint upstream | Função |
|---|---|---|
| `/api/teams` | `GET /competitions/{code}/teams` | times + elencos |
| `/api/matches` | `GET /competitions/{code}/matches` | jogos/placares/status/fases |
| `/api/standings` | `GET /competitions/{code}/standings` | classificação |
| `/api/scorers` | `GET /competitions/{code}/scorers` | artilheiros |
| `/api/live-matches` | `GET /matches?status=IN_PLAY` | minuto dos jogos ao vivo |
| `/api/competitions` | `GET /competitions` | lista de competições (admin) |

Padrão de resiliência: tenta com `season`, faz fallback sem `season` em `404/403`.

### Outros endpoints internos

- `/api/gemini-prediction` — previsão IA.
- `/api/supabase-signup` — proxy de cadastro (serverless), com fallback para `supabase.auth.signUp` no client.
- `/api/sync-team-rankings` — ranking estático de seleções.

### Supabase (via SDK)

- Auth: `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`, `onAuthStateChange`.
- Data: `select/insert/update/upsert/delete` por tabela; `rpc('acquire_sync_lock')`.
- Realtime: canal `db-realtime-changes`.

---

## 9. Banco de dados (Supabase / PostgreSQL)

Tabelas principais: `teams`, `team_standings`, `stadiums`, `profiles`, `user_roles`, `groups`, `user_groups`, `matches`, `predictions`, `tournament_predictions`, `extra_phase_predictions`, `players`, `tournament_players`, `competitions`, `system_config`.

Notas relevantes:
- **`teams.code` (TLA) não é único** — sempre upsert por `externalTeamId`.
- Schema configurável via `VITE_SUPABASE_SCHEMA` (usar `dev` em desenvolvimento). Prefixo de tabela via `VITE_DB_TABLE_PREFIX` (ex.: `v2_`).
- RLS habilitado; migrations `0014`/`0015` controlam políticas. Background sync de usuários comuns pode gravar `players`/`tournament_players` (migration `0020`).
- Migrations numeradas em `database/migrations/` (até `0027` — colunas planas de tempo regular/prorrogação).

Detalhes: `docs/database/schema.md`, `docs/database/migrations.md`, `docs/database/rls.md`.

---

## 10. Funcionalidades críticas (resumo)

1. **Pontuação automática** (`utils/scoring.ts` + `usePointsProcessor`) — núcleo do produto; bug aqui corrompe o ranking de todos.
2. **Sync com Football-Data** — fonte da verdade dos resultados; rate-limit e lock são pontos sensíveis.
3. **Auth + hidratação de usuário/grupo** — define o que cada usuário vê (palpites por grupo ativo).
4. **lockDate / travamento de palpites** — impede alteração de palpite após início do jogo/fase.
5. **Realtime + polling** — consistência do ranking entre clientes.

Ver `business-rules.md` para o detalhamento das regras.
