# R1 mata-mata: contabilizar prorrogação (120 min)

_Status_: IN PROGRESS — aguardando validação do usuário
_Branch_: `feat/r1-knockout-120min`

## Problema / motivação

No Regulamento 1, o palpite no mata-mata pontuava apenas o **tempo regular (90 min)**
(`regularHome/regularAway`). Após enquete, os usuários votaram para que o R1 passe a
contabilizar **tempo regular + prorrogação (120 min)** na hora de pontuar, igual ao R2.
Pênaltis continuam fora do placar (só resolvem o bônus "quem se classifica").

## Mudança central

`utils/scoring.ts` → `getR1MatchScoringResult` agora retorna `regularHome + extraTimeHome` /
`regularAway + extraTimeAway` (fallback: `match.result`, que já é o resultado final
consolidado). Como essa é a **única** função usada por todos os pontos do R1, a mudança
propaga automaticamente para:

- `hooks/usePointsProcessor.ts` (3 sites de scoring)
- `hooks/useLeaderboard.ts`
- `components/MatchCard.tsx` (getScoringDetails)
- `components/pages/StatsPage.tsx` (3 sites)
- `components/UserAuditModal.tsx` (3 sites — pts, categoria, bônus zebra)

Os breakdowns de display que mostram "Tempo Regular" lêem `match.regularHome` direto
(não a função), então continuam corretos.

## Mudanças de UI / display (MatchCard)

- `displayResult` agora retorna sempre `match.result` (full 120') para ambos rulesets.
- Label do placar principal: sempre "Resultado" (antes "Tempo Regular" no R1 c/ ET).
- Bloco abaixo dos times repurposado: "Após Prorrogação" → "Tempo Regular" (mostra os 90 min
  como detalhe secundário, já que o principal virou o placar final).
- **Feedback pedido:** abaixo de "Sua Aposta", em jogos de mata-mata R1, mostra
  "(tempo regulamentar + prorrogação)".

## Textos de regras atualizados

- `components/ui/ScoringGuide.tsx` — nota do Mata-Mata.
- `components/RulesSection.tsx` — nova linha no R1.
- `documentacao/business-rules.md` + `docs/features/scoring.md`.

## Validação

- `tsc --noEmit`: limpo nos arquivos alterados (restam só os erros pré-existentes de
  `DatabaseContext.tsx`).
- `utils/scoring.test.ts`: 130 passam; **3 falham de propósito** (SCORE-32, SCORE-33,
  SCORE-16) — asseguravam o comportamento antigo (regular-only). **Pendência: test-runner**
  deve reescrevê-los para 120 min.

## Pendências

1. Validação do usuário no app.
2. Invocar `test-runner` para atualizar SCORE-32/33/16 (e cobrir o novo comportamento +
   somar prorrogação a partir das colunas planas).
3. Após confirmação: mover plano p/ `completed/`, atualizar SESSION_MEMORY, `changelog-updater`.

## Notas de risco

- **Sem migration / sem reprocessamento retroativo de banco:** a mudança é só de cálculo.
  Os `predictions.points` já gravados serão recalculados no próximo sync
  (`recalculateUserGroupPoints`), pois o guard de idempotência compara `pred.points !== pts`.
- Comportamento de empate real / pênaltis inalterado fora do placar.
