# Plano — Seção "Ao Vivo" em MatchesPage

_Status_: DONE — 2026-06-12
_Branch_: `feat/dense-ranking-and-live-games`

## Problema

Um jogo ao vivo que começou antes da meia-noite e continua em andamento após
00:00 sumia dos "Jogos do Dia" e caía em "Ver Jogos Anteriores". A
categorização em `MatchesPage.tsx` é puramente por dia de calendário
(`mDateStr < todayStr` → Anteriores), ignorando o `status` da partida.

## Solução

Extrair as partidas com `status === MatchStatus.LIVE` (IN_PLAY/PAUSED já são
mapeados para LIVE em `liveScoreService.mapExternalStatusToInternal`) **antes**
de classificar em past/today/future. Elas passam a aparecer somente numa nova
seção "Ao Vivo" no topo da página, independentemente da data do jogo.

Regras resultantes (cobrem os dois casos pedidos):
- Jogo do dia + ao vivo → aparece só no "Ao Vivo".
- Jogo de dia anterior + ao vivo (cruzou meia-noite) → aparece só no "Ao Vivo".
- Jogo do dia não-ao-vivo → continua em "Jogos do Dia".

## Arquivos

- `components/pages/MatchesPage.tsx`:
  - `useMemo` separa `liveMatches` primeiro; o resto segue para past/today/future.
  - Novo prop `isLive?` em `MatchGroup` (estilo vermelho + pulse).
  - Novo "hero" Ao Vivo (vermelho) acima de tudo, com contador.
  - Seção `MatchGroup` Ao Vivo renderizada antes de Anteriores.

## Validação

- `npx tsc --noEmit` limpo.
- Visual: jogo LIVE aparece só no Ao Vivo; ao finalizar volta para o
  bucket de data correto (past/today).
- test-runner: cobertura da função de categorização, se houver.

## Follow-up

- Docs: `docs/features/` (matches/UI) + SESSION_MEMORY.
