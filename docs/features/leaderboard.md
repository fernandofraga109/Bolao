# Leaderboard e Ranking

## Funcionalidades

- Cálculo de ranking por grupo
- Agregação de pontos e critérios de desempate
- Suporte a múltiplos regulamentos de pontuação

## Hook Responsável

- `useLeaderboard` - Computa rankings por grupo, agrega pontos e tiebreakers

## Lógica

- Leaderboard mostra pontos e ranking relativo dentro do grupo selecionado
- Suporta cálculo dinâmico baseado no regulamento do grupo
- Atualiza em tempo real via Supabase Realtime

## Dense Ranking (empates)

A classificação usa **dense ranking**: usuários com a mesma pontuação
dividem a mesma posição e o próximo colocado avança apenas +1.

- Exemplo: `100, 100, 90` → posições `1, 1, 2` (não `1, 1, 3`).
- Implementado em `components/Leaderboard.tsx` (`usersWithRanks`): incrementa
  `currentRank += 1` somente quando `totalPoints` muda em relação ao anterior.
- A mesma regra vale para a **Artilharia** (`components/topscores/TopScoresPage.tsx`),
  comparando `tournamentEntry.goals` em vez de pontos, para manter consistência
  visual entre as listas.
