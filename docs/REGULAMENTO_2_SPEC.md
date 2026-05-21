# Documento de Especificação de Design (SDD) - Múltiplos Regulamentos

## 1. Objetivo
O objetivo desta implementação é adicionar suporte ao **Regulamento 2** no aplicativo "Bolão Copa do Mundo 2026", garantindo que o **Regulamento 1 (Default)** mantenha seu comportamento atual sem nenhuma alteração indesejada. O sistema passará a suportar múltiplos regulamentos de forma configurável.

---

## 2. Descrição das Regras: Regulamento 2 (Bolão do Mesa 2026)

Este regulamento introduz regras de pontuação estáticas e **dinâmicas** (dependentes dos palpites dos outros participantes).

### 2.1 Critérios de Pontuação Estáticos e Dinâmicos

#### A) Campeão (Palpite pré-Copa)
- **Acerto Isolado (1 pessoa):** 100 pontos
- **Dividido por 2 pessoas:** 70 pontos cada
- **Dividido por 3 pessoas:** 50 pontos cada
- **Dividido por 4 ou mais:** 40 pontos cada

#### B) Artilheiro (Palpite pré-Copa)
- **Acerto Isolado (1 pessoa):** 60 pontos
- **Dividido por 2 pessoas:** 40 pontos cada
- **Dividido por 3 pessoas:** 30 pontos cada
- **Dividido por 4 ou mais:** 25 pontos cada

#### C) Fase de Grupos
- **Resultado (apenas vencedor ou empate):** 10 pontos
- **Resultado + Diferença de gols:** 13 pontos
  - *Regra Especial de Empate:* "Não haverá, em caso de empate, pontuação extra por (resultado + diferença de gols)". Ou seja, se o jogo for 1x1 e o palpite for 2x2, o usuário ganha apenas os 10 pontos de Resultado (empate), não 13.
- **Placar Exato:** 15 pontos (não cumulativo com os anteriores)
- **Placar Isolado (Bônus Dinâmico):** +5 pontos extras (se apenas 1 pessoa acertar o placar exato).
- **Classificados (G2):** 10 pontos por acerto (apenas 1º e 2º do grupo, 3º não conta).

#### D) Segunda Fase (Oitavas, Quartas, Semi)
- **Resultado:** 10 pontos
- **Resultado + Diferença:** 13 pontos
- **Placar Exato:** 15 pontos
- **Placar Isolado:** +5 pontos
- **Classificado (avançou de fase):** 5 pontos

#### E) Disputa de 3º Lugar
- **Resultado:** 12 pontos
- **Resultado + Diferença:** 15 pontos
- **Placar Exato:** 17 pontos
- **Placar Isolado:** +5 pontos

#### F) Final
- **Resultado:** 16 pontos
- **Resultado + Diferença:** 19 pontos
- **Placar Exato:** 22 pontos
- **Placar Isolado:** +5 pontos

#### G) Palpites Extras (Pré-Copa)
- **Maior nº de gols feitos em jogo único (Seleção):** 20 pontos
- **Maior nº de gols tomados em jogo único (Seleção):** 20 pontos

#### H) Palpites Extras (Por Fase)
- **Jogo com maior diferença de gols (Pré-Fase):** 20 pontos

#### I) Regras Adicionais
- O tempo de prorrogação é considerado no placar final para pontos.

---

## 3. Impacto Técnico e Arquitetura Proposta

Para garantir a integridade do **Regulamento 1**, a lógica de pontuação será refatorada utilizando o **Padrão Strategy (Strategy Pattern)** ou Injeção de Regras.

### 3.1. Armazenamento (Banco de Dados)
- O sistema precisará armazenar qual é o Regulamento ativo (seja por Liga/Grupo, ou globalmente).
- Adicionar campos no banco (ex: tabela `extra_bets`) para armazenar os palpites de:
  - Seleção Maior Goleadora (1 jogo).
  - Seleção Maior Goleada (1 jogo).
  - Jogo Maior Diferença de Gols (por fase).

### 3.2. Motor de Pontuação Dinâmica (Importante)
Atualmente, é comum que a pontuação seja calculada olhando apenas o `Palpite vs Resultado Real`. 
Com o Regulamento 2, o cálculo de pontuação precisará do contexto de **todos os palpites** para processar regras como:
- "Placar sozinho"
- Divisão de pontos de "Campeão" e "Artilheiro".

O algoritmo de cálculo precisará:
1. Buscar o resultado real.
2. Buscar **todos os palpites** do bolão para o evento (jogo, campeão, etc).
3. Contar quantos acertaram o placar exato / campeão / artilheiro.
4. Aplicar a pontuação de cada usuário baseando-se nas contagens de acertos globais.

### 3.3. Nova Interface (UI)
- Tela para cadastro dos "Palpites Extras" (Artilheiro, Campeão, Seleção Goleadora, etc).
- As pontuações desses palpites extras só se resolverão no final da copa ou da fase, devendo aparecer de forma clara no painel do usuário.
- Tela de Configuração para permitir a seleção do Regulamento (1 ou 2).

---

## 4. Plano de Ação (Próximos Passos)

1. **Modelagem de Dados:** Analisar esquema de banco atual (`db_schema.ts`) e definir novas colunas/tabelas para suportar Palpites Extras e Regulamento ativo.
2. **Refatoração do Motor de Pontuação:** Extrair lógica atual para um arquivo `rules/Regulamento1.ts` e criar a estrutura para o `rules/Regulamento2.ts`.
3. **Implementação do Backend:** Construir o cálculo dinâmico das pontuações considerando múltiplos usuários.
4. **Atualização do Frontend:** Incluir componentes para entrada de apostas extras e visualização de pontuações detalhadas.
5. **Testes:** Validar regras do Regulamento 2 utilizando mocks de múltiplos palpites.
