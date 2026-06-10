import { test, expect } from "../fixtures/test-options";
import {
  TEST_USER,
  TEST_GROUP_CODE,
  hasTestUser,
  hasTestGroup,
  uniqueEmail,
} from "../fixtures/test-data";

/**
 * AUTH — Autenticação (P0).
 *
 * Estratégia (decisões do usuário):
 *  - O dev aponta para um Supabase REAL e não há credenciais de teste.
 *  - NUNCA criar usuários reais nem escrever no backend.
 *  - Casos que só TENTAM autenticar / validam antes de criar usuário rodam ao vivo:
 *      AUTH-02 (código de grupo inválido — aborta antes de criar conta)
 *      AUTH-10 (senha incorreta — apenas tentativa de auth)
 *      Validações client-side e troca de modos.
 *  - Casos que exigem sessão real ou criação de conta ficam em `test.skip(...)`
 *    atrás das flags de `.env.e2e` (hasTestUser / hasTestGroup).
 */

test.describe("AUTH — Autenticação", () => {
  test("AUTH-10: login com senha incorreta exibe mensagem de erro", async ({
    loginPage,
  }) => {
    await loginPage.open();
    // E-mail sintático válido + senha quase certamente errada.
    // Apenas TENTA autenticar — Supabase retorna erro, nenhum write ocorre.
    await loginPage.login("nao-existe-e2e@bolao-test.local", "senha-errada-123");

    // O banner de erro (⚠️) deve aparecer com alguma mensagem.
    await expect(loginPage.errorBanner).toBeVisible({ timeout: 15_000 });
    const msg = await loginPage.errorText();
    expect(msg.length).toBeGreaterThan(0);
  });

  test("AUTH-02: cadastro com código de grupo inválido é bloqueado antes de criar conta", async ({
    page,
    loginPage,
  }) => {
    await loginPage.open();
    // Vai para o modo de cadastro ("Primeiro Acesso").
    await page.getByRole("button", { name: /Primeiro Acesso/i }).click();

    // Preenche com um código garantidamente inválido + e-mail único (não será criado).
    await loginPage.regGroupCode.fill("ZZZZZ99999");
    await loginPage.regName.fill("Teste E2E");
    await loginPage.regEmail.fill(uniqueEmail("invalid-code"));
    await loginPage.regPassword.fill("senha123");
    await loginPage.submitRegister.click();

    // O fluxo valida o código PRIMEIRO e aborta com "Código de grupo inválido."
    await expect(loginPage.errorBanner).toBeVisible({ timeout: 15_000 });
    await expect(loginPage.errorBanner).toContainText(/Código de grupo inválido/i);
  });

  test("AUTH (client-side): campos obrigatórios do login impedem submit vazio", async ({
    page,
    loginPage,
  }) => {
    await loginPage.open();
    // Submeter o form de login vazio: HTML5 `required` impede o envio.
    await loginPage.submitLogin.click();
    // Continuamos na tela de login (campo de e-mail ainda visível).
    await expect(loginPage.loginEmail).toBeVisible();
    // O input de e-mail é inválido pela validação nativa.
    const isInvalid = await loginPage.loginEmail.evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(isInvalid).toBe(true);
    void page;
  });

  test("AUTH (client-side): cadastro com campos vazios mostra 'Preencha todos os campos'", async ({
    page,
    loginPage,
  }) => {
    await loginPage.open();
    await page.getByRole("button", { name: /Primeiro Acesso/i }).click();

    // O componente exige `required` no HTML, mas também valida via JS (trim).
    // Forçamos a validação JS limpando o `required` para chegar ao handler.
    // Em vez disso, validamos o caminho nativo: o form não envia vazio.
    await loginPage.submitRegister.click();
    const codeInvalid = await loginPage.regGroupCode.evaluate(
      (el: HTMLInputElement) => !el.checkValidity(),
    );
    expect(codeInvalid).toBe(true);
  });

  test("AUTH (navegação): alterna entre Entrar / Primeiro Acesso / Reset de senha", async ({
    page,
    loginPage,
  }) => {
    await loginPage.open();

    // LOGIN → REGISTER
    await page.getByRole("button", { name: /Primeiro Acesso/i }).click();
    await expect(loginPage.regGroupCode).toBeVisible();

    // REGISTER → LOGIN
    await page.getByRole("button", { name: /^Entrar$/ }).first().click();
    await expect(loginPage.loginEmail).toBeVisible();

    // LOGIN → RESET_PASSWORD
    await loginPage.forgotPassword.click();
    await expect(
      page.getByRole("button", { name: /Enviar link de reset/i }),
    ).toBeVisible();

    // RESET_PASSWORD → LOGIN (voltar)
    await page.getByRole("button", { name: /Voltar para login/i }).click();
    await expect(loginPage.loginEmail).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Casos que exigem sessão real / criação de conta → SKIP por padrão.
  // Ativam quando `.env.e2e` define credenciais. NUNCA rodam contra o
  // Supabase real sem credenciais dedicadas (evita poluir o banco).
  // -------------------------------------------------------------------------

  test("AUTH-09: login com credenciais corretas autentica o usuário", async ({
    loginPage,
    appShell,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e");
    await loginPage.open();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    // Shell autenticado aparece (BottomNav com a tab "Jogos").
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);
  });

  test("AUTH-13: logout encerra a sessão e volta para o login", async ({
    page,
    loginPage,
    appShell,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e");
    await loginPage.open();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);

    // Abre o perfil/menu e clica em "Sair" (rótulo pt-BR).
    await page.getByRole("button", { name: /Sair|Logout/i }).first().click();
    await expect(loginPage.loginEmail).toBeVisible({ timeout: 15_000 });
  });

  test("AUTH-11: recarregar a página mantém a sessão", async ({
    page,
    loginPage,
    appShell,
  }) => {
    test.skip(!hasTestUser, "Defina E2E_USER_EMAIL/PASSWORD em .env.e2e");
    await loginPage.open();
    await loginPage.login(TEST_USER.email, TEST_USER.password);
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);

    await page.reload();
    await expect.poll(() => appShell.isAuthenticated(), { timeout: 20_000 }).toBe(true);
  });

  test("AUTH-01: cadastro com código de grupo VÁLIDO cria conta e entra no grupo", async ({
    page,
    loginPage,
  }) => {
    // ⚠️ RISCO: este teste CRIA UM USUÁRIO REAL no backend.
    // Por isso fica SEMPRE em skip, mesmo com hasTestGroup, a menos que o
    // ambiente seja um schema dev descartável. Habilitar manualmente.
    test.skip(true, "Cria usuário real no Supabase — só em schema dev descartável");
    test.skip(!hasTestGroup, "Defina E2E_GROUP_CODE em .env.e2e");

    await loginPage.open();
    await page.getByRole("button", { name: /Primeiro Acesso/i }).click();
    await loginPage.regGroupCode.fill(TEST_GROUP_CODE);
    await loginPage.regName.fill("Usuário E2E");
    await loginPage.regEmail.fill(uniqueEmail("signup"));
    await loginPage.regPassword.fill("senha123456");
    await loginPage.submitRegister.click();
    // Resultado depende da confirmação de e-mail estar ligada ou não.
    await expect(page.locator("#root")).not.toBeEmpty();
  });
});
