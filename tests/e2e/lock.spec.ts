import { test, expect } from "../fixtures/test-options";
import { TEST_USER, hasTestUser } from "../fixtures/test-data";

/**
 * LOCK — Travamento de palpites (P0).
 *
 * O travamento depende do relógio + status dos jogos + ruleset do grupo,
 * e a UI de palpites só aparece após login. Como gravar/inspecionar exige
 * sessão real, estes testes ficam em `test.skip(!hasTestUser, ...)`.
 *
 * LOCK-01 (jogo SCHEDULED antes da data → liberado) e LOCK-02/03 (travado)
 * são observáveis pela presença/ausência de inputs editáveis no card.
 * Regras (business-rules.md §5):
 *  - trava quando o jogo deixa de ser SCHEDULED ou `now > date`.
 *  - R2 trava a fase inteira quando qualquer jogo dela começa.
 *  - especiais travam após `lockDate` global.
 */

test.describe("LOCK — Travamento de palpites", () => {
  test("LOCK-01: jogo SCHEDULED no futuro permanece palpitável (input editável)", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e");
    await loginPage.open();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);

    await appShell.goToTab("matches");
    const count = await matchesPage.scoreInputCount();
    test.skip(count < 2, "Nenhum jogo agendado/palpitável disponível");
    // Pelo menos um par de inputs deve estar editável (jogo liberado).
    await expect(matchesPage.matchCards.nth(0)).toBeEditable();
  });

  test("LOCK-02/03: jogos iniciados/finalizados não exibem inputs editáveis", async ({
    loginPage,
    appShell,
    matchesPage,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e");
    test.skip(true, "Requer um jogo com status != SCHEDULED ou now > date no dataset");
    await loginPage.open();
    void appShell;
    void matchesPage;
  });

  // Casos que exigem montar estado de dados específico (fase R2 iniciada,
  // lockDate de especiais) → TODO de E2E com seed de dados controlado.
  test.fixme("LOCK-04: R2 — início de 1 jogo trava toda a fase (phaseLockSet)", async () => {});
  test.fixme("LOCK-05: especiais ficam travados após lockDate global", async () => {});
  test.fixme("LOCK-06: banner de pendências lista jogos sem palpite no prazo", async () => {});
  test.fixme("LOCK-07: admin recebe tratamento diferenciado no banner de pendências", async () => {});
});
