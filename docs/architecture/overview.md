# Visão Geral da Arquitetura

## Stack Tecnológico

### Frontend
- **React 19** - Framework UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Lucide React** - Ícones
- **Tailwind CSS** - Estilização (via classes)

### Backend
- **Supabase** - Banco de dados PostgreSQL, autenticação e realtime
- **football-data.org API** - Dados de partidas e classificações
- **Google Gemini AI** - Previsões assistidas por IA

### Testes
- **Vitest** - Framework de testes
- **Testing Library** - Testes de componentes React
- **Happy DOM** - Ambiente DOM para testes

## Estrutura de Diretórios

```
hooks/             — lógica de negócio (um hook por domínio)
contexts/          — DatabaseContext.tsx é a raiz de estado
components/
  pages/           — views completas (uma por rota)
  ui/              — primitivos UI reutilizáveis
  (raiz)           — layout compartilhado (Header, BottomNav, etc.)
services/          — clientes externos (supabase, gemini, liveScore)
api/               — wrappers de fetch (Football Data, Gemini, auth)
database/
  migrations/      — migrações Supabase numeradas (aplicar em ordem)
  rls/             — políticas RLS atuais
  seed/            — SQL de seed
data/              — dados estáticos (times, jogos, estádios, competições)
utils/             — funções puras (scoring)
types.ts           — todas as interfaces TypeScript compartilhadas
constants.ts       — constantes globais e estado inicial
```

## Comandos

```bash
npm run dev        # Dev server (porta 3000)
npm run build      # Build de produção
npm run test       # Vitest (single run)
npm run lint       # ESLint
npm run format     # Prettier
```

## Idioma

O app é em português brasileiro. Manter textos do UI em pt-BR.
