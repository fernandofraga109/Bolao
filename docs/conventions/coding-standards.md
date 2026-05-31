# Padrões de Código

## Estado

- Estado vive nos hooks; componentes só renderizam e despacham ações
- Nunca chamar Supabase direto de componentes — sempre via `DatabaseContext`
- Tipos compartilhados em `types.ts` — sem interfaces inline em componentes
- Preferir atualizar hook existente a criar novo para lógica relacionada

## Componentes

- Componentes em `components/pages/` são views completas (uma por rota)
- Componentes em `components/ui/` são primitivos reutilizáveis
- Componentes na raiz de `components/` são layout compartilhado

## Hooks

- Um hook por domínio em `hooks/`
- Hooks contêm lógica de negócio
- Componentes consomem hooks via `DatabaseContext`

## Tipos

- Todas as interfaces TypeScript compartilhadas em `types.ts`
- Sem interfaces inline em componentes
