> **⚠️ Estado atual (autoritativo) — ver seção "Implementação Atual" abaixo.**
> O texto histórico a partir de "## Objetivo" descreve um plano inicial (tabela
> `app_versions` separada + polling `useVersionChecker`) que NÃO reflete o código
> atual. A implementação real usa Supabase Realtime sobre `system_config`, sem
> polling, e a versão é publicada **por deploy**.

## Implementação Atual

### Como funciona

1. O bundle carrega com `CURRENT_VERSION` (de `data/releases.ts`) embutido.
2. No `postbuild` de produção da Vercel, `scripts/publish-version.mjs` chama a RPC
   `publish_app_version(target, version)` → grava `system_config.app_versions[target]`.
3. O Supabase Realtime propaga a mudança para as abas abertas (`DatabaseContext`
   atualiza `systemConfig`).
4. `hooks/useUpdateAvailable.ts` compara `app_versions[DEPLOY_TARGET]` com
   `CURRENT_VERSION`; se divergir, mostra o banner/modal de atualização.

### Versão POR deploy (anti-corrida)

Os deploys `bolao` (Vercel do Fernando) e `miguelfork` (Vercel do Miguel)
compartilham o **mesmo banco**. Se a versão fosse única, quem deployasse primeiro
sinalizaria "nova versão" para o outro **antes** do build correspondente subir →
usuário preso no modal recarregando um bundle que ainda não existe.

Solução: cada deploy publica/lê **só a sua chave** em `app_versions`
(`{ "bolao": "1.36.0", "miguelfork": "1.35.1" }`).

**Identificação automática do deploy (sem env var manual na Vercel):** o alvo é
derivado de `VERCEL_GIT_REPO_OWNER` (injetado pela Vercel em build) por
`scripts/deploy-target.mjs`:

| Dono do repo | `DEPLOY_TARGET` |
|---|---|
| `Miguel-de-Castro` | `miguelfork` |
| `fernandofraga109` / local / outro | `bolao` |

- Build: `vite.config.ts` injeta `import.meta.env.VITE_DEPLOY_TARGET`; o cliente lê
  via `utils/deployTarget.ts` (fallback `bolao` em dev/test).
- Publish: `publish-version.mjs` deriva o mesmo target e chama
  `publish_app_version(target, version)`.

### Workflow de release (atual)

1. Bumpar `CURRENT_VERSION` em `data/releases.ts` (agente `changelog-updater`).
2. Deploy. O `postbuild` publica `app_versions[<seu deploy>]` automaticamente.
3. Cada app notifica seus usuários quando o **próprio** deploy subiu — sem corrida.

### Passo manual de banco

Aplicar a migration `0030_per_deploy_app_versions.sql` no Supabase compartilhado
(adiciona `app_versions jsonb` + função `publish_app_version(target, v)`). Coluna
nullable → enquanto a chave do deploy estiver ausente, nenhum banner dispara.

### Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `scripts/deploy-target.mjs` | `resolveDeployTarget(owner)` (build) |
| `utils/deployTarget.ts` | `DEPLOY_TARGET` para o cliente |
| `vite.config.ts` | injeta `import.meta.env.VITE_DEPLOY_TARGET` |
| `scripts/publish-version.mjs` | publica `app_versions[target]` no postbuild |
| `hooks/useUpdateAvailable.ts` | compara a versão do deploy com o bundle |
| `database/migrations/0030_per_deploy_app_versions.sql` | coluna + RPC keyed |

---

# (Histórico) Sistema de Verificação de Versão com Modal Obrigatório e Refresh Agressivo

Implementar um sistema que detecta atualizações do app comparando a versão local com a versão armazenada no Supabase, bloqueia sync automático se a versão estiver desatualizada e exibe modal obrigatório com refresh agressivo para forçar atualização do frontend.

## Objetivo

Criar um mecanismo que verifica periodicamente a versão do app, bloqueia sync automático se a versão estiver desatualizada e exibe modal obrigatório com refresh agressivo para forçar atualização do frontend, evitando que usuários com código antigo executem operações problemáticas no banco.

## Arquivos a Criar

### 1. `database/migrations/0028_add_app_versions.sql`
- Criar tabela `app_versions` com colunas: `id`, `version`, `updated_at`
- Habilitar RLS com políticas:
  - `anon/authenticated` podem ler (SELECT)
  - Apenas `ADMIN` pode inserir/atualizar (INSERT/UPDATE)
- Adicionar comentários explicativos

### 2. `hooks/useVersionChecker.ts`
- Hook que verifica versão no Supabase a cada 5 minutos
- Compara versão do banco com `CURRENT_VERSION` de `data/releases.ts`
- **SEM opção de dispensar** - atualização é obrigatória
- Funções expostas:
  - `updateAvailable`: boolean se há atualização
  - `latestVersion`: versão mais recente do banco
  - `currentVersion`: versão local atual
  - `forceRefresh()`: recarrega página com timestamp na URL (refresh agressivo)
  - `checkVersion()`: verificação manual sob demanda
  - `isVersionOutdated()`: retorna true se versão local está desatualizada (usado pelo sync)

### 3. `components/ui/UpdateAvailableModal.tsx`
- Modal usando `ModalShell` existente
- Exibe versão atual vs versão mais recente
- **Apenas um botão**: "Atualizar Agora" - chama `forceRefresh()` com ícone RefreshCw
- **SEM botão de dispensar** - atualização é obrigatória
- Usa ícone AlertCircle para indicar atualização disponível
- Modal não pode ser fechado pelo botão X (showCloseButton={false})

## Arquivos a Modificar

### 4. `App.tsx`
- Adicionar imports: `useVersionChecker`, `UpdateAvailableModal`
- Chamar hook `useVersionChecker()` após hooks existentes
- Passar `isVersionOutdated` para `useBackgroundSync` como prop
- Adicionar JSX do modal antes do fechamento do div principal (condicional: `updateAvailable && latestVersion`)

### 5. `hooks/useBackgroundSync.ts`
- Adicionar prop opcional `isVersionOutdated?: () => boolean`
- Adicionar guarda no início da função `tick()`: se `isVersionOutdated()` retorna true, pular sync completamente
- Logar aviso quando sync é bloqueado por versão desatualizada

### 6. `database/seed/system_config.sql`
- Adicionar INSERT inicial para versão atual (1.30.0)
- Usar `ON CONFLICT (version) DO NOTHING` para idempotência

## Detalhes de Implementação

### Refresh Agressivo
Usar timestamp na URL para garantir que navegador baixe recursos novos:
```typescript
const url = new URL(window.location.href);
url.searchParams.set('v', Date.now().toString());
window.location.href = url.toString();
```
- Força o navegador a tratar como página nova
- Ignora cache de HTML, CSS, JS
- **NÃO desloga o usuário** - cookies de sessão do Supabase são preservados
- localStorage também é preservado

### Verificação de Versão
- Hook verifica versão no Supabase a cada 5 minutos
- Compara versão do banco com `CURRENT_VERSION` do código
- Se diferentes, mostra modal obrigatório
- Não há opção de dispensar - atualização é forçada

### Bloqueio de Sync
- No início de cada tick do `useBackgroundSync`, chama `isVersionOutdated()`
- Se desatualizado, pular sync completamente e logar aviso
- Isso evita que código antigo execute operações problemáticas no banco

## Workflow de Atualização Futura

Quando fizer novo release:
1. Atualizar `CURRENT_VERSION` em `data/releases.ts`
2. Inserir nova versão no Supabase via SQL:
   ```sql
   INSERT INTO app_versions (version) VALUES ('1.31.0')
   ON CONFLICT (version) DO NOTHING;
   ```
3. Deploy da nova versão
4. Usuários serão notificados automaticamente

## Testes

### Teste Manual
1. Aplicar migração no Supabase
2. Executar seed inicial
3. Rodar app localmente
4. Via SQL Editor, mudar versão no banco para '1.31.0'
5. Aguardar até 5 minutos ou chamar verificação manual
6. Verificar se modal aparece (obrigatório, sem botão de dispensar)
7. Verificar que modal não pode ser fechado pelo X
8. Testar botão "Atualizar Agora"
9. Verificar se reload funciona com timestamp na URL
10. Verificar que usuário continua logado após refresh
11. Verificar que sync automático é bloqueado quando versão está desatualizada (ver logs)

## Ordem de Execução

1. Criar migração SQL
2. Criar hook useVersionChecker (sem dismiss)
3. Criar modal UpdateAvailableModal (botão único obrigatório)
4. Integrar no App.tsx
5. Modificar useBackgroundSync para bloquear sync se versão desatualizada
6. Adicionar seed em system_config.sql
7. Testar manualmente
