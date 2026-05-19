<div align="center">
  <h1>🏆 Bolão Copa do Mundo 2026</h1>
  <p>Um aplicativo completo de bolão para competições de futebol com múltiplos regulamentos de pontuação</p>
</div>

## 📋 Sobre o Projeto

O **Bolão Copa do Mundo 2026** é um aplicativo web completo para gerenciar bolões de apostas em competições de futebol. Desenvolvido com React, TypeScript e Supabase, o sistema suporta múltiplos grupos, diferentes regulamentos de pontuação, sincronização automática de partidas, e previsões assistidas por IA.

### ✨ Funcionalidades Principais

- **👥 Gestão de Grupos**: Crie e gerencie múltiplos grupos de apostadores
- **🎯 Palpites de Partidas**: Faça previsões para jogos de fase de grupos e mata-mata
- **🏆 Palpites de Torneio**: Preveja campeão, artilheiro, melhor jogador, goleiro e mais
- **📊 Classificações**: Leaderboards por grupo com cálculo automático de pontos
- **🔄 Sincronização Automática**: Atualização de resultados de partidas em tempo real
- **🤖 Previsões com IA**: Integração com Google Gemini para sugestões de palpites
- **📱 Interface Responsiva**: Design moderno otimizado para mobile e desktop
- **🔐 Autenticação**: Sistema de login com recuperação de senha
- **⚙️ Painel Admin**: Interface administrativa para gerenciar usuários e partidas
- **🌐 Múltiplas Competições**: Suporte para Copa do Mundo, ligas nacionais e outras competições

## 🛠️ Stack Tecnológico

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

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase (https://supabase.com)
- (Opcional) Chave de API do Google Gemini para previsões com IA

### Passo 1: Clone o Repositório

```bash
git clone <seu-repositorio>
cd bolao-copa-do-mundo-2026
```

### Passo 2: Instale as Dependências

```bash
npm install
```

### Passo 3: Configure o Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Vá em Settings > API e copie:
   - Project URL
   - anon/public key
3. Execute o schema do banco de dados:
   - Abra o arquivo `db_schema.ts`
   - Copie o conteúdo da constante `SUPABASE_SCHEMA_SQL`
   - Cole no SQL Editor do Supabase e execute

### Passo 4: Configure as Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```bash
# Supabase (obrigatório)
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_SUPABASE_SCHEMA=public

# (Opcional) Google Gemini para previsões com IA
GEMINI_API_KEY=sua-chave-gemini

# (Opcional) football-data.org para sincronização de partidas
FOOTBALL_DATA_TOKEN=seu-token-football-data
```

### Passo 5: Execute o Aplicativo

```bash
npm run dev
```

O aplicativo estará disponível em `http://localhost:5173`

## 📊 Estrutura do Banco de Dados

O sistema utiliza as seguintes tabelas principais:

- **teams** - Informações das seleções/equipes
- **team_standings** - Classificações por competição
- **stadiums** - Estádios e localizações
- **profiles** - Perfis de usuários
- **user_roles** - Roles de usuários (ADMIN/USER)
- **groups** - Grupos de apostadores
- **user_groups** - Relação usuário-grupo
- **matches** - Partidas e resultados
- **predictions** - Palpites de partidas
- **tournament_predictions** - Palpites de torneio (campeão, artilheiro, etc.)
- **extra_phase_predictions** - Palpites extras por fase (Regulamento 2)

## 🎯 Regulamentos de Pontuação

O sistema suporta dois regulamentos diferentes, configuráveis por grupo:

### Regulamento 1 (Padrão)

Sistema de pontuação simples com bônus para underdogs:

- **Placar Exato**: 10 pontos
- **Diferença de Gols**: 7 pontos
- **Resultado (vencedor/empate)**: 5 pontos
- **Bônus Underdog**: Até +5 pontos quando equipe pior rankeada vence

#### Pontuação de Torneio
- Campeão: 100 pontos
- Artilheiro (nome): 100 pontos
- Artilheiro (gols): 100 pontos
- Melhor Jogador: 100 pontos
- Melhor Goleiro: 100 pontos

### Regulamento 2 (Bolão do Mesa 2026)

Sistema de pontuação dinâmico baseado na quantidade de acertos:

#### Fase de Grupos
- **Resultado**: 10 pontos
- **Resultado + Diferença**: 13 pontos (não aplica em empates)
- **Placar Exato**: 15 pontos
- **Placar Isolado**: +5 pontos extras (se apenas 1 pessoa acertar)
- **Classificados (G2)**: 10 pontos por acerto

#### Segunda Fase (Oitavas, Quartas, Semi)
- **Resultado**: 10 pontos
- **Resultado + Diferença**: 13 pontos
- **Placar Exato**: 15 pontos
- **Placar Isolado**: +5 pontos
- **Classificado**: 5 pontos

#### Disputa de 3º Lugar
- **Resultado**: 12 pontos
- **Resultado + Diferença**: 15 pontos
- **Placar Exato**: 17 pontos
- **Placar Isolado**: +5 pontos

#### Final
- **Resultado**: 16 pontos
- **Resultado + Diferença**: 19 pontos
- **Placar Exato**: 22 pontos
- **Placar Isolado**: +5 pontos

#### Pontuação de Torneio (Dividida)
- **Campeão**: 
  - Acerto isolado: 100 pontos
  - 2 pessoas: 70 pontos cada
  - 3 pessoas: 50 pontos cada
  - 4+ pessoas: 40 pontos cada

- **Artilheiro**:
  - Acerto isolado: 60 pontos
  - 2 pessoas: 40 pontos cada
  - 3 pessoas: 30 pontos cada
  - 4+ pessoas: 25 pontos cada

- **Palpites Extras**: 20 pontos cada (maior goleada, mais gols sofridos, jogo com maior diferença)

## 🏗️ Arquitetura do Projeto

```
bolao-copa-do-mundo-2026/
├── api/                    # Integrações com APIs externas
├── components/             # Componentes React
│   ├── pages/             # Páginas principais
│   └── ui/                # Componentes UI reutilizáveis
├── contexts/              # Contextos React
├── data/                  # Dados estáticos e seeds
├── database/              # Schema e migrations do banco
├── docs/                  # Documentação
├── hooks/                 # Custom React hooks
├── services/              # Serviços (Supabase, Gemini, etc.)
├── utils/                 # Funções utilitárias (scoring, etc.)
├── App.tsx               # Componente principal
├── types.ts              # Definições de tipos TypeScript
└── constants.ts          # Constantes da aplicação
```

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia o servidor de desenvolvimento

# Build
npm run build            # Build para produção
npm run preview          # Preview do build de produção

# Testes
npm run test             # Executa testes
npm run test:watch       # Executa testes em modo watch
npm run test:ui          # Executa testes com interface UI

# Lint e Formatação
npm run lint             # Verifica problemas de lint
npm run lint:fix         # Corrige problemas de lint automaticamente
npm run format           # Formata o código com Prettier
```

## 🔧 Configuração de Admin

Para criar um usuário administrador:

1. Crie um usuário normal através da interface
2. Acesse o banco de dados via Supabase SQL Editor
3. Atualize o role do usuário na tabela `user_roles`:

```sql
UPDATE public.user_roles 
SET role = 'ADMIN' 
WHERE "userId" = 'uuid-do-usuario';
```

## 🌐 Deploy

### Vercel (Recomendado)

1. Instale a CLI do Vercel: `npm i -g vercel`
2. Configure as variáveis de ambiente no painel do Vercel
3. Deploy: `vercel`

### Variáveis de Ambiente no Vercel

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SCHEMA`
- `GEMINI_API_KEY` (opcional)
- `FOOTBALL_DATA_TOKEN` (opcional)

## ⚠️ Observações Técnicas

### Automação de Sincronização (Auto-Sync)

Atualmente, a rotina de automação que busca resultados das partidas e atualiza as pontuações a cada 5 minutos roda no **frontend** (via setInterval no React em `hooks/useMatchSystem.ts`).

**Limitação Importante:** Isso significa que a automação **só funciona enquanto a aba do Painel de Administração estiver aberta** no navegador de um usuário administrador. Se o navegador for fechado, as partidas não serão atualizadas automaticamente até que o painel seja aberto novamente.

**Solução Futura (Para rodar 24/7):** Para que o sync funcione em background de forma contínua e independente do navegador, essa rotina deve ser migrada para uma **Supabase Edge Function** e agendada usando a extensão **pg_cron** do PostgreSQL.

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto é privado e propriedade de seus criadores.

## 📞 Suporte

Para dúvidas ou problemas, entre em contato com os administradores do sistema.

