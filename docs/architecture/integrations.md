# Integrações Externas

## Supabase

- **PostgreSQL** - Armazenamento de dados
- **Auth** - Autenticação de usuários
- **Realtime** - Subscrições em tempo real
- Client em `services/supabase.ts`

## Football Data API

- Dados de partidas, classificações, artilheiros e elencos
- Proxied via Vite (dev) / Vercel Edge Functions (prod) para esconder o token e evitar CORS
- **Nunca chamar direto do frontend** - sempre pelo proxy
- Sync logic em `hooks/useSyncSystem.ts`
- 📄 **Detalhamento completo** (quais endpoints, quando e fluxo do sync): `docs/architecture/external-api-calls.md`

## Google Gemini

- Previsões assistidas por IA
- Wrapped por `services/geminiService.ts`
- Endpoint em `api/gemini-prediction.ts`

## Google Sign-In

- Carregado via CDN em `index.html`
- Fornece fluxo de autenticação externo
