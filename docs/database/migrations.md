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

## RLS

- Políticas RLS atuais em `database/rls/current.sql`
- Atualizar ao modificar schema de tabelas com RLS
