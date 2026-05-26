---
description: Commitar mudanças no repo local e no repo do Miguel
---

# Workflow: Commitar em Ambos os Repositórios

Este workflow automatiza o processo de commitar mudanças no seu repositório e no repositório do Miguel.

## Uso

Execute este workflow quando você tiver mudanças pendentes que deseja commitar tanto no seu fork quanto no repositório do Miguel.

## Passos

1. **Verificar mudanças pendentes**
   - Execute `git status -s` para ver quais arquivos foram modificados
   - Execute `git diff --stat` para ver o resumo das mudanças

2. **Atualizar modelo de releases (opcional)**
   - Se as mudanças forem relevantes para o usuário final, atualize `data/releases.ts`:
     - Incremente `CURRENT_VERSION` (ex: 1.6.0 → 1.7.0)
     - Adicione um novo objeto ao array `RELEASES` com:
       - `version`: a nova versão
       - `date`: data atual no formato YYYY-MM-DD
       - `changes`: array de strings descrevendo as mudanças principais

3. **Adicionar e commitar mudanças**
   - Execute `git add -A` para adicionar todas as mudanças
   - Execute `git commit -m "mensagem do commit"` com uma mensagem descritiva seguindo a convenção:
     - `feat(scope): descrição` para novas funcionalidades
     - `fix(scope): descrição` para correções
     - `refactor(scope): descrição` para refatorações
     - `chore(scope): descrição` para tarefas de manutenção
     - `docs(scope): descrição` para documentação

4. **Push no seu repositório (origin)**
   - Execute `git push origin main`

5. **Adicionar remote do Miguel**
   - Execute `git remote add miguel https://github.com/Miguel-de-Castro/bolao-copa-do-mundo-2026.git`

6. **Push no repositório do Miguel**
   - Execute `git push miguel main:feature/fernando-DDMMYYYY-descricao-curta`
   - Substitua DDMMYYYY pela data atual (ex: 26052026)
   - Substitua descricao-curta por um breve descritor da mudança (ex: scorers-sync, live-score-sync)

7. **Remover remote do Miguel**
   - Execute `git remote remove miguel`

8. **Confirmar estado final**
   - Execute `git remote -v` para confirmar que origin aponta para seu repo
   - Execute `git status` para confirmar working tree limpa

## Exemplo de Execução Completa

```bash
git status -s
git diff --stat
git add -A
git commit -m "feat(sync): adicionar sync de artilheiros"
git push origin main
git remote add miguel https://github.com/Miguel-de-Castro/bolao-copa-do-mundo-2026.git
git push miguel main:feature/fernando-26052026-scorers-sync
git remote remove miguel
git remote -v
git status
```

## Notas

- O workflow cria uma nova feature branch no repo do Miguel a cada execução
- O GitHub fornecerá um link para criar o Pull Request após o push
- Sempre verifique o commit message antes de executar
- Se o remote "miguel" já existir, o comando `git remote add` falhará - use `git remote remove miguel` primeiro
