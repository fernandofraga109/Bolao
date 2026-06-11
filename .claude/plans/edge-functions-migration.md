# Plano: Edge Functions + pg_cron para Sync Automático

**Status:** PLANEJADO — Aguardando aprovação do usuário

---

## Problema

Sync de dados (matches, standings) é **user-triggered**, requerendo aba admin aberta. Resulta em:
- Dados estáticos quando ninguém tá sincronizando
- Impossível ter live scores reais
- Funcionamento limitado a desktop (mobile fecha aba)

---

## Solução Proposta

Migrar sync para **Supabase Edge Functions** + **pg_cron** (scheduler):
- **Edge Function** (`sync-football-data`) roda toda lógica de sync no servidor
- **pg_cron** agenda execução a cada hora (ou intervalo configurável)
- **Frontend** continua com Realtime listeners para atualizar UI quando dados mudam
- **Botão manual** persiste como fallback

---

## Arquitetura Futura

```
┌─────────────────────────────────────┐
│   React Frontend                    │
│  ┌─────────────────────────────────┤
│  │ MatchesPage / AdminDashboard    │
│  │ • Botão "Sincronizar" (manual)  │
│  │ • Realtime listeners (observa)  │
│  └─────────────────────────────────┤
└────────────────┬────────────────────┘
                 │
        ┌────────▼─────────┐
        │ HTTP (manual)    │
        └────────┬─────────┘
                 │
┌────────────────▼─────────────────────────────────────────┐
│  Supabase Edge Function: sync-football-data              │
│  ┌──────────────────────────────────────────────────────┤
│  │ • Fetch Football Data API (matches, standings)      │
│  │ • Processa dados (dedup, transform)                │
│  │ • Upsert em v2_matches, v2_team_standings          │
│  │ • Logs em audit_logs                               │
│  └──────────────────────────────────────────────────────┤
└───────────────┬────────────────────────────────────────┘
                │
        ┌───────▼─────────────────┐
        │ pg_cron (scheduler)     │
        │ Agendado: 0 * * * *     │
        │ (a cada hora, min 0)    │
        └─────────────────────────┘
```

---

## Gerenciamento de Secrets

### Tipos de Secrets Necessários

| Secret | Escopo | Necessidade | Onde Armazenar |
|--------|--------|-------------|-----------------|
| `FOOTBALL_DATA_API_KEY` | Edge Function | Essencial | Supabase Secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function | Essencial | Supabase Secrets |
| `SUPABASE_ANON_KEY` | pg_cron → HTTP | Para autorizar | Supabase Secrets |

### Fluxo de Secrets

#### **1. Development (Local)**

Arquivo: `.env.local` (gitignored)

```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...  # chave pública
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # chave admin (NUNCA em git)
FOOTBALL_DATA_API_KEY=abc123...  # sua API key (NUNCA em git)
```

Acessar em `supabase/functions/sync-football-data/index.ts`:
```typescript
const API_KEY = Deno.env.get("FOOTBALL_DATA_API_KEY");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
```

#### **2. Production (Supabase)**

**Adicionar secrets via Supabase CLI:**

```bash
# Login
supabase link --project-ref your-project-id

# Adicionar secret
supabase secrets set FOOTBALL_DATA_API_KEY="your-api-key"
supabase secrets set SUPABASE_ANON_KEY="your-anon-key"

# Listar secrets (só nomes, não valores)
supabase secrets list
```

Ou via **Supabase Dashboard:**
- Settings → Edge Functions → Environment variables
- Adicionar cada secret como um campo

#### **3. pg_cron (Agendador)**

pg_cron precisa fazer HTTP POST para chamar a Edge Function. Usa `SUPABASE_ANON_KEY` na autorização:

```sql
-- database/migrations/0028_schedule_sync_cron.sql

SELECT cron.schedule(
  'sync-football-data-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://your-project.supabase.co/functions/v1/sync-football-data',
      headers:='{"Authorization": "Bearer eyJ..."}'::jsonb,
      body:='{}'::jsonb,
      timeout_milliseconds:=300000
    ) as request_id;
  $$
);
```

**Problema:** `ANON_KEY` é um string literal na migration — **exposição de segurança**.

**Solução:** Usar `current_setting()` para ler de Postgres config:

```sql
-- database/migrations/0028_schedule_sync_cron.sql

-- Primeiro, store a anon key em Postgres config (uma vez)
-- ALTER DATABASE seu_db SET app.supabase_anon_key = 'eyJ...';

SELECT cron.schedule(
  'sync-football-data-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://your-project.supabase.co/functions/v1/sync-football-data',
      headers:=('{"Authorization": "Bearer ' || current_setting('app.supabase_anon_key') || '"}')::jsonb,
      body:='{}'::jsonb,
      timeout_milliseconds:=300000
    ) as request_id;
  $$
);
```

---

## Fases de Implementação

### **Fase 1: Setup Secrets e Supabase**

1. **Obter chaves Supabase:**
   - Dashboard → Project Settings → API
   - Copiar `anon public key` e `service_role key`

2. **Criar `.env.local`:**
   ```bash
   cat > .env.local << 'EOF'
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   FOOTBALL_DATA_API_KEY=your-api-key
   EOF
   ```

3. **Testar local:**
   ```bash
   supabase functions serve
   # Edge Function deve carregar sem erros
   ```

4. **Deploy secrets em produção:**
   ```bash
   supabase link --project-ref your-project-id
   supabase secrets set FOOTBALL_DATA_API_KEY="..."
   supabase secrets set SUPABASE_ANON_KEY="..."
   ```

---

### **Fase 2: Implementar Edge Function**

1. **Criar estrutura:**
   ```bash
   supabase functions new sync-football-data
   ```

2. **Escrever `supabase/functions/sync-football-data/index.ts`:**
   - Fetch Football Data API
   - Upsert matches/standings
   - Error handling e logging
   - (vide code template abaixo)

3. **Testar local:**
   ```bash
   # Terminal 1
   supabase functions serve
   
   # Terminal 2
   curl -X POST http://localhost:54321/functions/v1/sync-football-data \
     -H "Authorization: Bearer $ANON_KEY"
   ```

---

### **Fase 3: Ativar pg_cron e Scheduler**

1. **Criar migration para pg_cron:**
   ```sql
   -- database/migrations/0028_schedule_sync_cron.sql
   
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   
   -- Store anon key em config (executar 1x com valor real)
   ALTER DATABASE seu_db SET app.supabase_anon_key = 'eyJ...';
   
   SELECT cron.schedule(
     'sync-football-data-hourly',
     '0 * * * *',
     $$
     SELECT net.http_post(
       url:='https://your-project.supabase.co/functions/v1/sync-football-data',
       headers:=('{"Authorization": "Bearer ' || current_setting('app.supabase_anon_key') || '"}')::jsonb,
       body:='{}'::jsonb,
       timeout_milliseconds:=300000
     );
     $$
   );
   ```

2. **Aplicar migration:**
   ```bash
   supabase db push
   # ou rodar manualmente no Supabase SQL Editor
   ```

3. **Verificar agendador:**
   ```sql
   SELECT * FROM cron.job;  -- deve listar sync-football-data-hourly
   ```

---

### **Fase 4: Integração Frontend**

1. **Remover lógica de sync de `useSyncSystem.ts`:**
   - Manter botão "Sincronizar" que chama Edge Function via HTTP
   - Remover `setInterval` (agora gerenciado por pg_cron)

2. **Adicionar Realtime listeners** em `DatabaseContext.tsx`:
   ```typescript
   useEffect(() => {
     // Escutar mudanças em matches
     const subscription = supabase
       .channel('matches_changes')
       .on('postgres_changes', 
         { event: '*', schema: 'public', table: 'v2_matches' },
         (payload) => {
           console.log('[Realtime] Matches updated:', payload);
           refetchMatches(); // recarregar matches na UI
         }
       )
       .subscribe();

     return () => subscription.unsubscribe();
   }, []);
   ```

3. **Botão manual (Admin):**
   ```typescript
   const handleManualSync = async () => {
     setIsSyncing(true);
     try {
       const response = await fetch(
         `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-football-data`,
         {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${supabase.auth.session()?.access_token || ANON_KEY}`
           }
         }
       );
       if (!response.ok) throw new Error('Sync failed');
       // Realtime listeners vão atualizar UI automaticamente
     } finally {
       setIsSyncing(false);
     }
   };
   ```

---

### **Fase 5: Validação e Documentação**

1. **Testes manuais:**
   - [ ] Botão "Sincronizar" manual funciona
   - [ ] Dados atualizam em tempo real via Realtime listener
   - [ ] pg_cron executa a cada hora (verificar logs)

2. **Monitoramento:**
   - Supabase Dashboard → Functions → sync-football-data → Logs
   - Deve ver execuções a cada hora

3. **Atualizar docs:**
   - `docs/features/sync-system.md` — nova arquitetura
   - `.claude/memory/features/sync-system.md` — atualizar
   - `SESSION_MEMORY.md` — marcar como completo

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| API key exposta | Crítico | Guardar só em `.env.local` (gitignored) + Supabase Secrets |
| pg_cron executa infinitas vezes (bug) | Alto | Limitar timeout (300s), logging, alertas |
| Football Data API rate-limit | Médio | Implementar circuit-breaker, retry com backoff |
| Dados desincronizados com Realtime | Baixo | Realtime listeners + refetch on focus |

---

## Dependências

- Supabase CLI: `npm install -g supabase`
- Deno (já incluído em Supabase Edge Functions)
- Ativar **pg_cron** add-on no Supabase (Settings → Add-ons)
- Football Data API key (já tem)

---

## Deferred / Follow-up

- [ ] Implementar circuit-breaker para Football Data API
- [ ] Adicionar retry logic com exponential backoff
- [ ] Dashboard de monitoramento (quantas syncs/dia, taxa de erro)
- [ ] Alertas (Slack/email) se sync falhar por >2 horas
- [ ] Testes automatizados para Edge Function (via `deno test`)

---

## Checklist de Conclusão

- [ ] Secrets armazenados corretamente (dev + prod)
- [ ] Edge Function implementada e testada localmente
- [ ] pg_cron agendador criado e verificado
- [ ] Frontend integrado (Realtime listeners + botão manual)
- [ ] Logs monitorados por 24h
- [ ] Documentação atualizada
- [ ] Usuário confirma funcionamento

