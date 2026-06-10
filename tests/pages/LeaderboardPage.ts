import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object da tab "Rank" (`components/pages/LeaderboardPage.tsx`).
 *
 * Fornece acesso às linhas do ranking e à abertura da auditoria de pontos
 * (UserAuditModal) de um usuário.
 */
export class LeaderboardPage extends BasePage {
  readonly rows: Locator;

  constructor(page: Page) {
    super(page);
    // Linhas do ranking (lista). Refine conforme a marcação real evoluir.
    this.rows = page.locator("li, [role='listitem']");
  }

  /** Número de competidores listados. */
  async competitorCount(): Promise<number> {
    return this.rows.count();
  }

  /** Abre a auditoria de pontos do usuário cujo nome é informado. */
  async openAuditFor(name: string): Promise<void> {
    await this.page.getByText(name, { exact: false }).first().click();
  }
}
