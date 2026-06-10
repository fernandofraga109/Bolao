# Matriz de Casos de Teste — Bolão Copa 2026

> Derivada de `documentacao/architecture.md`, `business-rules.md`, `user-flows.md`, `components.md` e `testing-strategy.md`.
> **Não implementa testes** — é o plano de cobertura. Última análise: 2026-06-10.

## Legenda

- **Prioridade:** `P0` = crítico (corromper isso quebra o produto/ranking), `P1` = importante, `P2` = complementar.
- **Tipo:** 😊 Feliz · ❌ Erro · 🔲 Borda.
- **ID:** `<DOMÍNIO>-<n>` (ex.: `SCORE-01`).

## Índice por prioridade

| Prioridade | Domínios |
|---|---|
| **P0** | Motor de pontuação (SCORE) · Processamento/persistência de pontos (PROC) · Sync (SYNC) · Autenticação (AUTH) · Palpite de partida (PRED) · Travamento de palpites (LOCK) |
| **P1** | Grupos (GROUP) · Palpites especiais (SPEC) · Ranking (RANK) · Realtime & polling (RT) · Admin de jogos/resultados (ADMIN) |
| **P2** | Stats (STATS) · Tabela/bracket (TOURN) · Artilharia (SCORER) · IA Gemini (AI) · Perfil/avatar (PROF) · UX (UX) |

---

# P0 — Funcionalidades críticas

## SCORE — Motor de pontuação (`utils/scoring.ts`)

**Regras de negócio:** R1 base 10/7/5/0 + underdog(≤5) + classifica(+3); R2 por fase (grupos 15/13/10 · ko 15/13/10 · 3º 17/15/12 · final 22/19/16) + placar isolado(+5) + classifica(+3). Regra do empate: empate real nunca dá "diferença". R1 compara só tempo regular; R2 compara regular+prorrogação.
**Dependências:** nenhuma (funções puras). Consumida por PROC e pela UI (cor/label).

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| SCORE-01 | P0 | 😊 | R1 placar exato (2-1 vs 2-1) | 10 pts, categoria `exact` |
| SCORE-02 | P0 | 😊 | R1 diferença certa (3-1 vs 2-0) | 7 pts, `diff` |
| SCORE-03 | P0 | 😊 | R1 resultado certo (3-0 vs 2-1) | 5 pts, `outcome` |
| SCORE-04 | P0 | 😊 | R1 errou (vencedor errado) | 0 pts, `wrong` |
| SCORE-05 | P0 | 🔲 | R1 empate real (pred 2-2, real 1-1) | 5 pts (`outcome`), **nunca** `diff` — Regra 3 |
| SCORE-06 | P0 | 🔲 | R1 empate exato (0-0 vs 0-0) | 10 pts, `exact` |
| SCORE-07 | P0 | 🔲 | Underdog: vencedor com ranking pior por margem > threshold | base + `floor(diff*0.03)` limitado a 5 |
| SCORE-08 | P0 | 🔲 | Underdog em empate real | bônus = 0 (só aplica fora de empate) |
| SCORE-09 | P0 | 🔲 | Underdog acima do teto | clamp em +5 |
| SCORE-10 | P0 | 🔲 | Underdog com `diff <= minRankDiff` | bônus = 0 |
| SCORE-11 | P0 | ❌ | Underdog sem ranking (winner/loser undefined) | bônus = 0 |
| SCORE-12 | P0 | 🔲 | Classifica R1: pred empate + jogo a pênaltis + time correto | +3 |
| SCORE-13 | P0 | ❌ | Classifica R1: pred **não** empate | +0 (condição 1 falha) |
| SCORE-14 | P0 | ❌ | Classifica R1: jogo no tempo regular (`REGULAR`) | +0 (condição 2 falha) |
| SCORE-15 | P0 | ❌ | Classifica R1: time indicado errado | +0 (condição 3 falha) |
| SCORE-16 | P0 | 🔲 | R1 mata-mata: usa tempo regular (1-1 reg, 2-1 prorrog) → pred 1-1 | `exact` sobre o regular |
| SCORE-17 | P0 | 😊 | R2 grupos exato | 15 pts |
| SCORE-18 | P0 | 😊 | R2 ko / 3º / final exato | 15 / 17 / 22 pts |
| SCORE-19 | P0 | 😊 | R2 diferença por fase | 13 / 13 / 15 / 19 |
| SCORE-20 | P0 | 😊 | R2 resultado por fase | 10 / 10 / 12 / 16 |
| SCORE-21 | P0 | 🔲 | R2 placar isolado: único acertador exato no grupo | +5 |
| SCORE-22 | P0 | 🔲 | R2 placar isolado: 2+ acertadores do mesmo placar | +0 |
| SCORE-23 | P0 | 🔲 | R2 placar isolado: bônus não aplica a `diff`/`outcome` | só em `exact` |
| SCORE-24 | P0 | 🔲 | R2 empate real | `outcome`, nunca `diff` (Regra 3) |
| SCORE-25 | P0 | 🔲 | R2 mata-mata usa regular+prorrogação (`match.result`) | categoria sobre placar acumulado |
| SCORE-26 | P0 | 🔲 | `getMatchPhase` mapeia stages EN e grupos pt-BR | groups/ko/third_place/final corretos |
| SCORE-27 | P0 | 🔲 | `getMatchDuration`: pênaltis>prorrog>regular | inferência por colunas planas |
| SCORE-28 | P0 | ❌ | `getMatchDuration` sem colunas planas | fallback para `score.duration` JSONB |
| SCORE-29 | P0 | 🔲 | `getKnockoutAdvancingTeamId` pênaltis (home>away) | id do mandante |
| SCORE-30 | P0 | 🔲 | `getKnockoutAdvancingTeamId` prorrogação (result) | vencedor do placar acumulado |
| SCORE-31 | P0 | 🔲 | `getKnockoutAdvancingTeamId` jogo regular | `undefined` |
| SCORE-32 | P0 | 🔲 | `getR1MatchScoringResult` com colunas planas | retorna `regularHome/Away` |
| SCORE-33 | P0 | ❌ | `getR1MatchScoringResult` sem planas, com JSONB ET | usa `score.regularTime` |
| SCORE-34 | P0 | 🔲 | Torneio R1: campeão/artilheiro/melhor jogador/goleiro | 100 cada, case-insensitive+trim |
| SCORE-35 | P0 | 🔲 | Torneio R2 campeão dividido (1/2/3/4+) | 100/70/50/40 |
| SCORE-36 | P0 | 🔲 | Torneio R2 artilheiro dividido (1/2/3/4+) | 60/40/30/25 |
| SCORE-37 | P0 | 🔲 | Classificados R2: grupo (10) vs mata-mata (5) por acerto | pontos por time correto |
| SCORE-38 | P0 | 🔲 | Palpite extra de fase: acerta jogo de maior diferença | 20 pts |
| SCORE-39 | P0 | 🔲 | Palpite extra: empate de maior diferença (vários jogos) | qualquer um dos máximos vale |
| SCORE-40 | P0 | 🔲 | Palpite extra: override admin tem precedência | usa `biggestGoalDiffMatches[phase]` |
| SCORE-41 | P0 | ❌ | Torneio/extra com `prediction` ou `actual` indefinido | 0 pts |

## PROC — Processamento e persistência de pontos (`usePointsProcessor.ts`)

**Regras:** só pontua `FINISHED` com result não nulo; busca dados frescos do Supabase; grava `predictions.points` + agrega `user_groups.points`; upsert com `defaultToNull:false`; guarda anti-zeramento.
**Dependências:** Supabase (matches/predictions/tournament_predictions/extra_phase_predictions/competitions/user_groups/players), `utils/scoring.ts`, `systemConfig`, `groups.ruleset`.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| PROC-01 | P0 | 😊 | `recalculateUserGroupPoints` soma partidas+torneio para grupo R1 | `user_groups.points` correto por usuário |
| PROC-02 | P0 | 😊 | Recalc grupo R2 inclui placar isolado + palpite de fase | total agrega bônus contextuais |
| PROC-03 | P0 | 🔲 | Ignora jogos não `FINISHED` ou com result nulo | não pontua |
| PROC-04 | P0 | 🔲 | Usa matches frescos do DB, não estado React | resultado independe de estado stale |
| PROC-05 | P0 | ❌ | Erro ao buscar matches → fallback `dbRef.current.matches` | não quebra; usa estado local |
| PROC-06 | P0 | ❌ | Erro ao buscar predictions do grupo | loga e pula o grupo (`continue`) |
| PROC-07 | P0 | 🔲 | Grupo sem predictions mas com pontos existentes | **pula** update (anti-zeramento) |
| PROC-08 | P0 | 🔲 | Upsert preserva `tieWinnerTeamId` (defaultToNull:false) | coluna não vira NULL |
| PROC-09 | P0 | 🔲 | Persiste `predictions.points` só quando muda (`p.points !== pts`) | escrita mínima |
| PROC-10 | P0 | 🔲 | `batchProcessPointsForMatches` coleta grupos afetados e recalcula | chama recalc só dos grupos certos |
| PROC-11 | P0 | 🔲 | `updateLocalPointsWithLive` projeta pontos de jogos LIVE | atualiza local sem persistir |
| PROC-12 | P0 | 🔲 | Threshold underdog: grupo > systemConfig > 10 | precedência correta |
| PROC-13 | P0 | 🔲 | R2: resolve nome do artilheiro via UUID→players | comparação por nome correta |
| PROC-14 | P0 | ❌ | Competição sem resultados oficiais (`tournamentResults` null) | só pontua partidas |
| PROC-15 | P0 | 🔲 | `refetchPredictions` ao final reflete inserts diretos no DB | UI atualizada |

## SYNC — Pipeline de sincronização (`useSyncSystem.ts` / `useBackgroundSync.ts`)

**Regras:** 4 chamadas paralelas + 1 condicional (live); lock atômico 60s; fallback de season; `429`→`RATE_LIMIT_<s>`; só admin (manual) ou qualquer logado (background); persistScorers reaproveita scorers.
**Dependências:** `liveScoreService` (proxy `/api/*`), Supabase (`acquire_sync_lock` RPC, upserts), `usePointsProcessor`.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| SYNC-01 | P0 | 😊 | Sync completo de competição | matches/standings/scorers upsertados + lastSync atualizado |
| SYNC-02 | P0 | 🔲 | Ordem das fases (1→1.5→1.6→2→3→4→5) | sequência respeitada |
| SYNC-03 | P0 | 🔲 | `/api/live-matches` só com jogo IN_PLAY/PAUSED | chamada condicional |
| SYNC-04 | P0 | 🔲 | persistScorers reaproveita scorersData (0 chamada extra) | sem fetch adicional |
| SYNC-05 | P0 | 🔲 | Lock adquirido → libera ao final | `acquire_sync_lock`/`releaseSyncLock` |
| SYNC-06 | P0 | ❌ | Lock já tomado por outro cliente | sync abortado com aviso "já em andamento" |
| SYNC-07 | P0 | ❌ | `429` rate limit | erro `RATE_LIMIT_<segundos>`, toast de aviso |
| SYNC-08 | P0 | ❌ | Endpoint 404/403 com season | refaz fetch sem season (fallback) |
| SYNC-09 | P0 | ❌ | Usuário comum tenta sync manual | bloqueado ("somente admin") |
| SYNC-10 | P0 | 🔲 | Background sync respeita `sync_interval_ms`/lastSync | só sincroniza quando expirou |
| SYNC-11 | P0 | 🔲 | persistScorers falha (try/catch) | não fatal — sync de jogos continua |
| SYNC-12 | P0 | 🔲 | Jogo vira FINISHED no diff | dispara recálculo de pontos |
| SYNC-13 | P0 | 🔲 | Upsert de matches dedup por externalMatchId/id | sem duplicatas |
| SYNC-14 | P0 | 🔲 | `teams.code` não único → upsert por externalTeamId | sem colisão de TLA |

## AUTH — Autenticação (`useUserSystem.ts`)

**Regras:** cadastro com cooldown 15s/e-mail + anti-duplicidade; signup via proxy (fallback SDK); precisa JWT p/ inserts RLS; confirmação de e-mail guarda grupo pendente; sessão persistida.
**Dependências:** Supabase Auth, `/api/supabase-signup`, `DatabaseContext` (addUser/addUserToGroup), LocalStorage.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| AUTH-01 | P0 | 😊 | Cadastro com código de grupo válido | conta criada, perfil, join no grupo, logado |
| AUTH-02 | P0 | ❌ | Cadastro com código inválido | "Código de grupo inválido." |
| AUTH-03 | P0 | ❌ | Cadastro com e-mail já existente | mensagem de e-mail já cadastrado |
| AUTH-04 | P0 | 🔲 | Cadastro repetido < 15s | "Aguarde Xs..." (cooldown) |
| AUTH-05 | P0 | 🔲 | Cadastro em andamento (duplo submit) | "Cadastro já está em andamento." |
| AUTH-06 | P0 | 🔲 | Confirmação de e-mail exigida | guarda `bolao_pending_group_*`, mensagem de confirmação |
| AUTH-07 | P0 | 🔲 | Login pós-confirmação | `resumePendingGroupJoin` completa o join |
| AUTH-08 | P0 | ❌ | Rate limit no signup | "Muitas tentativas... aguarde" |
| AUTH-09 | P0 | 😊 | Login com credenciais corretas | currentUser definido, tab inicial por papel |
| AUTH-10 | P0 | ❌ | Login senha incorreta | mensagem de erro |
| AUTH-11 | P0 | 🔲 | Reload mantém sessão (`getSession`) | usuário continua logado |
| AUTH-12 | P0 | ❌ | Auth nunca resolve | safety net 8s força `authReady` |
| AUTH-13 | P0 | 😊 | Logout | sessão encerrada, estado limpo |
| AUTH-14 | P0 | 🔲 | Usuário DEACTIVATED | bloqueado por `DeactivatedUserModal` |
| AUTH-15 | P0 | 🔲 | Proxy de signup 404 (ambiente local) | fallback `supabase.auth.signUp` |

## PRED — Palpite de partida (`predictMatch`)

**Regras:** palpite por grupo; replica para grupos elegíveis (mesma competição+ruleset); `tieWinnerTeamId` em mata-mata; precisa grupo ativo; trava por lockDate.
**Dependências:** AUTH (currentUser), GROUP (activeGroupId), `upsertPrediction`, LOCK.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| PRED-01 | P0 | 😊 | Salvar palpite no grupo ativo | upsert otimista + persistência |
| PRED-02 | P0 | ❌ | Palpitar sem login | erro "precisa estar logado" |
| PRED-03 | P0 | ❌ | Palpitar sem grupo ativo | erro "entre em um grupo" |
| PRED-04 | P0 | 🔲 | Replicar para grupos alvo elegíveis | grava em cada grupo, sem duplicar o ativo |
| PRED-05 | P0 | 🔲 | Mata-mata empate + quem se classifica | `tieWinnerTeamId` persistido |
| PRED-06 | P0 | 🔲 | Limpar quem se classifica (null) | coluna explicitamente NULL |
| PRED-07 | P0 | 🔲 | Editar palpite existente (upsert) | sobrescreve por (userId,matchId,groupId) |
| PRED-08 | P0 | ❌ | Palpitar jogo já iniciado | bloqueado (ver LOCK) |
| PRED-09 | P0 | 🔲 | Trocar grupo e palpitar | palpite vai para o novo grupo ativo |

## LOCK — Travamento de palpites

**Regras:** trava quando jogo deixa de ser SCHEDULED ou `now > date`; R2 trava fase inteira quando qualquer jogo dela começa; especiais por `lockDate` global.
**Dependências:** matches, relógio, `currentGroup.ruleset`.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| LOCK-01 | P0 | 😊 | Jogo SCHEDULED antes da data | palpite liberado |
| LOCK-02 | P0 | 🔲 | `now > match.date` | palpite travado |
| LOCK-03 | P0 | 🔲 | Status != SCHEDULED (LIVE/FINISHED) | travado |
| LOCK-04 | P0 | 🔲 | R2: 1 jogo da fase começou | toda a fase travada (`phaseLockSet`) |
| LOCK-05 | P0 | 🔲 | Especiais após `lockDate` | travados |
| LOCK-06 | P0 | 🔲 | Banner de pendências lista jogos sem palpite no prazo | aparece corretamente |
| LOCK-07 | P0 | 🔲 | Admin x banner de pendências | tratamento diferenciado (`isAdmin`) |

---

# P1 — Funcionalidades importantes

## GROUP — Grupos (`useGroupSystem.ts` / `App.tsx`)

**Regras:** entrada por código; activeGroupId; elegíveis = mesma competição+ruleset; bootstrap de competição nova dispara sync.
**Dependências:** `DatabaseContext` (groups/user_groups), AUTH, SYNC.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| GROUP-01 | P1 | 😊 | Entrar em grupo por código | join + vira activeGroupId + refetch palpites |
| GROUP-02 | P1 | ❌ | Código inválido | "Código inválido." |
| GROUP-03 | P1 | 🔲 | Entrar em grupo do qual já é membro | apenas switchGroup |
| GROUP-04 | P1 | 😊 | Criar grupo (R1/R2, competição) | grupo criado + criador associado |
| GROUP-05 | P1 | 🔲 | Criar grupo de competição nova | bootstrap sync inicial |
| GROUP-06 | P1 | 🔲 | Criar grupo de competição já registrada | sem bootstrap |
| GROUP-07 | P1 | 😊 | Trocar grupo ativo | activeGroupId atualizado, escopo de palpites/rank muda |
| GROUP-08 | P1 | 🔲 | Grupos elegíveis para replicar | só mesma competição+ruleset, exceto atual |
| GROUP-09 | P1 | 😊 | Excluir grupo (admin) | remove grupo + user_groups; limpa activeGroupId órfão |
| GROUP-10 | P1 | ❌ | Erro ao excluir grupo no DB | propaga erro ao componente |
| GROUP-11 | P1 | 🔲 | Hidratação: viewer vê palpites de terceiros pelo grupo do viewer | filtro por `effectiveGroupId` do viewer |

## SPEC — Palpites especiais (`SpecialsPage` + cards)

**Regras:** campeão limitado às seleções da competição; R2 adiciona classificados de grupo/ko e palpite de fase; tudo por `lockDate`/fase.
**Dependências:** `predictTournament`/`upsertTournamentPrediction`, `upsertExtraPhasePrediction`, players, LOCK, SCORE.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| SPEC-01 | P1 | 😊 | Salvar campeão/melhor jogador/goleiro | tournament_prediction persistido |
| SPEC-02 | P1 | 🔲 | Campeão restrito a `allowedChampionTeamIds` | só seleções da competição |
| SPEC-03 | P1 | 🔲 | Artilheiro via PlayerCombobox (UUID) | `topScorerPlayerId` + goals |
| SPEC-04 | P1 | 🔲 | R2: classificados de grupos (1º/2º) | salvo em `groupClassifications` |
| SPEC-05 | P1 | 🔲 | R2: classificados de mata-mata | salvo corretamente |
| SPEC-06 | P1 | 🔲 | R2: palpite extra de fase | `extra_phase_predictions` upsert |
| SPEC-07 | P1 | ❌ | Salvar especial após lockDate | bloqueado |
| SPEC-08 | P1 | 🔲 | Resolução championId UI↔DB (id vs code) | round-trip consistente |
| SPEC-09 | P1 | 🔲 | Admin não vê tab Especiais | não renderiza |
| SPEC-10 | P1 | 🔲 | OtherUsersPredictions mostra palpites do grupo | lista correta |

## RANK — Ranking (`useLeaderboard.ts` / `LeaderboardPage`)

**Regras:** ranking por grupo ativo, ordenado por pontos; auditoria por partida; cor por categoria.
**Dependências:** PROC (user_groups.points), SCORE (cor/label), matches, predictions.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| RANK-01 | P1 | 😊 | Ranking ordenado desc por pontos | ordem correta |
| RANK-02 | P1 | 🔲 | Empate de pontos | ordenação estável/definida |
| RANK-03 | P1 | 🔲 | Rank do usuário atual (`currentUserRank`) | posição correta (count maiores +1) |
| RANK-04 | P1 | 🔲 | Filtra seção pelo grupo ativo | só membros do grupo |
| RANK-05 | P1 | 🔲 | UserAuditModal: breakdown por partida | categoria/cor/bônus/sub-linhas ET-pênaltis |
| RANK-06 | P1 | 🔲 | Cor deriva da categoria (não de pts) | R2 outcome 10pts não fica dourado |
| RANK-07 | P1 | 🔲 | Toast "+X pts" ao aumentar pontuação | dispara quando `currentUserPoints` sobe |

## RT — Realtime & polling (`DatabaseContext` / `usePollingRefresh`)

**Regras:** Realtime atualiza tabelas; polling 15s relê Supabase sem chamar API externa.
**Dependências:** Supabase Realtime, prefixo/schema configuráveis.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| RT-01 | P1 | 😊 | UPDATE em matches via Realtime | estado local atualiza |
| RT-02 | P1 | 🔲 | INSERT/UPDATE/DELETE em predictions | merge por (userId,groupId,matchId) |
| RT-03 | P1 | 🔲 | DELETE de user_roles | remove usuário + cascata local |
| RT-04 | P1 | 🔲 | Prefixo de tabela (`VITE_DB_TABLE_PREFIX`) | tabela normalizada no handler |
| RT-05 | P1 | 🔲 | Polling 15s relê DB | refetch matches/predictions/user_groups |
| RT-06 | P1 | ❌ | Polling sem usuário/auth | desabilitado |
| RT-07 | P1 | 🔲 | fetch inicial paginado (>1000 linhas) | carrega todas as páginas |
| RT-08 | P1 | 🔲 | Não autenticado | tabelas privadas vazias |

## ADMIN — Admin de jogos/resultados (`AdminMatchCard` / `AdminDashboard` / `AdminSpecialsOverrides`)

**Regras:** edita resultado/regular/prorrogação/pênaltis; deriva `resultHome=regular+ET`; overrides definem gabarito de especiais; ações disparam recálculo.
**Dependências:** `updateMatch`, `adminControls` (finishMatch/updateLiveScore), `updateCompetitionAwards`, PROC.

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| ADMIN-01 | P1 | 😊 | Finalizar jogo com placar | status FINISHED + recálculo |
| ADMIN-02 | P1 | 🔲 | Editar tempo regular/prorrogação/pênaltis | colunas planas salvas |
| ADMIN-03 | P1 | 🔲 | Derivação `resultHome = regular + ET` | preview e salvamento corretos |
| ADMIN-04 | P1 | 🔲 | Zerar jogo (started) | volta a SCHEDULED sem placar |
| ADMIN-05 | P1 | 🔲 | Atualizar placar ao vivo | updateLiveScore + pontos locais |
| ADMIN-06 | P1 | 🔲 | Toggle sync lock por jogo | `syncLocked` persistido |
| ADMIN-07 | P1 | 😊 | Definir resultados oficiais (overrides) | `updateCompetitionAwards` + recálculo especiais |
| ADMIN-08 | P1 | 🔲 | Override de maior diferença por fase | precedência no cálculo de fase |
| ADMIN-09 | P1 | 😊 | Mudar papel de usuário | role atualizado |
| ADMIN-10 | P1 | 😊 | Add/remover usuário de grupo | user_groups atualizado; activeGroupId órfão tratado |
| ADMIN-11 | P1 | ❌ | updateUser retorna 0 linhas | erro "usuário não encontrado" |
| ADMIN-12 | P1 | 🔲 | Toggle auto-sync | `system_config.is_auto_sync_enabled` |
| ADMIN-13 | P1 | 🔲 | Seletor de competição ativa (admin) | escopo muda |

---

# P2 — Funcionalidades complementares

## STATS — Estatísticas (`StatsPage` / `UserStats`)

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| STATS-01 | P2 | 😊 | Resumo de acertos por categoria | contagens corretas |
| STATS-02 | P2 | 🔲 | isExact em jogo de mata-mata | usa base correta por ruleset |
| STATS-03 | P2 | 🔲 | Sub-linhas "Prorrog."/"Pên." | exibidas quando aplicável |
| STATS-04 | P2 | 🔲 | Usuário sem palpites | estado vazio |

## TOURN — Tabela/bracket (`TournamentPage` / `TournamentStandings`)

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| TOURN-01 | P2 | 😊 | Classificação de grupos renderiza | ordenada por pontos/saldo |
| TOURN-02 | P2 | 🔲 | Bracket de mata-mata | confrontos corretos |
| TOURN-03 | P2 | 🔲 | Badge "Prorr."/"Pên. X×Y" | exibido por duração |
| TOURN-04 | P2 | 🔲 | Sem grupo (usuário sem grupo) | lista vazia / CTA |

## SCORER — Artilharia (`TopScoresPage` / `usePlayerSync`)

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| SCORER-01 | P2 | 😊 | Lista de artilheiros por competição | `getTopScorers` ordenado |
| SCORER-02 | P2 | 🔲 | Sync de squads/scorers (admin) | players/tournament_players upsert |
| SCORER-03 | P2 | 🔲 | searchPlayers autocomplete | resultados filtrados por competição |
| SCORER-04 | P2 | ❌ | Competição sem artilheiros | lista vazia |

## AI — Sugestão IA Gemini (`geminiService` / `gemini-prediction`)

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| AI-01 | P2 | 😊 | Sugestão de placar | retorna home/away + reasoning |
| AI-02 | P2 | ❌ | Falha/timeout da API | erro tratado, sem quebrar UI |
| AI-03 | P2 | 🔲 | Sem chave configurada | feature degrada graciosamente |

## PROF — Perfil/avatar (`updateProfile` / `AvatarPicker`)

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| PROF-01 | P2 | 😊 | Atualizar nome/avatar | persistido em user_roles |
| PROF-02 | P2 | ❌ | Nome vazio | "nome não pode ser vazio" |
| PROF-03 | P2 | ❌ | Erro no servidor | mensagem de falha |
| PROF-04 | P2 | 🔲 | Avatar com fallback | `AvatarWithFallback` em URL quebrada |

## UX — Experiência (toasts, pull-to-refresh, modais)

| ID | Prio | Tipo | Cenário | Resultado esperado |
|---|---|---|---|---|
| UX-01 | P2 | 😊 | Pull-to-refresh | refetch geral; desabilitado durante sync |
| UX-02 | P2 | 🔲 | Toasts de sync (syncing/result/warning/info) | tipo correto por evento |
| UX-03 | P2 | 🔲 | WhatsNewModal por `CURRENT_VERSION` | aparece 1x por versão (LocalStorage) |
| UX-04 | P2 | 🔲 | RegulamentoModal (badge R1/R2) | abre regulamento certo |
| UX-05 | P2 | 🔲 | LocalStorage corrompido | `loadTable` faz fallback ao seed |
| UX-06 | P2 | 🔲 | Bandeiras flagcdn fix | URLs quebradas corrigidas por código |

---

## Resumo de cobertura por prioridade

| Domínio | Prio | Casos | Já coberto hoje? |
|---|---|---|---|
| SCORE | P0 | 41 | Parcial (`utils/scoring.test.ts`) |
| PROC | P0 | 15 | ❌ Lacuna |
| SYNC | P0 | 14 | ❌ Lacuna |
| AUTH | P0 | 15 | ❌ Lacuna |
| PRED | P0 | 9 | ❌ Lacuna |
| LOCK | P0 | 7 | Parcial (via MatchesPage) |
| GROUP | P1 | 11 | ❌ Lacuna |
| SPEC | P1 | 10 | Parcial (cards R2) |
| RANK | P1 | 7 | Parcial (`useLeaderboard`/`LeaderboardDetails`) |
| RT | P1 | 8 | ❌ Lacuna |
| ADMIN | P1 | 13 | Parcial (`AdminDashboard`/`AdminSpecialsOverrides`) |
| STATS | P2 | 4 | Parcial (`StatsPage`) |
| TOURN | P2 | 4 | ❌ Lacuna |
| SCORER | P2 | 4 | ❌ Lacuna |
| AI | P2 | 3 | ❌ Lacuna |
| PROF | P2 | 4 | ❌ Lacuna |
| UX | P2 | 6 | ❌ Lacuna |

**Total:** ~175 casos mapeados. Foco imediato sugerido (P0 sem cobertura): **PROC, SYNC, AUTH, PRED**.

> Implementação dos testes deve ser feita pelo agente `test-runner` (ver `documentacao/testing-strategy.md` §2).
