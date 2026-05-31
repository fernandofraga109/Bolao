# Deploy

## Vercel (Recomendado)

1. Instalar CLI: `npm i -g vercel`
2. Configurar variáveis de ambiente no painel Vercel
3. Deploy: `vercel`

## Variáveis de Ambiente no Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SCHEMA`
- `GEMINI_API_KEY` (opcional)
- `FOOTBALL_DATA_TOKEN` (opcional)

## Observações

- Garantir isolamento de schema Supabase para ambientes dev/prod
- Deploy frontend em hosting estático que suporte apps Vite
- Manter API keys e secrets Supabase seguros em configuração de ambiente
