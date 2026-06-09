# Migrations

## Estrutura

- Migrations numeradas em `database/migrations/` (0001, 0002, etc.)
- Aplicar em ordem sequencial
- Não modificar migrations já aplicadas

## Criando Nova Migration

1. Criar arquivo `database/migrations/XXXX_descrição.sql` com próximo número
2. Escrever SQL de migração
3. Testar em ambiente de desenvolvimento
4. Documentar se necessário

## Histórico de Migrations Relevantes

| Nº | Arquivo | O que faz |
|---|---|---|
| 0017 | `add_knockout_fields` | Adiciona `penaltiesHome/Away` em matches; `extraTimeHome/Away` em predictions |
| 0018 | `add_score_json_to_matches` | Adiciona coluna JSONB `score` (payload completo da API) |
| 0019 | `add_penalties_to_predictions` | Campos de prorrogação/pênaltis nos palpites |
| 0027 | `add_regular_extratime_cols` | Adiciona `regularHome/Away`, `extraTimeHome/Away` como campos planos em matches; inclui backfill do JSONB `score` |

## RLS

- Políticas RLS atuais em `database/rls/current.sql`
- Atualizar ao modificar schema de tabelas com RLS
