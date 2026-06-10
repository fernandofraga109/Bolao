import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";
import { TABS } from "../fixtures/test-data";

/**
 * Page Object do "shell" da aplicação autenticada:
 * Header (pontos/rank/perfil) + BottomNav (tabs) + barra de grupo.
 *
 * Fornece navegação entre tabs e acesso ao seletor de grupo.
 */
export class AppShell extends BasePage {
  readonly bottomNav: Locator;
  readonly groupBar: Locator;

  constructor(page: Page) {
    super(page);
    this.bottomNav = page.locator("nav").last();
    // Barra de grupo/competição (clicável abre o GroupSwitcher).
    this.groupBar = page.getByText(/Grupo|Competição/).first();
  }

  /** Clica em uma tab do BottomNav pelo rótulo (pt-BR). */
  async goToTab(tab: keyof typeof TABS): Promise<void> {
    await this.bottomNav.getByText(TABS[tab], { exact: true }).click();
  }

  /** Abre o modal de troca/entrada de grupo (somente usuário comum). */
  async openGroupSwitcher(): Promise<void> {
    await this.groupBar.click();
  }

  /** Verdadeiro se o shell autenticado está visível (BottomNav presente). */
  async isAuthenticated(): Promise<boolean> {
    return this.bottomNav
      .getByText(TABS.matches, { exact: true })
      .isVisible()
      .catch(() => false);
  }
}
