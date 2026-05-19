# Deploy na Vercel — Bolão Copa 2026

Guia completo para colocar o projeto em produção na Vercel.
Nenhuma alteração no código é necessária — siga os passos na ordem.

---

## Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Repositório no GitHub (já conectado ou a conectar)
- Projeto no [Supabase](https://supabase.com) configurado e com as migrations rodadas
- Chave da [Football Data API](https://www.football-data.org) (conta gratuita tem rate limit de 10 req/min)
- (Opcional) Chave da [Google Gemini API](https://aistudio.google.com)

---

## Passo 1 — Criar `vercel.json`

Sem esse arquivo, qualquer rota acessada diretamente (ex: alguém compartilha um link) retorna **404**.

Crie o arquivo `vercel.json` na raiz do projeto:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

> O padrão `/((?!api/).*)` encaminha tudo para o SPA **exceto** as rotas `/api/**`, que são as Edge Functions.

---

## Passo 2 — Importar o projeto na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Clique em **"Import Git Repository"** e selecione este repositório
3. Em **Framework Preset** a Vercel deve detectar automaticamente **Vite**
4. Confirme as configurações de build:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. **Não clique em Deploy ainda** — configure as variáveis primeiro (Passo 3)

---

## Passo 3 — Variáveis de ambiente

Na tela de configuração do projeto (ou depois em **Settings > Environment Variables**), adicione todas as variáveis abaixo para o ambiente **Production**:

| Variável | Onde encontrar | Obrigatória |
|----------|---------------|-------------|
| `VITE_SUPABASE_URL` | Supabase > Settings > API > Project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon key | ✅ |
| `VITE_SUPABASE_SCHEMA` | Valor fixo: `public` | ✅ |
| `SUPABASE_URL` | Mesmo valor de `VITE_SUPABASE_URL` | ✅ (Edge Functions) |
| `SUPABASE_ANON_KEY` | Mesmo valor de `VITE_SUPABASE_ANON_KEY` | ✅ (Edge Functions) |
| `FOOTBALL_DATA_TOKEN` | football-data.org > Account > API Token | ✅ |
| `GEMINI_API_KEY` | aistudio.google.com > Get API key | ❌ (só para previsões IA) |

> **Atenção:** Variáveis com prefixo `VITE_` são expostas no browser. Nunca coloque a service role key do Supabase com esse prefixo — use sempre a anon key.

---

## Passo 4 — Configurar domínio no Supabase

Sem isso, o login e o redirect de recuperação de senha não funcionam em produção.

1. Acesse seu projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **Authentication > URL Configuration**
3. Configure:
   - **Site URL**: `https://SEU-PROJETO.vercel.app`
   - **Redirect URLs**: adicione `https://SEU-PROJETO.vercel.app/**`

Se você tiver um domínio customizado (ex: `bolao.seudominio.com`), adicione ele também.

---

## Passo 5 — Configurar Google Sign-In (se estiver usando)

Se o projeto usa Google Sign-In via CDN, o domínio Vercel precisa ser autorizado no Google Cloud Console.

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Selecione o projeto Google
3. Vá em **APIs & Services > Credentials**
4. Edite o OAuth 2.0 Client ID usado pelo projeto
5. Em **Authorized JavaScript origins**, adicione:
   ```
   https://SEU-PROJETO.vercel.app
   ```
6. Em **Authorized redirect URIs**, adicione:
   ```
   https://SEU-PROJETO.vercel.app
   https://SEU-PROJETO.vercel.app/auth/callback
   ```
7. Salve e aguarde ~5 minutos para propagar

---

## Passo 6 — Fazer o deploy

De volta à Vercel, clique em **Deploy**. O processo leva ~1-2 minutos.

Ao terminar, a Vercel vai exibir a URL de produção (ex: `https://bolao-copa-do-mundo-2026.vercel.app`).

---

## Verificação pós-deploy (smoke test)

Execute estes testes manualmente após o deploy:

- [ ] Acessar a URL raiz carrega a tela de login
- [ ] Login com email/senha funciona
- [ ] (Se habilitado) Login com Google funciona
- [ ] Após login, a aba de Jogos carrega com os partidas
- [ ] Fazer um palpite e verificar que ele é salvo
- [ ] Acessar `/leaderboard` diretamente no browser não retorna 404
- [ ] Como admin: painel de admin aparece na navegação
- [ ] Como admin: botão de sync manual funciona (busca dados da Football Data API)

---

## Domínio customizado (opcional)

1. Na Vercel, vá em **Settings > Domains**
2. Adicione seu domínio e siga as instruções de DNS
3. Após configurar, **repita os Passos 4 e 5** com o novo domínio

---

## Troubleshooting

### Página retorna 404 ao acessar rota diretamente
→ O `vercel.json` não foi criado ou não foi commitado. Verifique o Passo 1.

### Login com Google não funciona
→ O domínio Vercel não está autorizado no Google Cloud Console. Execute o Passo 5.

### Sync não traz dados (Football Data API retorna erro)
→ Verifique se `FOOTBALL_DATA_TOKEN` está corretamente configurado nas env vars (Passo 3). A API gratuita tem rate limit; aguarde 1 minuto e tente novamente.

### Erro de CORS nas chamadas de API
→ Em produção as chamadas vão para `/api/*` (Edge Functions da Vercel) — não para o proxy do Vite. Verifique se as Edge Functions em `api/` estão lendo as variáveis de ambiente corretamente.

### Supabase Realtime não conecta
→ Confirme que o `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estão corretos. O Realtime usa WebSocket — funciona normalmente com a Vercel sem configuração extra.

### Build falha com "vite: command not found"
→ A Vercel precisa instalar as devDependencies. Verifique se o `package.json` tem `vite` em `devDependencies` (não em `dependencies`).
