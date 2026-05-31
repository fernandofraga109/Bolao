# Fluxo de Dados

## Inicialização

1. `data/initialData.ts` seeds o estado em memória no startup
2. Supabase fetches hidratam o estado no auth
3. `useSyncSystem` polls Football Data API e escreve resultados de volta no Supabase
4. Supabase Realtime push updates para clientes conectados

## Fontes de Dados

- **`data/initialData.ts`** - seeds estado em memória no startup
- **`data/`** - arquivos estáticos com metadados de torneio (competições, times, estádios, jogos iniciais)
- **`database/migrations/`** - migrations Supabase e seed data para armazenamento persistente

## Persistência

Dados persistentes são armazenados no Supabase PostgreSQL. O cliente Supabase é inicializado em `services/supabase.ts` e acessado através de wrappers de API e hooks.
