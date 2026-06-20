# Plano — Componente "Últimos 5 jogos" no MatchCard

_Status_: DONE — 2026-06-20

## Context

Hoje o `MatchCard` mostra bandeira, nome e ranking de cada time, mas não dá
nenhuma noção de **forma recente** (momento) das seleções. A imagem de
referência (`lastFiveComponent.png`) mostra uma faixa de até 5 bolinhas
coloridas — verde (vitória), cinza (empate), vermelho (derrota) — um indicador
clássico de "form guide".

Objetivo: adicionar essa faixa **por time** dentro do `MatchCard`, calculada a
partir dos jogos **finalizados da mesma competição**. Ao clicar na faixa (ou no
nome do time), abre um **modal** listando esses até 5 jogos com adversário,
placar e data.

Decisões confirmadas com o usuário:
- **Layout:** uma faixa por time (abaixo do nome/ranking de cada lado).
- **Fonte dos dados:** calcular a partir da lista de `matches` (não usar
  `standings.form`).
- **Modal:** lista de até 5 jogos com adversário (bandeira + nome), placar
  final, data e indicador V/E/D.

## Arquivos

### Novos
- `components/LastFiveForm.tsx` — faixa inline de até 5 bolinhas (V/E/D) de um time.
- `components/LastFiveMatchesModal.tsx` — modal com a lista dos até 5 jogos.
- `utils/teamForm.ts` — helper puro para calcular a forma recente de um time.

### Modificados
- `components/MatchCard.tsx` — renderizar `LastFiveForm` por time + abrir o modal; nova prop `competitionMatches`.
- `components/pages/MatchesPage.tsx` — passar a lista completa de `matches` para o `MatchCard` (via `CollapsibleSection`/`LiveSection`).

> Reuso (sem alteração): `getKnockoutAdvancingTeamId` de `utils/scoring.ts` (já
> importado no MatchCard) e `ModalShell` de `components/ui/ModalShell.tsx`.

## Modelo de dados / cálculo

`MatchCard` recebe hoje só um `match` (`MatchCard.tsx:50`). Para calcular os
últimos 5 é preciso a lista completa. A array hidratada `matches` (tipo
`Match[]`) já existe em `MatchesPage` (`MatchesPage.tsx:154`) e é repassada às
seções. Vamos propagá-la até o `MatchCard` como nova prop
`competitionMatches: Match[]` (evita acoplar o card ao `DatabaseContext`, que só
expõe `MatchDB` cru, sem times hidratados).

### `utils/teamForm.ts`
```ts
import { Match, MatchStatus, Team } from "../types";
import { getKnockoutAdvancingTeamId } from "./scoring";

export type FormOutcome = "W" | "D" | "L";

export interface TeamFormEntry {
  match: Match;
  outcome: FormOutcome;
  isHome: boolean;
  opponent: Team;
  goalsFor: number;
  goalsAgainst: number;
}

// Últimos N jogos finalizados do time na MESMA competição, mais recente primeiro.
export function getTeamRecentForm(
  teamId: string,
  competitionCode: string | undefined,
  allMatches: Match[],
  limit = 5,
): TeamFormEntry[];
```
Regras:
- Filtrar `m.status === MatchStatus.FINISHED` e `m.result` definido.
- Mesmo `competitionCode` do match atual (quando ambos definidos; se o atual não
  tiver code, não filtra por competição).
- Time participa (`homeTeam.id` ou `awayTeam.id`).
- Ordenar por `date` desc; pegar `limit`.
- Outcome: comparar gols do time vs adversário usando `match.result`. Empate no
  tempo regular decidido nos pênaltis (mata-mata) → usar
  `getKnockoutAdvancingTeamId(match)` para classificar V/D; sem vencedor
  definido → "D".

### `components/LastFiveForm.tsx`
- Props: `entries: TeamFormEntry[]`, `onClick?: () => void`, `align?: "start" | "center" | "end"`.
- Renderiza até 5 bolinhas (`w-3 h-3 rounded-full`): verde `bg-brand-green`,
  cinza `bg-slate-600`, vermelho `bg-brand-red`. Mais recente à direita
  (consistente com a imagem). Ícones `Check`/`X`/`Minus` (lucide) opcionais.
- `entries` vazio → não renderiza nada (sem ruído em times sem histórico).
- `role="button"` + `cursor-pointer` quando `onClick` definido.

### `components/LastFiveMatchesModal.tsx`
- Usa `ModalShell` (`components/ui/ModalShell.tsx`), mesmo padrão de
  `ReplicatePredictionModal.tsx`.
- Props: `team: Team`, `entries: TeamFormEntry[]`, `onClose: () => void`.
- Título: `Últimos jogos · {team.name}` com bandeira.
- Lista: bandeira+nome do adversário, placar final, data
  (`toLocaleDateString pt-BR`), badge V/E/D colorido e mando ("Casa"/"Fora").
- Vazio → "Sem jogos anteriores nesta competição".

### `components/MatchCard.tsx`
- Nova prop `competitionMatches: Match[]` (default `[]`).
- `useMemo` para `homeForm` e `awayForm` via `getTeamRecentForm`.
- Estado `formModalTeam: Team | null` para controlar o modal.
- Renderizar `<LastFiveForm>` abaixo do bloco de cada time (após o ranking,
  `MatchCard.tsx:342-344` e `:505-507`), `onClick` abrindo o modal daquele time.
  Tornar o nome do time também clicável (mesmo handler).
- No fim do componente, render condicional de `<LastFiveMatchesModal>` quando
  `formModalTeam` definido (junto ao `ReplicatePredictionModal`,
  `MatchCard.tsx:728-745`).

### `components/pages/MatchesPage.tsx`
- Propagar a array de topo `matches` (conjunto completo) para
  `CollapsibleSection`/`LiveSection` e daí para cada `MatchCard` como
  `competitionMatches`. Atenção: as seções já recebem **subconjuntos**
  (`liveMatches`, `groupMatches`, etc.) para exibir; o cálculo da forma precisa
  do **conjunto completo**, então passar `matches` como prop separada.

## Verificação
1. `npm run dev` → abrir a aba de jogos (`matches`).
2. Conferir faixas por time em cards de competição com jogos finalizados; times
   sem histórico não mostram faixa.
3. Validar ordem (mais recente à direita) e cores vs um resultado conhecido.
4. Clicar na faixa e no nome do time → abre modal com os mesmos jogos
   (adversário/placar/data corretos); fechar funciona.
5. `npm run build` / typecheck sem erros.
6. Após validação do usuário: `test-runner` cobrindo `getTeamRecentForm`;
   `changelog-updater` para bumpar versão.

## Riscos / Notas
- **Performance:** `getTeamRecentForm` roda por time por card, mas a lista da
  Copa é pequena (~104 jogos) e `useMemo` evita recálculo. Sem problema.
- **competitionCode ausente:** se o match atual não tiver code, não filtrar por
  competição (fallback).
- **Mata-mata / pênaltis:** garantir que empate no regular com vencedor por
  pênaltis não vire "D" (usar `getKnockoutAdvancingTeamId`).
- Mudança é puramente aditiva no frontend — não toca pontuação nem sync.

## Follow-up / Decisões em aberto
- Mostrar a faixa em todos os cards ou só nos agendados? (default do plano: todos)
- Incluir indicador de mando também na faixa inline? (default: só no modal)
