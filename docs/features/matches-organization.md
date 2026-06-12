# Organização da página de Jogos (MatchesPage)

`components/pages/MatchesPage.tsx` agrupa as partidas em seções visuais a
partir de um único `useMemo` sobre `matches`.

## Buckets

A ordem de classificação importa — **ao vivo tem prioridade sobre a data**:

1. **Ao Vivo** (`liveMatches`) — `match.status === MatchStatus.LIVE`.
   Extraído **antes** de qualquer comparação de data. Aparece no topo da
   página, sempre aberto, com estilo vermelho (`brand-red`) e indicador
   pulsante.
2. **Jogos Anteriores** (`pastGroups`) — dia do jogo `< hoje`, agrupado por
   Rodada / Grupo / "Anteriores". Recolhido por padrão.
3. **Jogos do Dia** (`todayMatches`) — dia do jogo `=== hoje`. Hero verde,
   aberto por padrão.
4. **Jogos Futuros** (`futureGroups`) — dia do jogo `> hoje`, agrupado por data.

> `MatchStatus.LIVE` é o status interno; o sync converte `IN_PLAY`/`PAUSED`
> da Football Data API via `mapExternalStatusToInternal`
> (`services/liveScoreService.ts`).

## Por que "Ao Vivo" vem antes da data

A categorização original era puramente por dia de calendário. Um jogo que
**começa antes da meia-noite e continua em andamento após 00:00** passava a ter
`dia do jogo < hoje` e caía em "Jogos Anteriores", sumindo dos "Jogos do Dia"
mesmo estando em andamento.

Extrair `status === LIVE` primeiro resolve os dois cenários:

- Jogo **do dia** + ao vivo → aparece só em "Ao Vivo".
- Jogo de **dia anterior** + ao vivo (cruzou a meia-noite) → aparece só em
  "Ao Vivo".
- Jogo do dia **não** ao vivo → permanece em "Jogos do Dia".

Quando o jogo finaliza (`status` deixa de ser `LIVE`), ele volta naturalmente
ao bucket de data correto no próximo recálculo.

## Componente `MatchGroup`

Renderiza um accordion reutilizável. Props de destaque:

- `isToday` → estilo verde (hero "Hoje").
- `isLive` → estilo vermelho (hero "Ao Vivo").
- Ambos aumentam o tamanho do título/ícone (`isHighlighted`).
