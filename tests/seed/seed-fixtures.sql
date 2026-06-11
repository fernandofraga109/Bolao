-- ============================================================================
-- E2E SEED FIXTURES — Bolão Copa 2026 (schema `test`)
-- ============================================================================
--
-- COMO USAR
-- ---------
-- 1. Pré-requisito: o schema `test` já existe e tem os dados de referência
--    (times/jogos) + o usuário/grupo E2ETEST01, conforme
--    `documentacao/supabase-test-schema-setup.md` (PARTE 1 e PARTE 2).
-- 2. Abra o Supabase → SQL Editor.
-- 3. Cole este arquivo INTEIRO e rode. É IDEMPOTENTE (pode rodar de novo):
--    todos os blocos usam `ON CONFLICT DO NOTHING` / `WHERE NOT EXISTS`.
-- 4. Rode a suíte E2E. Os testes PRED protegidos por `test.skip` gracioso
--    detectam estes dados pela UI e passam a executar de verdade.
--
-- O QUE ESTE ARQUIVO CRIA (seção PRED)
-- ------------------------------------
--   • 2º grupo `E2ETEST02` (WC, regulamento_1) com user 01 + admin vinculados
--     → habilita PRED-04 (replicação) e PRED-09 (troca de grupo).
--   • 1 match GROUP-STAGE sintético, SCHEDULED, data futura
--     → habilita PRED-01, PRED-07, LOCK-01 (jogo palpitável determinístico).
--   • 1 match KNOCKOUT (Final) sintético, SCHEDULED, data futura
--     → habilita PRED-05 (tieWinner em empate) e PRED-06 (limpar tieWinner).
--
-- RESET / LIMPEZA
-- ---------------
-- Para zerar SÓ os dados de teste (mantendo estrutura), use o TRUNCATE do doc
-- `documentacao/supabase-test-schema-setup.md` (seção "Limpeza / reset"):
--
--   TRUNCATE test.v2_predictions, test.v2_tournament_predictions,
--            test.v2_extra_phase_predictions, test.v2_user_groups,
--            test.v2_groups, test.v2_user_roles RESTART IDENTITY CASCADE;
--
-- ⚠️ O TRUNCATE acima APAGA o grupo E2ETEST01 e os vínculos — re-rode a PARTE 2
--    do doc de setup + este arquivo depois.
-- Para remover apenas os MATCHES sintéticos deste seed (sem mexer no resto):
--
--   DELETE FROM test.v2_matches
--   WHERE id IN ('e2e0a7c0-0000-4000-8000-000000000001',
--                'e2e0a7c0-0000-4000-8000-000000000002');
--   DELETE FROM test.v2_groups WHERE code = 'E2ETEST02';
--
-- ============================================================================

-- UUIDs fixos dos usuários de teste (de `.env.e2e`):
--   user 01@user.com  → 931d8838-e231-4a2f-a60b-d05a398acc2c (role USER)
--   admin@admin.com   → 74d9bdf8-fca5-4b0b-8bf9-cbdd90ff9b95 (role ADMIN)


-- ============================================================================
-- BLOCO 1 — 2º grupo `E2ETEST02` (habilita PRED-04 replicação e PRED-09)
-- ----------------------------------------------------------------------------
-- Mesma competição (WC) e mesmo ruleset (regulamento_1) do E2ETEST01 → o grupo
-- aparece como "elegível" para replicação de palpite (App.tsx `eligibleGroups`).
-- adminId = UUID do user 01 (ele é dono/admin deste 2º grupo).
-- ============================================================================
INSERT INTO test.v2_groups (id, name, code, "adminId", "createdAt", "competitionCode", ruleset)
VALUES (
  'e2e90002-0000-4000-8000-000000000002',
  'Grupo E2E 2',
  'E2ETEST02',
  '931d8838-e231-4a2f-a60b-d05a398acc2c',
  now(),
  'WC',
  'regulamento_1'
)
ON CONFLICT (code) DO NOTHING;

-- Vincular o user 01 ao 2º grupo (membro, para que apareça em eligibleGroups).
INSERT INTO test.v2_user_groups ("userId", "groupId", "joinedAt", role, points)
SELECT '931d8838-e231-4a2f-a60b-d05a398acc2c', id, now(), 'ADMIN', 0
FROM test.v2_groups WHERE code = 'E2ETEST02'
ON CONFLICT ("userId", "groupId") DO NOTHING;

-- Vincular o admin ao 2º grupo também (para testes admin futuros).
INSERT INTO test.v2_user_groups ("userId", "groupId", "joinedAt", role, points)
SELECT '74d9bdf8-fca5-4b0b-8bf9-cbdd90ff9b95', id, now(), 'MEMBER', 0
FROM test.v2_groups WHERE code = 'E2ETEST02'
ON CONFLICT ("userId", "groupId") DO NOTHING;


-- ============================================================================
-- BLOCO 2 — Match GROUP-STAGE sintético (habilita PRED-01, PRED-07, LOCK-01)
-- ----------------------------------------------------------------------------
-- • status SCHEDULED + data bem no futuro → permanece PALPITÁVEL (não trava).
-- • group 'Grupo A' → getMatchPhase() retorna 'groups' (NÃO é mata-mata):
--   placares simples, sem UI de "quem se classifica".
-- • homeTeamId/awayTeamId: 2 times reais DISTINTOS de test.v2_teams (subselect
--   por ranking, determinístico). Se houver menos de 2 times, nada é inserido.
-- ============================================================================
INSERT INTO test.v2_matches (
  id, "externalMatchId", "homeTeamId", "awayTeamId", date,
  "group", status, "competitionCode", stage
)
SELECT
  'e2e0a7c0-0000-4000-8000-000000000001',
  'e2e-grp-match-0001',
  (SELECT id FROM test.v2_teams ORDER BY COALESCE(ranking, 9999), id ASC  LIMIT 1),
  (SELECT id FROM test.v2_teams ORDER BY COALESCE(ranking, 9999), id DESC LIMIT 1),
  '2026-12-01T18:00:00Z',
  'Grupo A',
  'SCHEDULED',
  'WC',
  'GROUP_STAGE'
WHERE (SELECT COUNT(*) FROM test.v2_teams) >= 2
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- BLOCO 3 — Match KNOCKOUT sintético (habilita PRED-05 e PRED-06)
-- ----------------------------------------------------------------------------
-- • stage 'FINAL' + group 'Final' → getMatchPhase() retorna 'final' (≠ 'groups')
--   → no Regulamento 1 o card vira MATA-MATA: ao palpitar EMPATE, a UI
--   "Quem se classifica?" aparece (tieWinnerTeamId / whoClassifiesTeamId).
-- • status SCHEDULED + data futura → palpitável.
-- • 2 times reais DISTINTOS (mesma lógica do bloco 2).
-- ============================================================================
INSERT INTO test.v2_matches (
  id, "externalMatchId", "homeTeamId", "awayTeamId", date,
  "group", status, "competitionCode", stage
)
SELECT
  'e2e0a7c0-0000-4000-8000-000000000002',
  'e2e-ko-match-0001',
  (SELECT id FROM test.v2_teams ORDER BY COALESCE(ranking, 9999), id ASC  LIMIT 1),
  (SELECT id FROM test.v2_teams ORDER BY COALESCE(ranking, 9999), id DESC LIMIT 1),
  '2026-12-15T18:00:00Z',
  'Final',
  'SCHEDULED',
  'WC',
  'FINAL'
WHERE (SELECT COUNT(*) FROM test.v2_teams) >= 2
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- FIM DA SEÇÃO PRED. Recarregue o cache do PostgREST (opcional, por garantia):
NOTIFY pgrst, 'reload schema';
