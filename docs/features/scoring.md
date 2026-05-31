# Sistema de Pontuação

O sistema suporta dois regulamentos diferentes, configuráveis por grupo.

## Regulamento 1 (Padrão)

Sistema de pontuação simples com bônus para underdogs:

### Pontuação de Partida
- **Placar Exato**: 10 pontos
- **Diferença de Gols**: 7 pontos
- **Resultado (vencedor/empate)**: 5 pontos
- **Bônus Underdog**: Até +5 pontos quando equipe pior rankeada vence

### Pontuação de Torneio
- Campeão: 100 pontos
- Artilheiro (nome): 100 pontos
- Artilheiro (gols): 100 pontos
- Melhor Jogador: 100 pontos
- Melhor Goleiro: 100 pontos

## Regulamento 2 (Bolão do Mesa 2026)

Sistema de pontuação dinâmico baseado na quantidade de acertos.

### Fase de Grupos
- **Resultado**: 10 pontos
- **Resultado + Diferença**: 13 pontos (não aplica em empates)
- **Placar Exato**: 15 pontos
- **Placar Isolado**: +5 pontos extras (se apenas 1 pessoa acertar)
- **Classificados (G2)**: 10 pontos por acerto

### Segunda Fase (Oitavas, Quartas, Semi)
- **Resultado**: 10 pontos
- **Resultado + Diferença**: 13 pontos
- **Placar Exato**: 15 pontos
- **Placar Isolado**: +5 pontos
- **Classificado**: 5 pontos

### Disputa de 3º Lugar
- **Resultado**: 12 pontos
- **Resultado + Diferença**: 15 pontos
- **Placar Exato**: 17 pontos
- **Placar Isolado**: +5 pontos

### Final
- **Resultado**: 16 pontos
- **Resultado + Diferença**: 19 pontos
- **Placar Exato**: 22 pontos
- **Placar Isolado**: +5 pontos

### Pontuação de Torneio (Dividida)
- **Campeão**: 
  - Acerto isolado: 100 pontos
  - 2 pessoas: 70 pontos cada
  - 3 pessoas: 50 pontos cada
  - 4+ pessoas: 40 pontos cada

- **Artilheiro**:
  - Acerto isolado: 60 pontos
  - 2 pessoas: 40 pontos cada
  - 3 pessoas: 30 pontos cada
  - 4+ pessoas: 25 pontos cada

- **Palpites Extras**: 20 pontos cada (maior goleada, mais gols sofridos, jogo com maior diferença)

## Implementação

- Lógica de pontuação em `utils/scoring.ts`
- Hook responsável: `usePointsProcessor`
