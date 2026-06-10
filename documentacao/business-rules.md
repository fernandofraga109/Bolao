# Regras de Negócio — Bolão Copa 2026

> Regras explícitas e implícitas extraídas do código (`utils/scoring.ts`, `hooks/usePointsProcessor.ts`, `hooks/useUserSystem.ts`, `App.tsx`).
> Última análise: 2026-06-10.

---

## 1. Conceitos fundamentais

- **Grupo (`groups`)**: unidade de competição entre amigos. Possui `code` (entrada), `competitionCode` (ex.: `WC`) e **`ruleset`** (`regulamento_1` ou `regulamento_2`).
- **Palpite de partida (`predictions`)**: placar `home`/`away` por usuário, **por grupo** e por partida. Pode incluir `tieWinnerTeamId` (quem se classifica no mata-mata).
- **Palpite especial / de torneio (`tournament_predictions`)**: campeão, artilheiro, melhor jogador/goleiro, classificados, etc. — escopo por grupo.
- **Palpite extra de fase (`extra_phase_predictions`)**: só no Regulamento 2 — jogo com maior diferença de gols por fase.
- **Competição**: armazena os **resultados oficiais** (campeão, artilheiro, classificados) usados como gabarito da pontuação especial.

A pontuação é **sempre relativa ao grupo ativo** do usuário. O mesmo palpite pode ser replicado para múltiplos grupos elegíveis (mesma competição + mesmo ruleset).

---

## 2. Regulamento 1 (padrão) — pontuação de partidas

Pontuação **stateless** (não depende dos palpites dos outros). Implementada em `getScoreCategoryRegulamento1` / `calculatePoints`.

### Categorias e pontos base

| Categoria | Base | + Underdog | + Classifica | Máximo |
|---|---|---|---|---|
| Placar Exato | 10 | até +5 | +3 | **18** |
| Diferença certa | 7 | até +5 | +3 | **15** |
| Resultado certo | 5 | até +5 | +3 | **13** |
| Errou | 0 | — | — | **0** |

Constantes: `POINTS_EXACT=10`, `POINTS_GOAL_DIFF=7`, `POINTS_OUTCOME=5`, `POINTS_WRONG=0`, `POINTS_CLASSIFIES_BONUS=3`.

### Algoritmo de categorização

1. **Exato** → `predHome===realHome && predAway===realAway`.
2. Se o **resultado** (vencedor/empate) bate:
   - **Regra 3 (empate real):** se o resultado real é empate, nunca dá "Diferença certa" — no máximo "Resultado certo". Ex.: palpite 2-2 num jogo 1-1 → 5 pts (não 7).
   - Senão, se a **diferença de gols** bate (`predH-predA === realH-realA`) → "Diferença certa".
   - Senão → "Resultado certo".
3. Caso contrário → **Errou (0)**.

### Bônus Underdog (até +5)

`calculateUnderdogBonus`:
- Só quando **não** é empate real.
- `bonus = floor((rankPerdedor_pos − rankVencedor_pos) * 0.03)` quando o vencedor tem ranking **pior** (número maior) que o perdedor, limitado a `MAX_UNDERDOG_BONUS=5`.
- Threshold mínimo de diferença de ranking configurável: `group.underdog_min_rank_diff` → fallback `systemConfig.underdog_min_rank_diff` → fallback `10` (no processador) / `0` (na função pura).

### Bônus "Quem se Classifica" (+3) — mata-mata

Concedido **somente** quando TODAS as condições:
1. Palpite é **empate** (`predHome === predAway`).
2. Jogo foi à **prorrogação ou pênaltis** (`getMatchDuration(match) !== 'REGULAR'`).
3. O time indicado pelo usuário (`tieWinnerTeamId`) é o que **realmente avançou** (`getKnockoutAdvancingTeamId`).

### Base de comparação em mata-mata (R1)

R1 compara **somente o tempo regular (90 min)** — `getR1MatchScoringResult` lê `regularHome/regularAway` (fallback JSONB `score.regularTime`). A prorrogação **não conta** para a categoria de placar no R1.

---

## 3. Regulamento 2 ("Bolão do Mesa 2026") — pontuação de partidas

Pontuação **state-aware**: depende do contexto de todos os palpites do grupo (bônus "Placar Isolado") e da **fase** da partida. Implementada em `getScoreCategoryRegulamento2` / `calculatePointsRegulamento2`.

### Tabela por fase

| Categoria | Grupos | Oitavas/Quartas/Semi (`ko`) | 3º Lugar | Final |
|---|---|---|---|---|
| Placar Exato | 15 | 15 | 17 | 22 |
| Diferença certa | 13 | 13 | 15 | 19 |
| Resultado certo | 10 | 10 | 12 | 16 |
| Errou | 0 | 0 | 0 | 0 |
| ✨ Placar Isolado (bônus) | +5 | +5 | +5 | +5 |

### Bônus "Placar Isolado" (+5)

Só no caso de **Placar Exato**: concedido se o usuário for **o único** no grupo a cravar exatamente aquele placar naquela partida (`exactHits.length === 1`).

### Bônus "Quem se Classifica" (+3) — R2

Mesma regra do R1 (palpite empate + jogo decidido fora do tempo regular + time correto). Diferença: no R2 a **base de comparação é `regularTime + extraTime`** (`match.result`) — a prorrogação **conta**.

### Regra 3 (empate real)

Igual ao R1 — em empate real não há "Diferença certa".

### Mapeamento de fases (`getMatchPhase`)

| Stage da API | Fase interna |
|---|---|
| `GROUP_STAGE`, `REGULAR_SEASON` | `groups` |
| `ROUND_OF_16`, `QUARTER_FINALS`, `SEMI_FINALS` | `ko` |
| `THIRD_PLACE` | `third_place` |
| `FINAL` | `final` |

Também reconhece nomes de grupo em pt-BR (`OITAVAS`, `QUARTAS`, `SEMI`, `TERCEIRO/3º`).

---

## 4. Palpites especiais / de torneio

### Regulamento 1 (stateless) — `calculateTournamentPoints`

| Categoria | Pontos |
|---|---|
| Campeão | 100 |
| Artilheiro (nome) | 100 |
| Artilheiro (gols) | 100 |
| Melhor jogador | 100 |
| Melhor goleiro | 100 |

Comparação de nomes é case-insensitive e trim. Gols exigem igualdade exata.

### Regulamento 2 (state-aware, pontos divididos) — `calculateTournamentPointsRegulamento2`

**Campeão** (divide conforme nº de acertadores no grupo):

| Acertadores | Pts |
|---|---|
| 1 | 100 |
| 2 | 70 |
| 3 | 50 |
| 4+ | 40 |

**Artilheiro**:

| Acertadores | Pts |
|---|---|
| 1 | 60 |
| 2 | 40 |
| 3 | 30 |
| 4+ | 25 |

**Outros especiais R2:**

| Categoria | Pontos |
|---|---|
| Classificados dos grupos (1º/2º) | 10 por time correto |
| Classificados 2ª fase (Oitavas/Quartas/Semis) | 5 por time correto |
| Seleção com mais gols num jogo | 20 |
| Seleção que tomou mais gols num jogo | 20 |
| Jogo com maior diferença por fase (palpite extra) | 20 |

### Palpite extra de fase — `calculateExtraPhasePoints`

- Acerta o jogo com **maior diferença de gols** dentro da fase → 20 pts.
- Em empate de maior diferença, qualquer jogo com a diferença máxima conta.
- **Override admin**: se o admin definiu manualmente o jogo correto (`competitions.biggestGoalDiffMatches[phase]`), ele tem precedência sobre o cálculo automático.

---

## 5. Travamento de palpites (lockDate)

- Cada partida tem um **prazo** ligado à `date`. Palpites de partida travam quando o jogo deixa de estar `SCHEDULED` ou quando `now > match.date`.
- **Regulamento 2 — trava por fase:** quando **qualquer** jogo de uma fase começou, toda a fase é considerada travada (`phaseLockSet` em `App.tsx`) para palpites especiais relacionados àquela fase.
- Palpites especiais/torneio usam um `lockDate` global da competição.
- Admins não ficam sujeitos ao banner de pendências da mesma forma (passam `isAdmin`).

---

## 6. Regras de pontuação operacionais (processamento)

`hooks/usePointsProcessor.ts`:

- **Fonte sempre fresca:** o recálculo (`recalculateUserGroupPoints`) busca matches/predictions **direto do Supabase**, nunca do estado React, para evitar dados velhos durante sync assíncrono.
- Só pontua partidas **`FINISHED`** com `resultHome`/`resultAway` não nulos (exceto `updateLocalPointsWithLive`, que projeta pontos de jogos `LIVE` localmente para feedback imediato).
- Pontos são gravados em `predictions.points` **e** agregados em `user_groups.points` por grupo.
- **Upsert seguro:** usa `defaultToNull: false` para não zerar colunas ausentes do body (ex.: `tieWinnerTeamId`).
- **Guarda anti-zeramento:** se o grupo não tem predictions mas já tem pontos persistidos, o update é pulado (evita zerar ranking por leitura parcial).

---

## 7. Regras de grupos e usuários

- **Entrada em grupo:** por `code`. Ao entrar, o grupo vira o `activeGroupId` do usuário.
- **Grupos elegíveis para replicar palpite:** mesmo `competitionCode` **e** mesmo `ruleset`, dos quais o usuário é membro, exceto o atual.
- **Bootstrap de competição:** criar grupo de uma competição ainda não registrada dispara um sync inicial (`syncMatchesAndStandings`) para popular jogos/classificação.
- **Papéis:** `ADMIN`, `USER`, `DEACTIVATED`. Admin vê a tab Admin (e não vê Especiais/Rank/Stats); usuário desativado é bloqueado por modal.
- **Cadastro:** cooldown de 15s por e-mail e guarda anti-duplicidade. Cria conta via proxy `/api/supabase-signup` (fallback `supabase.auth.signUp`); se exigir confirmação de e-mail, guarda o grupo pendente para join pós-confirmação.
- **Campeão (UI vs DB):** `championTeamId` é resolvido entre `id` e `code` do time na leitura/escrita (`resolveChampionIdForUi/Db`).

---

## 8. Regras implícitas / invariantes importantes

1. **Palpite é sempre por grupo.** A hidratação filtra predictions pelo `effectiveGroupId` do viewer — predictions de outros usuários são lidas pelo grupo ativo do **viewer**, não do dono (LocalStorage do dono não existe no device do viewer).
2. **Cor da pontuação deriva da categoria**, não de thresholds de pontos. Isso evita que um "Resultado certo R2" (10 pts) seja pintado de dourado por coincidir com o valor de "Exato R1".
3. **JSONB `score` é audit trail** — a lógica usa as colunas planas. `getMatchDuration` infere duração: `penaltiesHome != null` → pênaltis; `extraTimeHome != null` → prorrogação; senão regular.
4. **`teams.code` não é único** — identidade de time é `externalTeamId`.
5. **Sync depende de aba aberta** (débito conhecido) — sem ninguém com o app aberto, resultados não atualizam.
6. **Lock de sync de 60s** evita corrida entre o sync de vários clientes simultâneos.
7. **Realtime + polling 15s** são redundância intencional: o polling cobre eventos que o Realtime eventualmente perde.

---

## 9. Configuração global (`system_config`)

| Campo | Função | Default |
|---|---|---|
| `is_auto_sync_enabled` | Liga/desliga o background sync | `false` |
| `sync_interval_ms` | Intervalo do background sync | 20000 (config) / 5 min efetivo |
| `underdog_min_rank_diff` | Threshold global do bônus underdog | 0/10 |

Singleton com `id` fixo `00000000-0000-0000-0000-000000000001`.
