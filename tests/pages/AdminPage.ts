import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object da área de Administração (`components/pages/AdminDashboard.tsx`,
 * `AdminMatchCard`, `AdminSpecialsOverrides`).
 *
 * Acessível apenas para usuários com papel ADMIN (tab "Admin" no BottomNav).
 * Sem `data-testid` no app → seletores por papel/texto pt-BR.
 *
 * Estes locators servem aos fluxos administrativos de E2E. Como todos os
 * fluxos de admin gravam no backend, os specs que os usam ficam em
 * `test.skip(!hasTestAdmin, ...)`.
 */
export class AdminPage extends BasePage {
  readonly syncButton: Locator;
  readonly saveResultButtons: Locator;
  readonly competitionSelector: Locator;

  constructor(page: Page) {
    super(page);
    this.syncButton = page.getByRole("button", { name: /Sincronizar|Sync/i });
    this.saveResultButtons = page.getByRole("button", {
      name: /Salvar|Finalizar|Confirmar/i,
    });
    this.competitionSelector = page.getByRole("combobox").first();
  }

  /** Verdadeiro se o painel admin está visível (tem botão de sincronizar ou seletor). */
  async isAdminView(): Promise<boolean> {
    return this.syncButton
      .first()
      .isVisible()
      .catch(() => false);
  }
}
