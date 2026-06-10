import { test, expect } from "../fixtures/test-options";
import { captureStep } from "../helpers/screenshot";

/**
 * Smoke test de exemplo — valida que a infraestrutura E2E está de pé.
 *
 * NÃO é a suíte completa. Serve para:
 *  - confirmar que o dev server sobe e a app carrega;
 *  - confirmar que a captura de erros e screenshots funciona;
 *  - servir de template para os próximos specs (page objects + fixtures).
 *
 * A implementação da suíte completa (ver `documentacao/test-cases.md`)
 * deve seguir a convenção do projeto (agente `test-runner`).
 */

test.describe("Smoke — bootstrap da aplicação", () => {
  test("app carrega e exibe a tela de login sem erros fatais", async ({
    page,
    loginPage,
    consoleErrors,
  }, testInfo) => {
    await loginPage.open();

    // A tela de login deve estar visível (campo de e-mail).
    await expect(loginPage.loginEmail).toBeVisible();

    // Screenshot intencional documentando o estado inicial.
    await captureStep(page, testInfo, "tela-login");

    // Não deve haver exceções de página nem console.error graves.
    expect(
      consoleErrors.fatal,
      `Erros fatais no navegador: ${JSON.stringify(consoleErrors.fatal, null, 2)}`,
    ).toHaveLength(0);
  });

  test("título e raiz do React renderizam", async ({ page }) => {
    await page.goto("/");
    // A raiz da SPA deve ter conteúdo.
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15_000 });
  });
});
