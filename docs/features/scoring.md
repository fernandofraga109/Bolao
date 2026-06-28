# Sistema de Pontuação

O sistema suporta dois regulamentos diferentes, configuráveis por grupo (`groups.ruleset`).

---

## Sistema de Cores (UI)

A pontuação é representada visualmente no app com cores consistentes em todos os componentes (`UserAuditModal`, `MatchCard`, `ScoringGuide`):

| Categoria       | Cor                  | Classe Tailwind              | Medal |
|---|---|---|---|
| Placar Exato    | Dourado              | `text-brand-gold`            | 🥇    |
| Diferença certa | Azul-ciano           | `text-sky-400`               | 🥈    |
| Resultado certo | Verde                | `text-brand-green`           | 🥉    |
| Errou           | Vermelho             | `text-red-400`               | ❌    |
| Bônus / Especial| Âmbar                | `text-amber-300`             | ✨    |

> `border-l-2 border-brand-gold/60` (exato), `border-brand-green/50` (acerto), `border-red-500/20` (erro) são as bordas laterais nos cards de auditoria.

---

## Regulamento 1 (Padrão)

### Fluxo de Pontuação R1

```
Palpite vs Resultado Real
          │
          ▼
   É exato (home==rHome && away==rAway)?
   ├─ SIM → 10 pts base → + underdogBonus → + classifiesBonus
   └─ NÃO
          │
          ▼
   Resultado (vencedor/empate) correto?
   ├─ NÃO → 0 pts
   └─ SIM
          │
          ▼
   Resultado real é empate?  [REGRA 3]
   ├─ SIM → 5 pts (resultado certo) → + underdogBonus → + classifiesBonus
   └─ NÃO
          │
          ▼
   Diferença de gols igual? (predH-predA == realH-realA)?
   ├─ SIM → 7 pts (diferença certa) → + underdogBonus → + classifiesBonus
   └─ NÃO → 5 pts (resultado certo) → + underdogBonus → + classifiesBonus
```

### Tabela de Pontos R1

| Categoria | Base | + Underdog | + Classifica | Máximo |
|---|---|---|---|---|
| Placar Exato | 10 | até +5 | +3 | **18** |
| Diferença certa | 7 | até +5 | +3 | **15** |
| Resultado certo | 5 | até +5 | +3 | **13** |
| Errou | 0 | — | — | **0** |

**Regra 3 — Empates:** Quando o resultado real é empate, "Diferença certa" nunca se aplica — máximo é "Resultado certo" (5 pts). Exemplos: pred 2-2 num jogo 1-1 → 5 pts, não 7.

### Jogos de Mata-Mata (R1)

**Base de comparação:** somente o placar do **Tempo Regular** (90 min). A prorrogação NÃO conta.

Exemplos com Brasil 1×1 Argentina 90' → 2×1 após prorrogação → Argentina vence 4-3 nos pênaltis:

| Palpite | Placar Base (RT) | Categoria | Pts |
|---|---|---|---|
| 1-1 | 1×1 | Exato | **10** |
| 1-1 + Argentina classifica | 1×1 | Exato + Classifica | **13** |
| 0-0 | 1×1 | Resultado (empate) | **5** |
| 2-1 | 1×1 | Errou | **0** |

**Bônus "Quem se Classifica" (+3 pts):**
Somente quando TODAS as condições:
1. Palpite é empate (`predHome === predAway`)
2. Jogo foi à prorrogação ou pênaltis (`getMatchDuration(match) !== 'REGULAR'`)
3. Usuário indicou o time correto que avançou (`predWhoClassifiesId === realWhoClassifiesId`)

### Bônus Underdog

Até +5 pts quando equipe pior rankeada vence. Calculado via `calculateUnderdogBonus`:
- Só se aplica quando não é empate (`realHome !== realAway`)
- `UNDERDOG_BONUS_FACTOR = 0.03`, `MAX_UNDERDOG_BONUS = 5`
- Threshold configurável por grupo (`underdog_min_rank_diff`)

### Palpites Especiais R1

| Categoria | Pontos |
|---|---|
| Campeão | 100 pts |
| Artilheiro (nome) | 100 pts |
| Artilheiro (gols) | 100 pts |
| Melhor Jogador | 100 pts |
| Melhor Goleiro | 100 pts |

---

## Regulamento 2 (Bolão do Mesa 2026)

Sistema de pontuação dinâmico — pontos dependem do contexto de todos os palpites do grupo.

### Fluxo de Pontuação R2

```
Palpite vs Resultado Real
          │
          ▼
   É exato (home==rHome && away==rAway)?
   ├─ SIM → pointsExact (varia por fase)
   │         → aloneBonus se único com esse palpite no grupo (+5)
   └─ NÃO
          │
          ▼
   Resultado (vencedor/empate) correto?
   ├─ NÃO → 0 pts
   └─ SIM
          │
          ▼
   Resultado real é empate?  [REGRA 3]
   ├─ SIM → pointsOutcome (varia por fase)
   └─ NÃO
          │
          ▼
   Diferença de gols igual? (predH-predA == realH-realA)?
   ├─ SIM → pointsDiff (varia por fase)
   └─ NÃO → pointsOutcome (varia por fase)
```

### Tabela de Pontos R2 por Fase (resumo)

| Categoria | Grupos | Oitavas/Quartas/Semi | 3º Lugar | Final |
|---|---|---|---|---|
| 🏆 Placar Exato | **15** | **15** | **17** | **22** |
| 🥈 Diferença certa | **13** | **13** | **15** | **19** |
| 🥉 Resultado certo | **10** | **10** | **12** | **16** |
| ❌ Errou | 0 | 0 | 0 | 0 |
| ✨ Placar Isolado | +5 | +5 | +5 | +5 |

### Fase de Grupos

| Categoria | Pontos |
|---|---|
| Resultado | 10 |
| Resultado + Diferença | 13 (nunca em empates) |
| Placar Exato | 15 |
| Placar Isolado (bônus) | +5 |
| Classificados (G2) | 10 por acerto |

### Segunda Fase (Oitavas, Quartas, Semi)

Stage API: `ROUND_OF_16`, `QUARTER_FINALS`, `SEMI_FINALS` → fase `ko`

| Categoria | Pontos |
|---|---|
| Resultado | 10 |
| Resultado + Diferença | 13 |
| Placar Exato | 15 |
| Placar Isolado | +5 |
| Classificado | 5 por acerto |

### Disputa de 3º Lugar

Stage API: `THIRD_PLACE` → fase `third_place`

| Categoria | Pontos |
|---|---|
| Resultado | 12 |
| Resultado + Diferença | 15 |
| Placar Exato | 17 |
| Placar Isolado | +5 |

### Final

Stage API: `FINAL` → fase `final`

| Categoria | Pontos |
|---|---|
| Resultado | 16 |
| Resultado + Diferença | 19 |
| Placar Exato | 22 |
| Placar Isolado | +5 |

### Base de comparação (Mata-Mata R2)

R2 usa `regularTime + extraTime` (`match.result`). A **prorrogação conta** para pontuação no R2.

**Regra 3:** Igual ao R1 — em empates reais, "Diferença certa" não se aplica (máx. Resultado).

### Mapeamento de Fases

| Stage API | Fase interna | Onde se aplica |
|---|---|---|
| `GROUP_STAGE`, `REGULAR_SEASON` | `groups` | Fase de grupos |
| `ROUND_OF_16`, `QUARTER_FINALS`, `SEMI_FINALS` | `ko` | Oitavas, quartas, semi |
| `THIRD_PLACE` | `third_place` | Disputa do 3º lugar |
| `FINAL` | `final` | Grande final |

Implementado em `getMatchPhase(stage, group)` — também aceita nomes de grupo em português (ex: `OITAVAS`, `QUARTAS`, `SEMI`).

### Palpites Especiais R2

**Campeão** (pontos divididos conforme número de acertos no grupo):
| Acertos | Pts |
|---|---|
| 1 | 100 |
| 2 | 70 |
| 3 | 50 |
| 4+ | 40 |

**Artilheiro**:
| Acertos | Pts |
|---|---|
| 1 | 60 |
| 2 | 40 |
| 3 | 30 |
| 4+ | 25 |

**Outros palpites especiais R2:**
| Categoria | Pontos |
|---|---|
| Classificados (grupos) | 10 pts por time correto |
| Classificados (oitavas+) | 5 pts por time correto |
| Seleção com mais gols num jogo | 20 pts |
| Seleção que tomou mais gols num jogo | 20 pts |
| Jogo com maior diferença por fase | 20 pts |

---

## Implementação

### Arquivos Principais

| Arquivo | Responsabilidade |
|---|---|
| `utils/scoring.ts` | Funções puras de cálculo (ambos regulamentos) |
| `hooks/usePointsProcessor.ts` | Processa e persiste pontos no DB |
| `hooks/useLeaderboard.ts` | Calcula totais para exibição no leaderboard |
| `components/MatchCard.tsx` | Badge de pontos + cor + label "Placar Isolado" + bloco ET/pênaltis |
| `components/UserAuditModal.tsx` | Breakdown de pontos por partida + sub-linhas ET/pênaltis no detalhe expandido |
| `components/pages/StatsPage.tsx` | PredictionCard mostra sub-linhas "Prorrog." e "Pên." para jogos de mata-mata |
| `components/TournamentStandings.tsx` | Linha de placar no bracket exibe badge "Prorr." e "Pên. X×Y" quando aplicável |
| `components/ui/ScoringGuide.tsx` | Modal de guia visual (R1 e R2) + fonte de `SCORING_COLORS` |
| `components/AdminMatchCard.tsx` | Card admin dedicado — edita result, regularTime, ET e pênaltis inline no Jogos |

### Funções Chave (`utils/scoring.ts`)

| Função | Uso |
|---|---|
| `getScoreCategoryRegulamento1` | Retorna tipo + bônus para R1 |
| `calculatePoints` | Total de pontos R1 |
| `getScoreCategoryRegulamento2` | Retorna tipo + aloneBonus para R2 |
| `calculatePointsRegulamento2` | Total de pontos R2 (context-aware) |
| `getR1MatchScoringResult` | Placar de comparação R1 em mata-mata = tempo regular + prorrogação (120 min), igual ao R2 (usa campos planos, fallback `match.result`) |
| `getMatchDuration` | Infere 'REGULAR' / 'EXTRA_TIME' / 'PENALTY_SHOOTOUT' dos campos planos |
| `getKnockoutAdvancingTeamId` | Retorna teamId que avançou (ET ou pênaltis), undefined se REGULAR |
| `getMatchPhase` | Mapeia stage/group → MatchPhase |
| `calculateUnderdogBonus` | Bônus por ranking para R1 |

### `getR1MatchScoringResult`

Retorna o placar de comparação correto para R1. Para jogos mata-mata soma `regularHome + extraTimeHome` / `regularAway + extraTimeAway` (tempo regular + prorrogação, 120 min — igual ao R2). Fallback para `match.result` (resultado final consolidado) em partidas antigas sem os campos planos.

> Histórico: até 2026-06 esta função retornava apenas o tempo regular (90 min). Após enquete com os usuários, o mata-mata do R1 passou a contabilizar a prorrogação. Os pênaltis seguem fora do placar (resolvem só o bônus "quem se classifica").

```ts
getR1MatchScoringResult(match, fallbackHome, fallbackAway)
// → { home, away } — tempo regular + prorrogação para mata-mata R1
```

**Fonte de dados:** lê `match.regularHome / match.regularAway` + `match.extraTimeHome / match.extraTimeAway` (colunas planas, migration 0027). Fallback para `fallbackHome/fallbackAway` (passe `match.result.home/away`) para partidas antigas. Nunca passar `match.score` diretamente — passe o objeto `match` inteiro.

### `getMatchDuration` / `getKnockoutAdvancingTeamId`

Helpers em `utils/scoring.ts` para inferir duração e time classificado a partir dos campos planos (sem ler o JSONB `score`):

```ts
getMatchDuration(match) // → 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
getKnockoutAdvancingTeamId(match) // → teamId que avançou, ou undefined (REGULAR)
```

Regra de inferência de duração: `penaltiesHome != null` → PENALTY_SHOOTOUT; `extraTimeHome != null` → EXTRA_TIME; senão REGULAR. Fallback para `score.duration` para partidas sem os campos planos ainda populados.

**`getKnockoutAdvancingTeamId` cobre EXTRA_TIME e PENALTY_SHOOTOUT:**
- PENALTY_SHOOTOUT: `penaltiesHome > penaltiesAway` → HOME_TEAM
- EXTRA_TIME: `result.home > result.away` → HOME_TEAM (placar cumulativo após a prorrogação)
- REGULAR: `undefined` (partida decidida nos 90 min — bônus "classifica" não se aplica)

**Regra do bônus `whoClassifiesTeamId` (R1):** concedido quando `duration IN ('EXTRA_TIME', 'PENALTY_SHOOTOUT')` e o palpite de avanço coincide com `getKnockoutAdvancingTeamId`. Anteriormente verificava apenas PENALTY_SHOOTOUT — gap corrigido.

### Admin — `AdminMatchCard` (Jogos screen)

Componente `components/AdminMatchCard.tsx` — card dedicado para a visão admin na tela Jogos. Substitui o `MatchCard` com `isAdmin=true`.

**Seções sempre visíveis:**
- Inputs de resultado (`resultHome` / `resultAway`) + seletor de status + "Salvar Edição" + toggle de sync lock

**Seção de placar mata-mata** — visível quando `(isLive || isFinished) && isKnockout`:
- `regularHome` / `regularAway` — tempo regular; fonte do R1 (obrigatório para knockout)
- `extraTimeHome` / `extraTimeAway` — delta da prorrogação, não cumulativo (opcional, clearable)
- `penaltiesHome` / `penaltiesAway` — pênaltis (opcional, clearable)
- Preview "Resultado Final (R2): X × Y" — derivado automaticamente: `regularHome + extraTimeHome`

**Derivação de `resultHome` (5.a baked-in):**
```
resultHome = regularHome + extraTimeHome   (com ET)
resultHome = regularHome                   (sem ET)
```
Inputs de `resultHome/resultAway` no topo são auto-preenchidos pelo efeito de derivação. Admin pode sobrescrever manualmente se necessário.

**Save:** `db.updateMatch` (flat cols + resultHome derivado) → `onAdminSaveMatch` (status + result → aciona finishMatch/updateLiveScore e recálculo de pontos) → `db.refetchMatches()`.

**Rationale para LIVE:** se a API parar de enviar o breakdown de regularTime/extraTime durante uma partida mata-mata ao vivo, o admin pode preencher os campos manualmente em tempo real.

### DB Boundary — `whoClassifiesTeamId`

O campo TypeScript `whoClassifiesTeamId` (em `Prediction` e `User.predictions`) mapeia para a coluna DB `tieWinnerTeamId`. A conversão acontece em `useUserSystem.ts` na leitura e escrita. Nunca renomear a coluna DB sem uma migração explícita.

### Cores Centralizadas (`ScoringGuide.tsx`)

`SCORING_COLORS` exportado de `components/ui/ScoringGuide.tsx` é a fonte única de verdade para cores por categoria:

```ts
import { SCORING_COLORS, ScoringCategory } from "./ui/ScoringGuide";
// exact → bg-brand-gold / text-brand-gold / border-brand-gold/60
// diff  → bg-brand-blue / text-sky-400   / border-sky-400/50
// outcome → bg-indigo-600 / text-brand-green / border-brand-green/50
// wrong → bg-slate-700  / text-red-400   / border-red-500/20
```

`MatchCard` e `UserAuditModal` derivam a cor da **categoria retornada pelas funções de scoring** — nunca de thresholds fixos de pts (ex.: `pts >= POINTS_EXACT`). Isso garante que R2 outcome (10 pts ko) não fique gold por coincidir com o valor de R1 exact.

### Feedback "Placar Isolado" no MatchCard

Quando `getScoreCategoryRegulamento2` retorna `aloneBonus: true` (único com aquele placar no grupo), o badge do MatchCard exibe:

```
Placar Exato!
✨ +5 Placar Isolado   ← em text-amber-300
```

### Seção "O que a galera acha" (MatchCard)

O bloco de palpites dos amigos exibe os pontos de cada um via `getScoringDetails(...)`. O valor retornado em `points` **já inclui** todos os bônus:
- **R1:** `calculatePoints` soma `underdogBonus + classifiesBonus` ao base.
- **R2:** `calculatePointsRegulamento2` soma `aloneBonus (+5)` ao base.

⚠️ **Nunca** somar `friendScoring.bonus` ao `friendScoring.points` para exibir o total — `bonus` é apenas o underdogBonus recalculado para uso em labels. Somá-lo duplicava o bônus zebra no R1. O total correto é simplesmente `friendScoring.points`.

### Consistência DB / UI

| Contexto | `tieWinnerTeamId` incluído? | Classifica bônus funciona? |
|---|---|---|
| `recalculateUserGroupPoints` (select explícito) | ✅ sim (select inclui a coluna) | ✅ |
| `batchProcessPointsForMatches` (usa `dbRef.current.predictions`) | ✅ select `*` via DatabaseContext | ✅ |
| `updateLocalPointsWithLive` (usa `dbRef.current.predictions`) | ✅ select `*` via DatabaseContext | ✅ |
| `UserAuditModal` (usa `rawPredictions` → `select *`) | ✅ | ✅ |

**Upsert seguro:** `recalculateUserGroupPoints` usa `defaultToNull: false` no upsert — colunas ausentes do body (como `tieWinnerTeamId`) nunca são sobrescritas para NULL pelo PostgREST.

**Regra 3 no UI:** `isDiffCorrect` é calculado via `getScoreCategoryRegulamento1/2` — nunca comparação raw independente — garantindo consistência entre pts e label/cor.
