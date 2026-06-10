import { test, expect } from "../fixtures/test-options";
import { TEST_ADMIN, hasTestAdmin } from "../fixtures/test-data";

/**
 * ADMIN — Fluxos administrativos (domínio P1; incluído por solicitação).
 *
 * TODO o acesso admin exige login com papel ADMIN e suas ações GRAVAM no
 * backend real (finalizar jogo, overrides, mudar papel, etc.). Sem credenciais
 * de teste dedicadas, todos os specs ficam em `test.skip(!hasTestAdmin, ...)`.
 * Ativam quando `.env.e2e` define E2E_ADMIN_EMAIL/PASSWORD (idealmente schema dev).
 */

test.describe("ADMIN — Administração", () => {
  test("ADMIN (acesso): admin vê o painel de administração após login", async ({
    loginPage,
    appShell,
    adminPage,
  }) => {
    test.skip(!hasTestAdmin, "Defina E2E_ADMIN_EMAIL/PASSWORD em .env.e2e");
    await loginPage.open();
    await loginPage.login(TEST_ADMIN.email, TEST_ADMIN.password);
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);

    await appShell.goToTab("admin");
    await expect.poll(() => adminPage.isAdminView(), { timeout: 15_000 }).toBe(true);
  });

  // Ações que escrevem no backend — habilitar somente em schema dev descartável.
  test.fixme("ADMIN-01: finalizar jogo com placar muda status para FINISHED e recalcula", async () => {});
  test.fixme("ADMIN-02: editar tempo regular/prorrogação/pênaltis salva colunas planas", async () => {});
  test.fixme("ADMIN-07: definir resultados oficiais (overrides) recalcula especiais", async () => {});
  test.fixme("ADMIN-09: mudar papel de usuário atualiza o role", async () => {});
});
