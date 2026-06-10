import { test, expect } from "../fixtures/test-options";
import { TEST_USER, hasTestUser } from "../fixtures/test-data";

/**
 * PRED — Palpite de partida (P0).
 *
 * Salvar/editar palpites EXIGE sessão logada e grava no backend real.
 * Como não há credenciais de teste e o dev aponta para Supabase real,
 * estes testes ficam em `test.skip(!hasTestUser, ...)` e ativam quando
 * `.env.e2e` define E2E_USER_EMAIL/PASSWORD (idealmente um schema dev).
 *
 * PRED-02 (palpitar sem login) é coberto implicitamente: sem sessão, a tela
 * de palpites nem é acessível (a app mostra o Login). Validamos isso ao vivo.
 */

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
    await loginPage.open();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);

    await appShell.goToTab("matches");
    const filled = await matchesPage.fillFirstPrediction(2, 1);
    test.skip(!filled, "Nenhum jogo palpitável (todos travados) no momento");
    await matchesPage.savePrediction();

    // Feedback de sucesso (toast) ou o valor persistido no input.
    await expect(matchesPage.matchCards.nth(0)).toHaveValue("2");
  });

  test("PRED-07: editar palpite existente sobrescreve o placar", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    await loginPage.open();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);

    await appShell.goToTab("matches");
    const first = await matchesPage.fillFirstPrediction(1, 0);
    test.skip(!first, "Nenhum jogo palpitável no momento");
    await matchesPage.savePrediction();

    // Edita para outro placar e salva novamente.
    await matchesPage.fillFirstPrediction(3, 2);
    await matchesPage.savePrediction();
    await expect(matchesPage.matchCards.nth(0)).toHaveValue("3");
  });

  test("PRED-09: trocar de grupo e palpitar grava no novo grupo ativo", async ({
    loginPage,
    appShell,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e (grava no backend)");
    test.skip(true, "Requer usuário membro de 2+ grupos da mesma competição+ruleset");
    await loginPage.open();
    void appShell;
  });

  // Casos de borda do palpite (replicação, tieWinner) dependem de estado de
  // dados específico e sessão — documentados como TODO de integração/E2E.
  test.fixme("PRED-04: replica palpite para grupos elegíveis (mesma competição+ruleset)", async () => {});
  test.fixme("PRED-05: mata-mata empate persiste tieWinnerTeamId (quem se classifica)", async () => {});
  test.fixme("PRED-06: limpar 'quem se classifica' grava NULL explícito", async () => {});
});
