# Sistema de Verificação de Versão com Modal Obrigatório e Refresh Agressivo

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
