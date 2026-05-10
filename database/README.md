# Database — Bolão Copa do Mundo 2026

## Estrutura

```
database/
├── migrations/
│   ├── 0001_create_tables.sql          ← Schema completo (execute primeiro)
│   └── 0002_fix_teams_fks_indexes.sql  ← FKs de competitionCode + índices + fix TLA
├── rls/
│   └── current.sql              ← Políticas RLS ativas (execute depois do schema)
├── seed/
│   └── system_config.sql        ← Linha inicial do system_config
└── _archive/
    ├── README.md                ← Histórico e explicação do que NÃO rodar
    └── sql/                     ← Arquivos originais preservados para referência
```

## Schema alvo (dev vs public)

Todos os arquivos SQL têm `SET search_path TO dev;` no topo — basta alterar essa linha para mudar o schema alvo (`public` para produção, `dev` para testes).

O app lê o schema da variável de ambiente `VITE_SUPABASE_SCHEMA` (padrão: `public`). Para desenvolvimento, adicione ao `.env.local`:

```
VITE_SUPABASE_SCHEMA=dev
```

## Como recriar o banco do zero

Execute no **Supabase SQL Editor** na seguinte ordem:

```
1. database/migrations/0001_create_tables.sql
2. database/migrations/0002_fix_teams_fks_indexes.sql
3. database/rls/current.sql
4. database/seed/system_config.sql
```

## Schema atual (2026-05-10)

| Tabela | PK | Descrição |
|--------|----|-----------|
| `competitions` | `code` | Competições sincronizadas (WC, etc.) |
| `teams` | `id` | Times participantes |
| `stadiums` | `id` | Estádios |
| `user_roles` | `userId` | Perfis de usuário (role, activeGroupId, totalPoints) |
| `groups` | `id` | Grupos de bolão |
| `user_groups` | `(userId, groupId)` | Membership + pontos por grupo |
| `matches` | `id` | Partidas (com stage, matchday, competitionCode) |
| `predictions` | `(userId, matchId, groupId)` | Palpites por usuário/jogo/grupo + pontos |
| `tournament_predictions` | `userId` | Palpites de torneio (campeão, artilheiro, etc.) |
| `team_standings` | `(teamId, competitionCode, group)` | Classificação por grupo de fase |
| `system_config` | `id` | Configuração singleton (auto-sync, intervalo) |

## RLS — Resumo de acesso

| Tabela | Anon | Auth | Admin |
|--------|------|------|-------|
| competitions | SELECT | SELECT + UPDATE lastSync | ALL |
| teams | SELECT | SELECT + INSERT + UPDATE | + DELETE |
| stadiums | SELECT | SELECT | ALL |
| user_roles | — | SELECT (own/group) + INSERT/UPDATE own | ALL |
| groups | — | SELECT | ALL |
| user_groups | — | SELECT + INSERT own + UPDATE (pontos) | + DELETE |
| matches | SELECT | SELECT + INSERT + UPDATE | + DELETE |
| predictions | — | SELECT + INSERT/UPDATE/DELETE own | ALL |
| tournament_predictions | — | SELECT + INSERT/UPDATE/DELETE own | ALL |
| team_standings | SELECT | SELECT + INSERT + UPDATE | + DELETE |
| system_config | SELECT | SELECT | ALL |
