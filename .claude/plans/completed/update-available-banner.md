# Plano: Banner "Nova versão disponível — Atualizar" (staleness de UI)

_Status: DONE — 2026-06-11. Mergeado (PR #10) e deployado. Banner + Opção C (postbuild + RPC `publish_app_version` SECURITY DEFINER, sem service_role). Migrations 0028/0029. CURRENT_VERSION 1.32.0. Bootstrap conhecido: abas abertas no 1º deploy do banner não recebem aviso (sem o código ainda); ficam armadas após 1 reload._

## Problema

Mudanças **client-side** (componentes, layout, lógica de scoring no browser, novos
campos de UI) NÃO chegam a uma aba já aberta: o bundle JS antigo fica em memória
até um reload. Diferente de mudanças server-side (proxies/Supabase), que valem
imediatamente. Não há como "garantir" atualização de UI sem um reload — o caminho
padrão (Gmail/Figma) é **detectar versão nova e oferecer um banner "Atualizar"**,
deixando o usuário escolher a hora (auto-reload perde input em digitação, ex.: um
palpite perto do lock de um jogo).

## Decisão de design

**Reaproveitar `system_config` + Realtime** (já existe), sem polling novo.

- O bundle em execução conhece sua versão de build: `CURRENT_VERSION` (`data/releases.ts`).
- O servidor publica a versão atual numa coluna de `system_config` (ex.: `app_version`).
- `system_config` já tem subscription Realtime → `setSystemConfig(newRecord)`
  (`DatabaseContext.tsx`). A aba aberta recebe a nova `app_version` **ao vivo, sem reload**.
- Quando `systemConfig.app_version` (servidor, live) ≠ `CURRENT_VERSION` (bundle em
  memória) → mostra o banner. Clique → `window.location.reload()`.

Comparar por **igualdade de string** (não "maior que") é suficiente e evita parsing
de semver; qualquer divergência = recarregar. Guardar contra falso-positivo quando
`app_version` vier vazio/null (config legada): só dispara se `app_version` truthy.

## IMPORTANTE: o deploy sozinho NÃO notifica ninguém

Um deploy na Vercel só publica arquivos estáticos novos no servidor. As abas já
abertas continuam rodando o bundle velho e **não têm como saber** que houve deploy —
não existe "hook" automático do deploy para dentro do navegador. O que alcança todo
mundo é um **evento de Realtime do Supabase** quando `system_config.app_version` muda.

Sequência real (repare no passo 2 — é ele que falta se o banner "não aparecer"):

```
1. Deploy publica o bundle novo (estático)
   → abas abertas: NADA muda, seguem no código velho
2. ALGUÉM grava system_config.app_version = <nova versão>     ← O GATILHO (Fase 2)
3. Supabase Realtime empurra a linha p/ TODAS as abas conectadas
   → este é o "alcançar todo mundo" (Realtime, NÃO o deploy)
4. Cada aba: app_version(nova) ≠ CURRENT_VERSION(velha, no bundle) → isStale → banner
5. Usuário clica "Atualizar" → location.reload() → busca bundle novo
   → versões batem → banner some
```

A **verificação é passiva/derivada** (o usuário não faz nada): roda no boot quando
`systemConfig` carrega e a cada evento Realtime de `system_config`. `isStale === false`
→ sem reload, sem banner. `isStale === true` → banner, e o reload só acontece quando o
usuário clica. Sem o passo 2, o banner **nunca dispara**.

## Fases

### Fase 1 — Backend / config
- Migration: adicionar coluna `app_version text` em `system_config` (nullable).
- Backfill inicial com a versão atual.
- `types.ts`: `SystemConfigDB` ganha `appVersion?: string`.

### Fase 2 — Gatilho de publicação da versão (o ponto operacional = passo 2 da sequência)
Algo precisa gravar `system_config.app_version = CURRENT_VERSION` a cada deploy. Sem
isso, nada chega às abas abertas. Opções:
- **(a) Manual/admin:** botão no AdminDashboard "Publicar versão atual" → `updateSystemConfig({ appVersion: CURRENT_VERSION })`. Simples, zero infra; manual e fácil de esquecer.
- **(b) Bootstrap no load do admin:** quando um admin abre o app com bundle novo, se `CURRENT_VERSION ≠ systemConfig.appVersion`, auto-publica. Sem ação manual, mas depende de um admin abrir o app para "propagar" a versão aos demais.
- **(c) CI/Vercel Deploy Hook (RECOMENDADA pelo usuário):** automatizar o passo 2 no
  próprio pipeline de deploy, sem depender de ninguém abrir o app.
  - **Como:** a Vercel dispara um evento `deployment.succeeded`. Capturá-lo de duas formas:
    1. **Deploy Hook + endpoint próprio:** um endpoint em `api/` (ex.: `api/publish-version.ts`)
       que, ao ser chamado pós-deploy, faz `upsert` em `system_config` com a versão.
    2. **Vercel Integration / webhook `deployment.succeeded`** apontando para esse endpoint,
       OU um passo no build (`vercel.json` `buildCommand`/script de postbuild) que roda o upsert.
  - **Qual versão publicar:** ler `CURRENT_VERSION` de `data/releases.ts` no momento do
    build/deploy (é a fonte única) e gravá-la — assim a versão publicada SEMPRE casa com a
    do bundle que acabou de subir, sem digitar nada à mão.
  - **Auth do write:** usar a **Supabase service role key** (apenas server-side, nunca no
    bundle) para o upsert, contornando RLS com segurança. Variável de ambiente na Vercel.
  - **Idempotência:** upsert por linha única de `system_config` (já é `.single()`); escrever
    só se a versão mudou para evitar eventos Realtime redundantes.
  - **Vantagem:** o passo 2 vira garantido e automático — todo deploy notifica todas as abas,
    sem janela em que a versão nova está no ar mas o banco ainda aponta pra velha.
  - **Custo:** configurar o webhook/endpoint + a env var de service role na Vercel.
- Recomendação: implementar **(c)** como alvo final (interesse do usuário). Pode-se começar
  com **(a)** como fallback manual enquanto o hook não está configurado.

### Fase 3 — Frontend (banner)
- Hook `useUpdateAvailable()`: deriva `isStale = !!systemConfig.app_version && systemConfig.app_version !== CURRENT_VERSION`.
- Componente `UpdateAvailableBanner` (em `components/ui/`): barra fixa no topo,
  texto "Nova versão disponível", botão "Atualizar" → `location.reload()`. Dismissível
  por versão (uma versão ainda mais nova reaparece). Não bloqueante.
- Render em `App.tsx`, logo após `<Header>`, sem auto-reload.

### Fase 4 — Testes (test-runner)
- `useUpdateAvailable`: stale quando versões divergem, não-stale quando iguais/null.
- Banner: render condicional + `reload` no clique (mock de `location.reload`).

---

## ✅ Passo a passo de execução (checklist)

### O que JÁ está implementado nesta branch (código)
- [x] **Fase 1** — Migration `database/migrations/0028_add_app_version_to_system_config.sql` (coluna `app_version text`, nullable, com e sem prefixo `v2_`). `types.ts`: `SystemConfigDB.app_version?: string | null`.
- [x] **Fase 3** — `hooks/useUpdateAvailable.ts`, `components/ui/UpdateAvailableBanner.tsx`, render em `App.tsx` após `<Header>`.
- [ ] **Fase 4** — testes (delegar ao `test-runner`).

### O que VOCÊ precisa rodar (operacional)

**1. Aplicar a migration no Supabase** (dev e prod) — rodar o SQL abaixo no SQL Editor:
```sql
ALTER TABLE IF EXISTS system_config    ADD COLUMN IF NOT EXISTS app_version text;
ALTER TABLE IF EXISTS v2_system_config ADD COLUMN IF NOT EXISTS app_version text;
```
> Idempotente: pode rodar quantas vezes quiser. Enquanto `app_version` for NULL, o banner não aparece (seguro).

**2. Publicar a versão (Fase 2 / passo 2 da sequência).** Sem isto, a coluna nunca muda e o banner nunca dispara. Escolher UMA via:

- **Manual (rápido, p/ validar agora):** no SQL Editor, após um deploy:
  ```sql
  UPDATE v2_system_config SET app_version = '1.31.0';  -- = CURRENT_VERSION recém-deployada
  ```
- **Opção C — Vercel Deploy Hook (alvo final, automático):** ver bloco abaixo.

### Receita de teste LOCAL (sem deploy)
1. `npm run build && npm run preview` (NÃO `npm run dev` — o HMR atrapalha; precisa do `CURRENT_VERSION` congelado no bundle).
2. Abrir o preview. A app carrega com, digamos, `CURRENT_VERSION = "1.31.0"`.
3. No Supabase (schema `dev`): `UPDATE v2_system_config SET app_version = '1.32.0';`
4. O Realtime entrega → o banner aparece **na hora** na aba aberta (testar com 2 abas).
5. Clicar "Atualizar" → reload → versões batem → banner some. Clicar no "X" → some até sair uma versão ainda mais nova.

### Opção C — IMPLEMENTADA via `postbuild` + RPC `SECURITY DEFINER` (2026-06-11)

Escolhida a variante **script de build + função Postgres** (NÃO usa `service_role_key`):
zero rota pública, zero secret poderoso, dispara a cada deploy (o `postbuild` roda depois
do `vite build`). A escrita no banco é feita por uma função `SECURITY DEFINER` chamada com
a **anon key** (já pública). Se a anon key for mal-usada, o pior é setar a coluna de versão
(um banner) — nenhum acesso a dados sensíveis.

**Arquivos (já no repo):**
- `database/migrations/0029_publish_app_version_function.sql` — função
  `publish_app_version(v text)` `SECURITY DEFINER` que faz
  `UPDATE system_config SET app_version = v WHERE app_version IS DISTINCT FROM v`
  (só escreve se mudou). `GRANT EXECUTE ... TO anon, authenticated`.
- `scripts/publish-version.mjs` — lê `CURRENT_VERSION` de `data/releases.ts` e chama
  `supabase.rpc("publish_app_version", { v })` com a **anon key**.
- `package.json` → `"postbuild": "node scripts/publish-version.mjs"`.

**Guardas (não publica em build local):**
- Só roda se `VERCEL_ENV === "production"`.
- Nunca derruba o build (erros são logados, sai com 0).

**Passos manuais (uma vez só):**
1. **Rodar a migration `0029`** no Supabase (cria a função). Sem ela, o script loga erro
   não-fatal e o banner fica dormente.
2. Conferir que `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SCHEMA` já
   estão nas env vars da Vercel (já estão — são as do app). **Nenhum segredo novo.**
3. Bumpar `CURRENT_VERSION` (via `changelog-updater`) faz parte de cada release; o deploy
   seguinte publica essa versão sozinho.

**Validar:** após o próximo deploy de produção, conferir nos logs de build
`[publish-version] app_version publicada: "x" ✅` e que `system_config.app_version` mudou.
Uma aba antiga aberta deve receber o banner via Realtime.

> Fallback manual continua possível: `UPDATE v2_system_config SET app_version = '<versão>';`

## Reforço opcional (defesa em profundidade)
- Capturar `ChunkLoadError` (chunk lazy removido no deploy) → forçar reload. Pega o
  caso em que a aba antiga navega e tenta carregar um chunk que não existe mais.

## Risco / rollback
- Baixo: feature aditiva. Pior caso = banner não aparece (degrada para o
  comportamento atual). Sem auto-reload → não há risco de perda de input.

## Não-objetivos
- Não cobre staleness de **dados** — isso já é resolvido por Realtime/polling.
- Não troca código em runtime (impossível sem reload); apenas sinaliza e recarrega.
