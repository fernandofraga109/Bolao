<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1xbCCKLOBHqxSshFVcH7In6ALelOWqw6n

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Observações Técnicas

### Automação de Sincronização (Auto-Sync)

Atualmente, a rotina de automação que busca resultados das partidas e atualiza as pontuações a cada 5 minutos roda no **frontend** (via setInterval no React em hooks/useMatchSystem.ts). 

**Limitação Importante:** Isso significa que a automação **só funciona enquanto a aba do Painel de Administração estiver aberta** no navegador de um usuário administrador. Se o navegador for fechado, as partidas não serão atualizadas automaticamente até que o painel seja aberto novamente.

**Solução Futura (Para rodar 24/7):** Para que o sync funcione em background de forma contínua e independente do navegador, essa rotina deve ser migrada para uma **Supabase Edge Function** e agendada usando a extensão **pg_cron** do PostgreSQL.

