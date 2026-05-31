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
