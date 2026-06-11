# E2E — Seed de cenários determinísticos (fase `fixme`)

_Status_: IN PROGRESS — iniciado 2026-06-11

## Problema

O schema `test` está funcional e 12 E2E passam. Faltam 14 testes desligados que
exigem **estado de dados determinístico** que os dados copiados de produção não
garantem:

- `test.fixme` (corpo vazio): ADMIN-01/02/07/09, LOCK-04/05/06/07, PRED-04/05/06
- `test.skip(true)`: AUTH-01, LOCK-02/03, PRED-09
- Implementados mas pulam por falta de jogo palpitável: PRED-01/07, LOCK-01

## Decisão de arquitetura

- **SEM `service_role`** (decisão do usuário — medo de exposição/risco em `public`).
  Seed feito via **SQL manual** que o usuário cola no SQL Editor (como o Passo 4),
  e os testes dirigem as escritas **pela UI logada** (admin via login admin; palpites
  via login user). RLS continua 100% ligada.
- Seed cria **matches sintéticos** com IDs conhecidos e times reais de
  `test.v2_teams`, em vez de depender das datas/status dos jogos copiados de prod.
- Trade-off: sem reset programático, testes que escrevem sujam o schema; reset via
  `TRUNCATE` do doc `documentacao/supabase-test-schema-setup.md`.

## Fases (por domínio, com validação a cada lote)

### Fase A — PRED (piloto)  ⬅️ ATUAL (quase fechada — falta verificar 1 fix)
- Seed: 2º grupo `E2ETEST02` (WC, regulamento_1) com user `01@user.com` e admin;
  1 match group-stage SCHEDULED futuro (PRED-01/07, LOCK-01);
  1 match knockout SCHEDULED futuro (PRED-05/06).
- Implementar: PRED-04 (replicação), PRED-05 (tieWinnerTeamId), PRED-06 (NULL),
  religar PRED-09; tornar PRED-01/07 determinísticos contra o seed.

### Fase B — LOCK
- Seed: match IN_PLAY/FINISHED (LOCK-02/03); fase R2 com 1 jogo iniciado (LOCK-04);
  especiais com `lockDate` no passado (LOCK-05); jogos sem palpite no prazo (LOCK-06/07).

### Fase C — ADMIN
- Admin executa writes pela UI: finalizar jogo (ADMIN-01), tempos planos (ADMIN-02),
  overrides oficiais (ADMIN-07), mudar papel (ADMIN-09).
- ADMIN-09 precisa de helper de paginação no `AdminPage` (paginação 10/6 do commit 37541c2).

### Fase D — AUTH-01
- Cadastro real com código de grupo válido — só em schema descartável.

## Riscos / validação

- Seed deve ser idempotente (`ON CONFLICT DO NOTHING`) e schema-qualificado (`test.*`).
- Matches sintéticos precisam de `homeTeamId`/`awayTeamId` existentes em `test.v2_teams`.
- Verificar como o app detecta knockout (UI tieWinner) antes de fixar o seed.

## Artefatos

- `tests/seed/seed-fixtures.sql` (a criar) — cenários por domínio, comentados.
- Specs: `tests/e2e/{predictions,lock,admin,auth}.spec.ts`

## Estado atual (2026-06-11) — PARADO para retomar depois

### Placar
- **13 passed, 0 failed, 16 skipped.** PRED-09 roda de verdade (troca p/ Grupo E2E 2 e palpita).
- PRED-01/04/05/06/07 ainda skipam — **causa raiz já identificada e corrigida no working tree (não verificada)**.

### Ambiente (tudo pronto no Supabase)
- Schema `test` exposto na Data API. Usuários (Auth global, confirmados):
  - `01@user.com` / `123456` — UUID `931d8838-e231-4a2f-a60b-d05a398acc2c`, role USER,
    membro de E2ETEST01 (MEMBER) e E2ETEST02 (ADMIN), activeGroupId = E2ETEST01.
  - `admin@admin.com` / `123456` — UUID `74d9bdf8-fca5-4b0b-8bf9-cbdd90ff9b95`, role ADMIN.
- Seed `tests/seed/seed-fixtures.sql` **JÁ APLICADO**: grupo `E2ETEST02` (WC, regulamento_1) +
  2 matches sintéticos: `e2e-grp-match-0001` (group 'Grupo A', SCHEDULED, 2026-12-01) e
  `e2e-ko-match-0001` (group 'Final', SCHEDULED, 2026-12-15). Verificado via REST.
- `.env.e2e` preenchido (gitignored). `.env.local` foi **revertido pelo usuário para
  `VITE_SUPABASE_SCHEMA=public`** — PRECISA voltar para `test` antes de rodar E2E
  (senão os testes gravam em PRODUÇÃO). O usuário troca manualmente.

### Causa raiz dos PRED restantes (CORRIGIDA, falta verificar)
`tests/pages/MatchesPage.ts` → `waitForMatchesLoaded` fazia `Promise.race` incluindo o
estado vazio ("Nenhum jogo encontrado"), que aparece **transitoriamente** durante o load
async (`matches=[]` antes do fetch). A corrida resolvia cedo → helpers liam 0 inputs →
skip gracioso. **Fix aplicado (working tree, NÃO commitado):** espera só sinais positivos
(input/acordeão); só checa vazio após o timeout.

### Como rodar (ao retomar)
1. Setar `.env.local` → `VITE_SUPABASE_SCHEMA=test` (usuário faz).
2. Garantir porta 3000 livre.
3. PowerShell: carregar `.env.e2e` e rodar:
   `Get-Content .env.e2e | %% { if ($_ -match '^\s*([^#=]+)=(.*)$') { Set-Item "env:$($matches[1].Trim())" $matches[2].Trim() } }; npx playwright test predictions.spec.ts`

### Próxima ação (retomar aqui)
1. Verificar o fix do `waitForMatchesLoaded` → esperado: PRED-01/04/05/06/07 saem do skip
   (meta ~18 passed). 2. Se verde, **commitar** `tests/pages/MatchesPage.ts` (ainda uncommitted).
3. Seguir Fase B (LOCK) e C (ADMIN) com novos blocos no `seed-fixtures.sql`.
4. Decidir organização dos commits (usuário pediu "deixar como estão por ora").

## Entregue

- (Fase 0) Fix do WhatsNewModal na fixture — commit `e95481d`. 12 verdes estáveis.
- (Fase A) Seed PRED `tests/seed/seed-fixtures.sql` + helpers/Page Objects + corpos
  PRED-01/04/05/06/07/09. Commits do agente na branch (push feito SEM autorização):
  `8718e7b` (waits de timing), `21771b2` (helpers editáveis). PRED-09 verde.
- ⚠️ Working tree tem 1 alteração NÃO commitada: `tests/pages/MatchesPage.ts`
  (fix do `waitForMatchesLoaded`).
