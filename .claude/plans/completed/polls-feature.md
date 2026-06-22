# Plano — Enquetes / Polls (perguntas para os usuários)

_Status_: DONE — 2026-06-22. Validado pelo usuário, migration 0039 aplicada, changelog em 1.73.0, branch `feat/polls-enquetes` (origin + miguelfork). Fase 5 (testes) deferida ao test-runner.

## Progresso
- Fase 1 ✅ `database/migrations/0039_create_polls.sql` (tabelas sem/with v2_, RLS restritivo em poll_responses, RPC get_poll_results/v2_).
- Fase 2 ✅ `types.ts` (Poll/PollDB/PollResponseDB/PollResults/PollTargetRuleset + Tab 'polls') + `hooks/usePollSystem.ts` (consumidor, targeting client-side).
- Fase 3 ✅ `components/polls/PollModal.tsx` (bloqueante) + wire no `App.tsx` (guarda role !== ADMIN, sequencial).
- Fase 4 ✅ `components/polls/AdminPollsPage.tsx` + aba "Enquetes" no `BottomNav` (admin-only) + render no `App.tsx`.
- ⚠️ PENDENTE: aplicar migration 0039 no Supabase (dev e prod). Sem ela, queries de polls falham.
- Fase 5 ⏳ testes (test-runner). Fase 6 ⏳ changelog.

## Adições pós-validação inicial (2026-06-21)
- AdminPollsPage: seletor de status (Todas/Ativas/Encerradas) com contadores + barra de
  **participação** (respondentes / usuários elegíveis), denominador respeita o targeting.
- **Elegibilidade por data de cadastro:** só é elegível quem se cadastrou ATÉ a criação da
  enquete (quem entra depois não vê e não conta no denominador). Usa `user_roles.createdAt`
  (já existe no banco) — exposto em `UserDB.createdAt` + `mapUserRoleToUser`. Aplicado no gate
  do modal (`pendingPolls`) e em `countEligibleUsers`. createdAt/created_at ausentes → elegível.


## Problema / Motivação

O admin quer cadastrar perguntas (polls) que aparecem para os usuários ao abrir o app.
Motivação concreta: antes de alterar a pontuação do **Regulamento 1**, perguntar à maioria
dos usuários se concordam com a mudança (afeta pontuação → afeta rank). Quer decisão
participativa, não unilateral.

## Requisitos (confirmados com o usuário)

1. Tela admin (nova **aba "Enquetes"** no BottomNav admin) para cadastrar perguntas.
2. Ao cadastrar, na próxima vez que o usuário abrir o app a pergunta aparece como **modal
   bloqueante** (não fecha sem responder). Mecanismo análogo ao check de versão / WhatsNew:
   detecção passiva no client.
3. Ao responder, o `userId` fica registrado → a pergunta **não aparece mais** para ele.
4. **Voto travado**: não pode editar depois de responder.
5. Admin/escolha por pergunta: **1 ou N opções** (`allow_multiple`).
6. **Targeting**: global, mas com restrição opcional por ruleset — ex.: só usuários com pelo
   menos um grupo de `regulamento_1` ou `regulamento_2`.
7. **Anonimato**: o admin vê, por opção, o `%` de aceitação e o total de respondentes —
   **NUNCA** quem votou o quê.

## Decisões de design

### Anonimato vs. padrão de RLS do projeto (DECISÃO-CHAVE)
O projeto usa RLS **aberto** (migration 0015): qualquer `authenticated` faz SELECT/INSERT/
UPDATE/DELETE em tudo; a segurança real está na camada de app. Isso é incompatível com o
requisito de anonimato (SELECT aberto deixaria o admin ler quem votou).

→ `poll_responses` é a **exceção deliberada** ao padrão:
- RLS restritivo: usuário só faz `SELECT`/`INSERT` da própria linha (`auth.uid() = "userId"`).
- Sem `UPDATE`/`DELETE` para o usuário comum (voto travado).
- Admin **não** lê a tabela direto. Lê agregado via RPC `get_poll_results(p_poll_id)`
  `SECURITY DEFINER` → retorna `{ option_index, votes }` + total de respondentes. Nunca `userId`.
- Limite honesto: quem tem acesso ao console Supabase / `service_role` ainda cruza. Anonimato
  é garantido **na aplicação**, não contra um DBA. Suficiente para este bolão.

`polls` (a pergunta) segue o padrão aberto (leitura por todos; escrita restrita por app/admin).

### Modelo de dados (migration 0039)
**`polls`** (prefixada → `v2_polls`)
- `id` uuid PK default gen_random_uuid()
- `question` text not null
- `options` jsonb not null  — array de strings
- `allow_multiple` boolean not null default false
- `target_ruleset` text null  — null = todos; `'regulamento_1'` | `'regulamento_2'` | `'both'`
- `status` text not null default `'active'`  — `'active'` | `'closed'`
- `created_at` timestamptz not null default now()
- `closes_at` timestamptz null  (opcional, futuro)

**`poll_responses`** (prefixada → `v2_poll_responses`) — row-por-opção (suporta múltipla escolha)
- `poll_id` uuid not null (FK → polls.id, on delete cascade)
- `user_id` uuid not null  (= auth.uid())
- `option_index` int not null
- `created_at` timestamptz not null default now()
- PK / unique `(poll_id, user_id, option_index)`
- "já respondeu" = existe ≥1 linha dele para o poll.

### Targeting avaliado no client
O `usePollSystem` já conhece os grupos do usuário (via context) e seus `ruleset`s. Filtra polls
ativas cujo `target_ruleset` casa com algum grupo do usuário, **menos** as já respondidas.
Sobrou → modal. Sem RPC de targeting. Guarda extra: `role !== ADMIN` nunca é bloqueado.

### Agregação / %
RPC `get_poll_results` conta votos por opção + respondentes distintos. `%` por opção =
`votos_opção / total_respondentes`. Em `allow_multiple`, a soma passa de 100% (normal em
multi-select) — deixar claro no card admin.

### RPC + prefixo
Mirror do `acquire_sync_lock`: criar `get_poll_results` e `v2_get_poll_results`. Client chama
`${VITE_DB_TABLE_PREFIX}get_poll_results`. `SECURITY DEFINER`, `SET search_path TO public`.

## Fases de execução

- **Fase 1 — DB (migration 0039 + RLS + RPC):**
  - Criar `polls` + `poll_responses` (versões sem prefixo e `v2_`).
  - RLS: `polls` aberto (padrão); `poll_responses` restritivo (own-row select/insert).
  - RPC `get_poll_results` / `v2_get_poll_results` SECURITY DEFINER (agregado anônimo).
  - Migration idempotente (IF NOT EXISTS / DROP POLICY IF EXISTS).
- **Fase 2 — Types + hook + context:**
  - `types.ts`: `Poll`, `PollDB`, `PollResponse`, `PollResults`.
  - `hooks/usePollSystem.ts`: fetch polls ativas, fetch respostas do usuário, `submitResponse`,
    `getPollResults` (RPC), admin `createPoll`/`closePoll`/`deletePoll`. Targeting client-side.
  - Compor em `DatabaseContext.tsx` (padrão usePlayerSync).
- **Fase 3 — Modal do usuário (bloqueante):**
  - `components/polls/PollModal.tsx` — pergunta + opções (radio se single, checkbox se multi),
    submit obrigatório. Sequencial se houver várias pendentes.
  - Render em `App.tsx` (após auth, antes/junto dos outros modais). Guarda `role !== ADMIN`.
- **Fase 4 — Aba admin "Enquetes":**
  - `Tab` += `'polls'`. Ícone no BottomNav (admin-only, como "animations").
  - `components/polls/AdminPollsPage.tsx`: form de criação (pergunta, opções dinâmicas, toggle
    múltipla, seletor de target_ruleset) + lista de cards com `%`/opção + total (via RPC). Ações
    fechar/excluir.
- **Fase 5 — Testes (test-runner):** targeting/filtragem do usePollSystem, agregação de %.
- **Fase 6 — Changelog (changelog-updater):** bump versão + entrada em releases.

## Validação
- Criar poll como admin → abrir como user de grupo reg1 → modal aparece, responde, some.
- Re-login do mesmo user → não reaparece.
- User sem grupo reg1/reg2 (se target restrito) → não vê.
- Admin vê card com % coerente; nenhuma query expõe userId↔opção.
- Múltipla escolha grava N linhas; single grava 1.

## Riscos
- RLS restritivo numa base de RLS-aberto: testar que INSERT do próprio voto passa e SELECT de
  terceiros falha. Se 403 inesperado, revisar policy (auth.uid() = "userId" com aspas — coluna
  camelCase? Aqui usamos `user_id` snake_case para evitar a pegadinha das aspas).
- Migration 0039 precisa ser aplicada no Supabase compartilhado (dev + prod) — passo manual.
- Modal bloqueante: garantir que não trava admin nem usuário sem polls pendentes.

## Operacional / pendências
- Aplicar migration 0039 no Supabase (dev e prod).
