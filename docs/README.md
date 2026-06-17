# Documentação Modular

Esta estrutura permite carregar apenas o contexto relevante para cada tarefa, reduzindo o consumo de tokens.

## Índice por Domínio

### 🏗️ Arquitetura (`docs/architecture/`)
- `overview.md` - Visão geral do sistema e stack
- `state-management.md` - DatabaseContext e hooks
- `data-flow.md` - Fluxo de dados e sync
- `integrations.md` - Integrações externas
- `external-api-calls.md` - Chamadas externas + fluxo Supabase (lê/escreve): endpoints, pipeline de sync fase a fase e análise de melhoria

### 📐 Convenções (`docs/conventions/`)
- `commit-pattern.md` - Padrão de commits
- `coding-standards.md` - Padrões de código
- `testing-rules.md` - Regras de testes

### 🗄️ Banco de Dados (`docs/database/`)
- `schema.md` - Schema do banco
- `migrations.md` - Como trabalhar com migrations
- `rls.md` - Políticas RLS

### ⚡ Features (`docs/features/`)
- `auth.md` - Autenticação e perfis
- `sync-system.md` - Sistema de sync (limitação conhecida)
- `scoring.md` - Sistema de pontuação (Regulamento 1 e 2)
- `leaderboard.md` - Leaderboard e ranking (dense ranking de empates)
- `matches-organization.md` - Seções da página de Jogos (Ao Vivo / Anteriores / Hoje / Futuros)
- `match-card.md` - Card de palpite (anti-revert do realtime em edição não salva + badge do grupo)
- `players-and-top-scorers.md` - Tabela de jogadores, autocomplete de artilheiro e aba Top Scores
- `knockout-score-display.md` - Padrão de exibição de placar mata-mata (regular/ET/pênaltis) por tela

### 🛠️ Setup (`docs/setup/`)
- `environment.md` - Variáveis de ambiente
- `commands.md` - Comandos npm
- `deployment.md` - Deploy em produção

## Como Usar

Ao trabalhar em uma tarefa específica, carregue apenas os arquivos relevantes:

**Exemplo 1 - Trabalhando em auth:**
- `docs/conventions/coding-standards.md`
- `docs/features/auth.md`
- `docs/database/schema.md` (seções relevantes)

**Exemplo 2 - Trabalhando em sync:**
- `docs/features/sync-system.md`
- `docs/architecture/integrations.md`
- `docs/conventions/coding-standards.md`

**Exemplo 3 - Trabalhando em UI:**
- `docs/conventions/coding-standards.md`
- `docs/architecture/state-management.md`
- `docs/features/scoring.md` (se a UI envolver pontuação)
