import type { Page } from "@playwright/test";

/**
 * Page Object base. Todos os page objects herdam dele.
 *
 * Convenção do projeto: o app NÃO usa `data-testid` (verificado no código).
 * Por isso os locators priorizam, nesta ordem:
 *   1. Papéis acessíveis (`getByRole`) — botões, headings, etc.
 *   2. Texto visível (`getByText`) — labels pt-BR.
 *   3. Placeholder (`getByPlaceholder`) — inputs de formulário.
 * Evite seletores por classe Tailwind (frágeis).
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Caminho relativo da rota (override nos filhos). Default: raiz. */
  protected path = "/";

  /** Navega para a rota do page object. */
  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }

  /** Espera a aplicação sair do SplashScreen (auth resolvida). */
  async waitForAppReady(): Promise<void> {
    // O SplashScreen some quando `authReady` vira true.
    await this.page.waitForLoadState("domcontentloaded");
    await this.page
      .getByText(/Carregando|Splash/i)
      .first()
      .waitFor({ state: "hidden", timeout: 15_000 })
      .catch(() => {
        /* SplashScreen pode já ter saído antes da checagem — ok */
      });
  }
}
