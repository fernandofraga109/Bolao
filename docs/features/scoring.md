# Sistema de Pontuação

O sistema suporta dois regulamentos diferentes, configuráveis por grupo (`groups.ruleset`).

---

## Regulamento 1 (Padrão)

Sistema de pontuação simples com bônus para underdogs.

### Pontuação de Partida

| Categoria | Pontos |
|---|---|
| Placar Exato | 10 |
| Diferença de Gols | 7 |
| Resultado (vencedor/empate) | 5 |
| Bônus Underdog | até +5 |

**Regra 3 — Empates:** Quando o resultado real é empate, a categoria "Diferença de Gols" nunca se aplica — o máximo é "Resultado" (5 pts), independentemente de a diferença prevista ser 0. Assim, prever 2-2 num jogo que terminou 1-1 vale 5 pts, não 7.

### Jogos de Mata-Mata (Prorrogação e Pênaltis)

**Base de comparação:** somente o placar do **Tempo Regular** (90 min). A prorrogação não conta para o cálculo de pontos no R1.

Exemplos com Brasil 1×1 Argentina 90' → 2×1 após prorrogação → Argentina vence 4-3 nos pênaltis:

| Palpite | Pontos R1 |
|---|---|
| 1-1 | 10 (exato) |
| 1-1 + Argentina classifica | 13 (+3 bônus classifica) |
| 2-1 | 0 (errou) |
| 0-0 | 5 (resultado — empate) |

**Bônus "Quem se Classifica" (+3 pts):** Em jogos de mata-mata, quando o palpite é empate, o usuário pode opcionalmente indicar qual equipe avança. Se o jogo terminar nos pênaltis e a escolha estiver correta, recebe +3 pts. Opcional — não prejudica quem não preencher.

- Campo no DB: `predictions.tieWinnerTeamId` (coluna), `whoClassifiesTeamId` (nome TypeScript)
- Constante: `POINTS_CLASSIFIES_BONUS = 3`

### Display no MatchCard (R1, mata-mata)

Quando a partida vai à prorrogação ou pênaltis, o card exibe três seções empilhadas:
1. **Placar principal** — resultado do Tempo Regular, label "Tempo Regular"
2. **"Após Prorrogação"** — placar ao fim dos 120 min (`match.result`)
3. **"Disputa de Pênaltis"** — resultado dos pênaltis + vencedor (se houver)

O R2 exibe apenas o placar de `match.result` (regularTime + extraTime) como único resultado.

### Bônus Underdog

Até +5 pts quando equipe pior rankeada vence. Calculado via `calculateUnderdogBonus` com `UNDERDOG_BONUS_FACTOR = 0.03` e `MAX_UNDERDOG_BONUS = 5`. Configurável por grupo (`underdog_min_rank_diff`).

### Pontuação de Torneio

- Campeão: 100 pts
- Artilheiro (nome): 100 pts
- Artilheiro (gols): 100 pts
- Melhor Jogador: 100 pts
- Melhor Goleiro: 100 pts

---

## Regulamento 2 (Bolão do Mesa 2026)

Sistema de pontuação dinâmico — pontos dependem do contexto de todos os palpites do grupo.

### Regra de Empate (Rule 3)

Igual ao R1: quando o resultado real é empate, não há pontuação por "Resultado + Diferença". Palpite 2-2 num jogo 1-1 vale apenas 10 pts (Resultado), não 13.

### Base de comparação (Mata-mata)

R2 usa `regularTime + extraTime` (`match.result`). A prorrogação **conta** para pontuação no R2 (conforme regulamento item 2).

### Fase de Grupos

| Categoria | Pontos |
|---|---|
| Resultado | 10 |
| Resultado + Diferença | 13 (nunca em empates) |
| Placar Exato | 15 |
| Placar Isolado (bônus) | +5 |
| Classificados (G2) | 10 por acerto |

### Segunda Fase (Oitavas, Quartas, Semi)

| Categoria | Pontos |
|---|---|
| Resultado | 10 |
| Resultado + Diferença | 13 |
| Placar Exato | 15 |
| Placar Isolado | +5 |
| Classificado | 5 |

### Disputa de 3º Lugar

| Categoria | Pontos |
|---|---|
| Resultado | 12 |
| Resultado + Diferença | 15 |
| Placar Exato | 17 |
| Placar Isolado | +5 |

### Final

| Categoria | Pontos |
|---|---|
| Resultado | 16 |
| Resultado + Diferença | 19 |
| Placar Exato | 22 |
| Placar Isolado | +5 |

### Pontuação de Torneio (Dividida)

**Campeão:**
- 1 acerto: 100 pts | 2: 70 | 3: 50 | 4+: 40

**Artilheiro:**
- 1 acerto: 60 pts | 2: 40 | 3: 30 | 4+: 25

**Palpites Extras:** 20 pts cada (maior goleada, mais gols sofridos, jogo com maior diferença por fase)

---

## Implementação

### Arquivos Principais

| Arquivo | Responsabilidade |
|---|---|
| `utils/scoring.ts` | Funções puras de cálculo (ambos regulamentos) |
| `hooks/usePointsProcessor.ts` | Processa e persiste pontos no DB |
| `hooks/useLeaderboard.ts` | Calcula totais para exibição no leaderboard |
| `components/UserAuditModal.tsx` | Exibe breakdown de pontos por partida |

### Funções Chave (`utils/scoring.ts`)

| Função | Uso |
|---|---|
| `getScoreCategoryRegulamento1` | Retorna tipo + bônus para R1 |
| `calculatePoints` | Total de pontos R1 |
| `getScoreCategoryRegulamento2` | Retorna tipo + aloneBonus para R2 |
| `calculatePointsRegulamento2` | Total de pontos R2 (context-aware) |
| `getR1MatchScoringResult` | Extrai regularTime para comparação R1 em mata-mata |
| `getMatchPhase` | Mapeia stage/group → MatchPhase |
| `calculateUnderdogBonus` | Bônus por ranking para R1 |

### `getR1MatchScoringResult`

Retorna o placar de comparação correto para R1. Para jogos com `duration = EXTRA_TIME` ou `PENALTY_SHOOTOUT`, retorna `score.regularTime`; para os demais, retorna o `match.result` normal.

```ts
getR1MatchScoringResult(match.score, fallbackHome, fallbackAway)
// → { home, away } — sempre regularTime para mata-mata R1
```

### DB Boundary — `whoClassifiesTeamId`

O campo TypeScript `whoClassifiesTeamId` (em `Prediction` e `User.predictions`) mapeia para a coluna DB `tieWinnerTeamId`. A conversão acontece em `useUserSystem.ts` na leitura e escrita. Nunca renomear a coluna DB sem uma migração explícita.
