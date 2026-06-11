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

  /**
   * Troca o grupo ativo pelo nome exibido no GroupSwitcher
   * (`components/GroupSwitcher.tsx`, modo "list").
   * @returns true se o grupo foi encontrado e clicado.
   */
  async switchToGroupByName(groupName: string): Promise<boolean> {
    // A barra de grupo só fica clicável depois que os grupos do usuário
    // carregam (assíncrono). Espera o rótulo aparecer antes de abrir o modal.
    await this.groupBar.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    await this.openGroupSwitcher();
    const heading = this.page.getByRole("heading", { name: /Meus Grupos/i });
    await heading.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    const target = this.page
      .getByRole("button", { name: new RegExp(groupName, "i") })
      .first();
    // A lista de grupos pode demorar para popular dentro do modal.
    await target.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
    if (!(await target.count())) return false;
    await target.click();
    // Aguarda o modal fechar (troca aplicada) antes de seguir.
    await heading.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    return true;
  }

  /** Verdadeiro se o shell autenticado está visível (BottomNav presente). */
  async isAuthenticated(): Promise<boolean> {
    return this.bottomNav
      .getByText(TABS.matches, { exact: true })
      .isVisible()
      .catch(() => false);
  }
}
