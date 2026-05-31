# Regras de Testes

## Autorização

- O `test-runner` agent (`.claude/agents/test-runner.md`) é o **único** agente autorizado a criar, editar ou deletar arquivos de teste (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, `src/test/**`)
- Feature agents (`frontend`, `backend`) nunca devem tocar em arquivos de teste — nem mesmo para corrigir um teste falhando

## Workflow

- Após implementar uma feature, invocar o `test-runner` agent para escrever ou atualizar testes
- Se testes falharem após uma feature ser implementada, o `test-runner` reporta a falha e o feature agent corrige a implementação — nunca o contrário

## Testes Unitários

- Testes de utilitários em `utils/` (ex: `utils/scoring.test.ts`)
- Testes de hooks em `hooks/` (ex: `hooks/useLeaderboard.test.ts`)
