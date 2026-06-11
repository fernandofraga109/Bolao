import { test, expect } from "../fixtures/test-options";
import { TEST_USER, hasTestUser } from "../fixtures/test-data";

/**
 * PRED — Palpite de partida (P0).
 *
 * Salvar/editar palpites EXIGE sessão logada e grava no backend real
 * (schema `test` quando VITE_SUPABASE_SCHEMA=test). Estes testes ficam em
 * `test.skip(!hasTestUser, ...)` e ativam quando `.env.e2e` define
 * E2E_USER_EMAIL/PASSWORD.
 *
 * Cenários determinísticos (PRED-01/04/05/06/07/09) dependem de dados de SEED
 * (`tests/seed/seed-fixtures.sql`) aplicados manualmente no SQL Editor. Cada
 * teste se protege com um `test.skip` GRACIOSO caso o dado do seed não exista,
 * para não quebrar a suíte de quem ainda não aplicou o seed.
 *
 * PRED-02 (palpitar sem login) é coberto implicitamente: sem sessão, a tela
 * de palpites nem é acessível (a app mostra o Login). Validamos isso ao vivo.
 */

/** Nome do 2º grupo do seed (mesma competição+ruleset → elegível p/ replicação). */
const SEED_GROUP_2_NAME = "Grupo E2E 2";

/** Faz login do usuário comum e navega até a tab "Jogos". */
async function loginAndGoToMatches(loginPage: any, appShell: any): Promise<void> {
  await loginPage.open();
  await loginPage.login(TEST_USER.email, TEST_USER.password);
  await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);
  await appShell.goToTab("matches");
}

test.describe("PRED — Palpite de partida", () => {
  test("PRED-02: sem login, a área de palpites não é acessível (mostra Login)", async ({
    loginPage,
    appShell,
  }) => {
    await loginPage.open();
    // Não autenticado → não há BottomNav com a tab "Jogos".
    expect(await appShell.isAuthenticated()).toBe(false);
    await expect(loginPage.loginEmail).toBeVisible();
  });

  test("PRED-01: salvar palpite no grupo ativo persiste o placar", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    await loginAndGoToMatches(loginPage, appShell);
    await matchesPage.expandAllGroups();

    const filled = await matchesPage.fillPredictionAt(0, 2, 1);
    test.skip(
      !filled,
      "Nenhum jogo palpitável. Rode tests/seed/seed-fixtures.sql no SQL Editor.",
    );
    await matchesPage.savePrediction();

    // O placar preenchido persiste no input do card.
    await expect(matchesPage.scoreInputAt(0, "home")).toHaveValue("2");
    await expect(matchesPage.scoreInputAt(0, "away")).toHaveValue("1");
  });

  test("PRED-07: editar palpite existente sobrescreve o placar", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    await loginAndGoToMatches(loginPage, appShell);
    await matchesPage.expandAllGroups();

    const first = await matchesPage.fillPredictionAt(0, 1, 0);
    test.skip(
      !first,
      "Nenhum jogo palpitável. Rode tests/seed/seed-fixtures.sql no SQL Editor.",
    );
    await matchesPage.savePrediction();

    // Edita para outro placar e salva novamente — deve sobrescrever.
    await matchesPage.fillPredictionAt(0, 3, 2);
    await matchesPage.savePrediction();
    await expect(matchesPage.scoreInputAt(0, "home")).toHaveValue("3");
    await expect(matchesPage.scoreInputAt(0, "away")).toHaveValue("2");
  });

  test("PRED-05: mata-mata empate exibe e persiste 'quem se classifica'", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    await loginAndGoToMatches(loginPage, appShell);
    await matchesPage.expandAllGroups();

    // Localiza o card de mata-mata (seed: match 'Final'); ao empatar, a UI
    // "Quem se classifica?" aparece. -1 = nenhum jogo de mata-mata palpitável.
    const koIndex = await matchesPage.findKnockoutPairIndex();
    test.skip(
      koIndex < 0,
      "Nenhum jogo de mata-mata palpitável. Rode tests/seed/seed-fixtures.sql.",
    );

    // Seletor visível (empate 1×1 já preenchido por findKnockoutPairIndex).
    await matchesPage.expectWhoClassifiesVisible();

    // Escolhe um time e salva.
    await matchesPage.selectFirstTieWinner();
    expect(await matchesPage.hasTieWinnerSelected()).toBe(true);
    await matchesPage.savePrediction();

    // Recarrega a página para reler o estado persistido do backend.
    await matchesPage.reloadAndReopenMatches(appShell);

    // O empate persiste e a seleção de "quem se classifica" volta marcada.
    const reloadedKo = await matchesPage.findKnockoutPairIndex();
    expect(reloadedKo).toBeGreaterThanOrEqual(0);
    await matchesPage.expectWhoClassifiesVisible();
    expect(await matchesPage.hasTieWinnerSelected()).toBe(true);
  });

  test("PRED-06: limpar 'quem se classifica' grava NULL (volta a vazio)", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    await loginAndGoToMatches(loginPage, appShell);
    await matchesPage.expandAllGroups();

    const koIndex = await matchesPage.findKnockoutPairIndex();
    test.skip(
      koIndex < 0,
      "Nenhum jogo de mata-mata palpitável. Rode tests/seed/seed-fixtures.sql.",
    );
    await matchesPage.expectWhoClassifiesVisible();

    // Garante um tieWinner setado, salva, então limpa e salva de novo.
    await matchesPage.selectFirstTieWinner();
    expect(await matchesPage.hasTieWinnerSelected()).toBe(true);
    await matchesPage.savePrediction();

    await matchesPage.clearTieWinner();
    expect(await matchesPage.hasTieWinnerSelected()).toBe(false);
    await matchesPage.savePrediction();

    // Recarrega e confirma que NÃO há time marcado (tieWinnerTeamId = NULL).
    await matchesPage.reloadAndReopenMatches(appShell);

    const reloadedKo = await matchesPage.findKnockoutPairIndex();
    expect(reloadedKo).toBeGreaterThanOrEqual(0);
    await matchesPage.expectWhoClassifiesVisible();
    expect(await matchesPage.hasTieWinnerSelected()).toBe(false);
  });

  test("PRED-09: trocar de grupo e palpitar grava no novo grupo ativo", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    await loginAndGoToMatches(loginPage, appShell);

    // Troca para o 2º grupo do seed (mesma competição+ruleset).
    const switched = await appShell.switchToGroupByName(SEED_GROUP_2_NAME);
    test.skip(
      !switched,
      `Grupo '${SEED_GROUP_2_NAME}' inexistente. Rode tests/seed/seed-fixtures.sql.`,
    );

    await appShell.goToTab("matches");
    await matchesPage.expandAllGroups();

    const filled = await matchesPage.fillPredictionAt(0, 4, 0);
    test.skip(!filled, "Nenhum jogo palpitável no grupo ativo após a troca.");
    await matchesPage.savePrediction();

    // O palpite gravado aparece no input do novo grupo ativo.
    await expect(matchesPage.scoreInputAt(0, "home")).toHaveValue("4");
    await expect(matchesPage.scoreInputAt(0, "away")).toHaveValue("0");
  });

  test("PRED-04: replica palpite para grupos elegíveis (mesma competição+ruleset)", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    await loginAndGoToMatches(loginPage, appShell);
    await matchesPage.expandAllGroups();

    // Preenche um palpite no grupo ativo (E2ETEST01).
    const filled = await matchesPage.fillPredictionAt(0, 3, 1);
    test.skip(
      !filled,
      "Nenhum jogo palpitável. Rode tests/seed/seed-fixtures.sql no SQL Editor.",
    );

    // O botão de replicação (RefreshCw) só aparece quando há grupos elegíveis.
    const replicateButton = matchesPage.replicateButton();
    test.skip(
      !(await replicateButton.isVisible().catch(() => false)),
      `Sem grupos elegíveis (precisa do '${SEED_GROUP_2_NAME}'). Rode o seed.`,
    );
    await replicateButton.click();

    // O modal de replicação abre; confirma a replicação para todos os grupos.
    await expect(matchesPage.replicateModalHeading()).toBeVisible({ timeout: 10_000 });
    await matchesPage.replicateConfirmButton().click();

    // Modal fecha após sucesso → palpite replicado nos grupos elegíveis.
    await expect(matchesPage.replicateModalHeading()).toBeHidden({ timeout: 10_000 });

    // Verifica que o palpite aparece também no outro grupo: troca para ele.
    const switched = await appShell.switchToGroupByName(SEED_GROUP_2_NAME);
    expect(switched).toBe(true);
    await appShell.goToTab("matches");
    await matchesPage.expandAllGroups();

    // O mesmo placar (3×1) deve estar refletido no grupo replicado.
    await expect(matchesPage.scoreInputAt(0, "home")).toHaveValue("3");
    await expect(matchesPage.scoreInputAt(0, "away")).toHaveValue("1");
  });
});
