# Fluxos de Negócio (User Flows) — Bolão Copa 2026

> Fluxos ponta-a-ponta mapeados a partir de `App.tsx`, `useUserSystem`, `useMatchSystem`, `usePointsProcessor` e páginas.
> Última análise: 2026-06-10.

---

## Mapa de navegação (tabs)

A navegação é feita por `components/BottomNav.tsx`. As tabs disponíveis dependem do papel:

| Tab | Ícone | Usuário comum | Admin |
|---|---|---|---|
| Jogos (`matches`) | Calendar | ✅ | ✅ |
| Tabela (`tournament`) | Table2 | ✅ | ✅ |
| Especiais (`specials`) | Sparkles | ✅ | ❌ |
| Rank (`leaderboard`) | Trophy | ✅ | ❌ |
| Stats (`stats`) | Activity | ✅ | ❌ |
| Admin (`admin`) | ShieldCheck | ❌ | ✅ |

Estados de tela acima das tabs: `SplashScreen` (auth carregando) → `Login` (deslogado/recovery) → `DeactivatedUserModal` (usuário desativado) → app principal.

---

## Fluxo 1 — Cadastro (registro)

```
Usuário em Login (modo registro)
  └─ informa nome, e-mail, senha, CÓDIGO DO GRUPO
       ▼
register() [useUserSystem]
  ├─ valida código do grupo (memória → fallback DB)
  ├─ cooldown 15s/e-mail + guarda anti-duplicidade
  ├─ cria conta via /api/supabase-signup (fallback supabase.auth.signUp)
  ├─ signInWithPassword (precisa de JWT p/ inserts RLS)
  │     └─ se exigir confirmação de e-mail → salva grupo pendente, encerra
  ├─ ensureProfileForAuthUser → cria perfil (user_roles)
  ├─ addUserToGroup + updateUser(activeGroupId)
  └─ define currentUser → entra no app
```

Pós-confirmação de e-mail: `resumePendingGroupJoin` completa o join do grupo pendente no próximo login.

---

## Fluxo 2 — Login

```
Login (e-mail + senha)
  └─ loginWithCredentials → supabase.auth.signInWithPassword
       ├─ erro → mensagem
       └─ sucesso → ensureProfileForAuthUser → login(user)
                     └─ tab inicial: ADMIN→"admin", senão "matches"
```

Sessão persistida; no reload, `syncSession` recupera via `getSession` e `onAuthStateChange`. Safety net de 8s força `authReady` se a auth travar.

---

## Fluxo 3 — Recuperação de senha

```
Login → "Esqueci a senha" → requestPasswordReset(email)
  └─ supabase.auth.resetPasswordForEmail(redirectTo=...?mode=recovery)
       ▼ (usuário clica no link do e-mail)
App detecta mode=recovery (usePasswordRecovery + onAuthStateChange PASSWORD_RECOVERY)
  └─ Login em modo RESET_PASSWORD_CONFIRM → updatePassword(novaSenha)
       └─ supabase.auth.updateUser({password}) → finishPasswordRecoveryFlow
```

---

## Fluxo 4 — Entrar em / trocar de grupo

```
Barra de grupo (header) → GroupSwitcher
  ├─ ENTRAR por código: handleJoinGroup(code)
  │     ├─ já é membro → switchGroup
  │     └─ não é → joinGroup (vira activeGroupId)
  │     └─ (admin) dispara syncMatchesAndStandings da competição
  │     └─ refetchPredictions (recarrega palpites do novo grupo)
  ├─ TROCAR: switchGroup(userId, groupId) → updateUser(activeGroupId) + LocalStorage
  └─ CRIAR: handleCreateGroup(name, competitionCode, ruleset)
        └─ createGroupWithCompetitionBootstrap
              ├─ createGroup + joinGroup
              └─ se competição nova → sync inicial (bootstrap)
```

Trocar de grupo recarrega os palpites e recalcula o ranking exibido (escopo muda para o novo grupo).

---

## Fluxo 5 — Palpitar em uma partida (núcleo)

```
Tab Jogos (MatchesPage) → MatchCard
  ├─ usuário digita placar home/away
  ├─ (mata-mata + palpite empate) seleciona "quem se classifica" (tieWinnerTeamId)
  ├─ (opcional) sugestão IA via Gemini
  ├─ (opcional) replicar para grupos elegíveis (ReplicatePredictionModal)
  └─ onPredict → predictMatch(matchId, home, away, targetGroupIds?, whoClassifiesTeamId?)
        └─ upsertPrediction (otimista local + upsert Supabase)
              ├─ grupo ativo sempre
              └─ + cada grupo alvo elegível
```

Restrições:
- Precisa estar logado e ter grupo ativo.
- Palpite trava após início do jogo (e, no R2, após início da fase).
- `PendingPredictionsBanner` alerta sobre jogos/fases sem palpite antes do prazo.

---

## Fluxo 6 — Palpites especiais (Tab Especiais)

```
SpecialsPage (somente usuário comum)
  ├─ TournamentPredictionsCard: campeão, artilheiro (PlayerCombobox), melhor jogador/goleiro
  │     └─ onPredictTournament → predictTournament → upsertTournamentPrediction
  └─ (somente R2):
        ├─ GroupClassificationsCard       (1º/2º de cada grupo)
        ├─ KnockoutClassificationsCard     (classificados por fase)
        └─ ExtraPhasePredictionsCard       (jogo de maior diferença por fase)
```

Tudo travado por `lockDate` (e por fase no R2). Campeão limitado às seleções da competição (`allowedChampionTeamIds`).

---

## Fluxo 7 — Sincronização de resultados (sync)

```
GATILHO: sync manual (Admin) | background sync (qualquer logado) | bootstrap de competição
   ▼
acquireSyncLock(code) — lock atômico 60s (evita corrida)
   ▼
syncMatchesAndStandings(code):
   FASE 1  → Promise.all: /api/teams, /api/matches, /api/standings, /api/scorers
   FASE 1.5→ upsert competição (extrai topScorer)
   FASE 1.6→ persistScorers (players + tournament_players) — 0 chamada externa
   FASE 2  → upsert de times novos/atualizados
   FASE 3  → diff de jogos (+ /api/live-matches se houver IN_PLAY) → upsert matches
   FASE 4  → upsert standings + cálculo de pontos
   FASE 5  → recalcular user_groups + atualizar lastSync
   ▼
releaseSyncLock(code)
   ▼
Supabase Realtime → todos os clientes atualizam (matches/predictions/user_groups)
```

`usePollingRefresh` (15s) faz re-leitura defensiva do Supabase, **sem** chamar a API externa.

---

## Fluxo 8 — Pontuação automática (após resultado)

```
Jogo vira FINISHED (sync ou admin)
   ▼
batchProcessPointsForMatches(finishedMatches)  [usePointsProcessor]
   └─ para cada palpite: calcula pts (R1/R2) → coleta grupos afetados
        ▼
recalculateUserGroupPoints(groupIds):
   ├─ busca matches/predictions FRESCOS do Supabase
   ├─ soma: pontos de partidas + torneio + (R2) palpite de fase
   ├─ upsert user_groups.points  (ranking)
   └─ upsert predictions.points  (detalhe por palpite)
   ▼
Realtime propaga → ranking e badges atualizam em todos os clientes
   └─ App.tsx detecta aumento de pontos do usuário → toast "+X pts!"
```

Durante jogos ao vivo, `updateLocalPointsWithLive` projeta pontos localmente (feedback imediato, sem persistir).

---

## Fluxo 9 — Administração (Tab Admin)

```
AdminPage → AdminDashboard
  ├─ Gestão de usuários: convidar, mudar papel, remover, add/remove de grupo
  ├─ Gestão de grupos: criar, excluir
  ├─ Sync: manual por competição, toggle auto-sync, status por competição
  ├─ AdminMatchCard (na tab Jogos): editar resultado, tempo regular, prorrogação, pênaltis
  │     └─ deriva resultHome = regularHome + extraTimeHome → finishMatch/updateLiveScore
  ├─ AdminSpecialsOverrides: define resultados oficiais (campeão, artilheiro, classificados,
  │     maior diferença por fase) — gabarito da pontuação especial
  └─ Sync de jogadores/artilheiros (squads/scorers)
```

Ações de admin (resultado de jogo, overrides) disparam recálculo de pontos.

---

## Fluxo 10 — Ver ranking e estatísticas

```
Tab Rank (LeaderboardPage)
  └─ leaderboardSections do grupo ativo → ordena por pontos
        └─ LeaderboardDetails / UserAuditModal: breakdown de pontos por partida
              (categoria, cor, bônus, sub-linhas prorrogação/pênaltis)

Tab Stats (StatsPage)
  └─ desempenho do usuário: acertos por categoria, histórico de palpites

Tab Tabela (TournamentPage)
  └─ classificação dos grupos + bracket de mata-mata (TournamentStandings)
        └─ placar com badges "Prorr." / "Pên. X×Y" quando aplicável
```

---

## Estados transversais (UX)

- **Pull-to-refresh** (`usePullToRefresh`) → `handleRefreshData` (refetch matches/predictions/standings/user_groups).
- **Toasts de sync** (`SyncToast`) → início/resultado/aviso de cada sync.
- **What's New** (`WhatsNewModal`) → exibido quando `CURRENT_VERSION` muda (controle via LocalStorage `bolao_last_seen_version`).
- **Regulamento** (`RegulamentoModal`) → aberto pelo badge R1/R2 na barra de grupo.
