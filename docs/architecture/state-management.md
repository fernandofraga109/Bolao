# Gerenciamento de Estado

## DatabaseContext

Todo estado runtime vive em `contexts/DatabaseContext.tsx`, que compõe vários hooks customizados:

## Hooks Principais

- **`useUserSystem`** — auth, perfil, grupo
- **`useMatchSystem`** — jogos, palpites, pontuação
- **`useGroupSystem`** — criação/entrada em grupos
- **`useLeaderboard`** — cálculo de ranking
- **`useSyncSystem`** + **`useBackgroundSync`** — sync com Supabase e APIs externas
- **`usePointsProcessor`** — cálculo de pontos
- **`usePasswordRecovery`** — reset de senha

## App.tsx

`App.tsx` é o orquestrador raiz — consome DatabaseContext e renderiza as páginas.

## Convenções

- Estado vive nos hooks; componentes só renderizam e despacham ações
- Nunca chamar Supabase direto de componentes — sempre via `DatabaseContext`
- Tipos compartilhados em `types.ts` — sem interfaces inline em componentes
- Preferir atualizar hook existente a criar novo para lógica relacionada
