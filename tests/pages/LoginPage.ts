import { expect, type Page, type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object da tela de Login / Cadastro / Recuperação de senha
 * (`components/Login.tsx`).
 *
 * A tela tem 4 modos: LOGIN, REGISTER, RESET_PASSWORD, RESET_PASSWORD_CONFIRM.
 * Os locators abaixo cobrem LOGIN e REGISTER (os mais usados em E2E).
 */
export class LoginPage extends BasePage {
  protected path = "/";

  // --- LOGIN ---
  readonly loginEmail: Locator;
  readonly loginPassword: Locator;
  readonly submitLogin: Locator;
  readonly forgotPassword: Locator;

  // --- REGISTER ---
  readonly regGroupCode: Locator;
  readonly regName: Locator;
  readonly regEmail: Locator;
  readonly regPassword: Locator;
  readonly submitRegister: Locator;

  // --- comum ---
  readonly errorBanner: Locator;

  constructor(page: Page) {
    super(page);
    this.loginEmail = page.getByPlaceholder("seu@email.com").first();
    this.loginPassword = page.getByPlaceholder("••••••");
    // Escopo no <form> para não colidir com a tab "Entrar" (mesmo texto).
    this.submitLogin = page
      .locator("form")
      .getByRole("button", { name: /^(Entrar|Entrando\.\.\.)$/ });
    this.forgotPassword = page.getByRole("button", {
      name: /Esqueci minha senha/i,
    });

    this.regGroupCode = page.getByPlaceholder("Ex: ABCDE12345");
    this.regName = page.getByPlaceholder("Seu Nome");
    this.regEmail = page.getByPlaceholder(/^E-mail$/);
    this.regPassword = page.getByPlaceholder(/^Senha$/);
    this.submitRegister = page.getByRole("button", {
      name: /Cadastrar e Entrar|Criando Conta/,
    });

    // Banner de erro vermelho (texto começa com ⚠️).
    this.errorBanner = page.locator("text=⚠️").locator("..");
  }

  /** Garante que estamos na tela de login (sair do splash). */
  async open(): Promise<void> {
    await this.goto();
    await this.waitForAppReady();
    await expect(this.loginEmail).toBeVisible({ timeout: 15_000 });
  }

  /** Executa o fluxo de login com credenciais. */
  async login(email: string, password: string): Promise<void> {
    await this.loginEmail.fill(email);
    await this.loginPassword.fill(password);
    await this.submitLogin.click();
  }

  /** Alterna para o modo de cadastro (botão de troca de modo). */
  async switchToRegister(): Promise<void> {
    await this.page
      .getByRole("button", { name: /Cadastr|Criar conta|Não tem conta/i })
      .first()
      .click();
  }

  /** Retorna a mensagem de erro exibida (ou string vazia). */
  async errorText(): Promise<string> {
    if (await this.errorBanner.isVisible().catch(() => false)) {
      return (await this.errorBanner.innerText()).trim();
    }
    return "";
  }
}
