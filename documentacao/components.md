# Telas, Páginas e Componentes — Bolão Copa 2026

> Mapa de componentes a partir de `App.tsx`, `components/` e `contexts/`.
> Última análise: 2026-06-10.

---

## 1. Hierarquia de alto nível

```
index.tsx
└─ DatabaseProvider (contexts/DatabaseContext.tsx) — estado raiz
   └─ App.tsx — orquestrador (hooks, tabs, gating por papel)
      ├─ SplashScreen        (authReady === false)
      ├─ Login               (sem usuário / recovery)
      ├─ DeactivatedUserModal(usuário DEACTIVATED)
      └─ App principal:
         ├─ Header
         ├─ Barra de Grupo / Competição  (+ PendingPredictionsBanner)
         ├─ GroupSwitcher (modal)
         ├─ <main> → Página da tab ativa
         ├─ WhatsNewModal / RegulamentoModal
         ├─ SyncToastContainer
         └─ BottomNav
```

---

## 2. Layout compartilhado

| Componente | Papel |
|---|---|
| `Header.tsx` | Topo: identidade do usuário, pontos/rank, info de sync, editar perfil, logout |
| `BottomNav.tsx` | Navegação por tabs (varia por papel) |
| `PendingPredictionsBanner.tsx` | Alerta de jogos/fases sem palpite antes do prazo |
| `GroupSwitcher.tsx` | Modal para entrar/criar/trocar de grupo |
| `GroupSelection.tsx` | Seleção/criação de grupo |
| `RulesSection.tsx` | Seção de regras |
| `RegulamentoModal.tsx` | Modal com o regulamento (R1/R2) |

---

## 3. Páginas (`components/pages/`)

Uma view completa por tab. Recebem dados via props do `App.tsx` (estado já hidratado).

| Página | Tab | Conteúdo principal | Acesso |
|---|---|---|---|
| `MatchesPage.tsx` | Jogos | Lista de partidas, palpites, sync manual, view admin | Todos |
| `TournamentPage.tsx` | Tabela | Classificação de grupos + bracket mata-mata | Todos |
| `SpecialsPage.tsx` | Especiais | Cards de palpites de torneio/fase (R1 e R2) | Usuário comum |
| `LeaderboardPage.tsx` | Rank | Ranking do grupo ativo + auditoria de pontos | Usuário comum |
| `StatsPage.tsx` | Stats | Desempenho do usuário por categoria | Usuário comum |
| `AdminPage.tsx` | Admin | Wrapper de `AdminDashboard` | Admin |

---

## 4. Partidas e placares

| Componente | Papel |
|---|---|
| `MatchCard.tsx` | Card de partida: inputs de palpite, badge de pontos/categoria/cor, label "Placar Isolado", bloco prorrogação/pênaltis, seletor "quem se classifica" |
| `AdminMatchCard.tsx` | Card admin dedicado: edita resultado, tempo regular, prorrogação e pênaltis inline; deriva `resultHome` e dispara recálculo |
| `ReplicatePredictionModal.tsx` | Replicar um palpite para grupos elegíveis |

---

## 5. Palpites especiais (`components/specials/` e raiz)

| Componente | Papel |
|---|---|
| `specials/TournamentPredictionsCard.tsx` | Campeão, artilheiro, melhor jogador/goleiro |
| `specials/PlayerCombobox.tsx` | Autocomplete de jogador (busca em `players`) |
| `specials/OtherUsersPredictions.tsx` | Palpites especiais dos outros membros |
| `GroupClassificationsCard.tsx` | (R2) Classificados 1º/2º de cada grupo |
| `KnockoutClassificationsCard.tsx` | (R2) Classificados por fase de mata-mata |
| `ExtraPhasePredictionsCard.tsx` | (R2) Jogo com maior diferença de gols por fase |

---

## 6. Ranking, torneio e estatísticas

| Componente | Papel |
|---|---|
| `Leaderboard.tsx` | Lista de ranking ordenada por pontos |
| `LeaderboardDetails.tsx` | Detalhe/auditoria do ranking |
| `UserAuditModal.tsx` | Breakdown de pontos por partida (categoria, bônus, sub-linhas ET/pênaltis) |
| `UserStats.tsx` | Estatísticas agregadas do usuário |
| `TournamentStandings.tsx` | Tabela de classificação + bracket; badges "Prorr."/"Pên." |
| `topscores/TopScoresPage.tsx` | Aba de artilharia |
| `topscores/ScorerRow.tsx` | Linha de artilheiro (gols/assists/pênaltis) |

---

## 7. Administração

| Componente | Papel |
|---|---|
| `AdminDashboard.tsx` | Painel: usuários, grupos, sync, status por competição |
| `AdminSpecialsOverrides.tsx` | Define resultados oficiais (gabarito dos palpites especiais) |
| `UserAuditModal.tsx` | (reuso) auditoria de pontos de um usuário |

---

## 8. Primitivos de UI (`components/ui/`)

| Componente | Papel |
|---|---|
| `ScoringGuide.tsx` | Guia visual de pontuação + **fonte única de `SCORING_COLORS`** (cor por categoria) |
| `SyncToast.tsx` | Sistema de toasts de sync (`useSyncToast`, `SyncToastContainer`) |
| `WhatsNewModal.tsx` | Modal "Novidades" baseado em `CURRENT_VERSION` |
| `SplashScreen.tsx` | Tela de carregamento inicial (auth) |
| `PullToRefreshIndicator.tsx` | Indicador visual do pull-to-refresh |
| `ModalShell.tsx` | Casca padrão de modal |
| `DualActionButtons.tsx` | Par de botões de ação (confirmar/cancelar) |
| `AvatarPicker.tsx` / `AvatarWithFallback.tsx` | Seleção e exibição de avatar |
| `UserIdentity.tsx` | Nome + avatar do usuário |

Outros modais raiz: `DeactivatedUserModal.tsx`, `Login.tsx`.

---

## 9. Hooks consumidos pelos componentes

Componentes **não chamam Supabase diretamente** — sempre via `useDatabase()` ou hooks de domínio.

| Hook | Exposição usada na UI |
|---|---|
| `useUserSystem` | `currentUser`, `login/register/logout`, `predictMatch`, `predictTournament`, `adminActions` |
| `useMatchSystem` | `matches`, `lockDate`, `syncWithExternalApi`, `adminControls`, `isAutoSyncEnabled` |
| `useGroupSystem` | `createGroup`, `getGroupByCode`, `getGroupById` |
| `useLeaderboard` | `leaderboardSections`, `usersWithCalculatedPoints` |
| `useDatabase` | tabelas + CRUD + `refetch*` + `players`/`searchPlayers`/`getTopScorers` |
| `usePullToRefresh` / `useSyncToast` | UX (gesto e toasts) |

---

## 10. Convenções de componentização

- **Estado vive nos hooks; componentes só renderizam e despacham** ações.
- **Tipos compartilhados em `types.ts`** — sem interfaces inline.
- **Cor da pontuação** sempre via `SCORING_COLORS` derivado da **categoria** retornada por `utils/scoring.ts` (nunca por threshold de pontos).
- **Gating por papel** centralizado em `App.tsx` (tabs e páginas condicionais por `currentUser.role`).
- Texto de UI em **pt-BR**.
