# Sistema de Sync

## Funcionamento Atual

- `useSyncSystem` usa `setInterval` para polls da Football Data API
- Só roda enquanto a aba do admin está aberta
- Atualiza Supabase com resultados de partidas
- Supabase Realtime push updates para clientes conectados

## Limitação Conhecida

**A automação só funciona enquanto a aba do Painel de Administração estiver aberta** no navegador de um usuário administrador. Se o navegador for fechado, as partidas não serão atualizadas automaticamente até que o painel seja aberto novamente.

## Solução Futura

Para sync 24/7 independente do navegador:
- Migrar para **Supabase Edge Function**
- Agendar usando extensão **pg_cron** do PostgreSQL

## Proxy CORS

- Football Data API deve ser chamada pelo proxy Vite
- Nunca chamar direto do frontend
- Configuração em `vite.config.ts`
