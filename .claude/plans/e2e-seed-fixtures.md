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

### Fase A — PRED (piloto)  ⬅️ ATUAL
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

## Entregue

- (Fase 0) Fix do WhatsNewModal na fixture — commit `e95481d`. 12 verdes estáveis.
