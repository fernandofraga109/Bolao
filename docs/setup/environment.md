# Variáveis de Ambiente

## Obrigatórias

```bash
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_SUPABASE_SCHEMA=public  # ou 'dev' para desenvolvimento
```

## Opcionais

```bash
# Google Gemini para previsões com IA
GEMINI_API_KEY=sua-chave-gemini

# football-data.org para sincronização de partidas
FOOTBALL_DATA_TOKEN=seu-token-football-data
```

## Setup

1. Criar arquivo `.env.local` na raiz do projeto
2. Copiar variáveis de `.env.example`
3. Preencher com valores reais
4. Nunca commitar `.env.local`
