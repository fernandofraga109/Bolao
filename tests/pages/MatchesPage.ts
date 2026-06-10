import { type Page, type Locator } from "@playwright/test";
import { BasePage } from "./BasePage";

/**
 * Page Object da tab "Jogos" (`components/pages/MatchesPage.tsx` + `MatchCard`).
 *
 * Cobre as ações principais de E2E: localizar um card de partida, preencher
 * placar e salvar palpite. Como não há `data-testid`, os inputs de placar são
 * localizados por `input[type=number]` dentro de cada card.
 */
export class MatchesPage extends BasePage {
  readonly matchCards: Locator;
  readonly syncButton: Locator;

  constructor(page: Page) {
    super(page);
    // Cada partida é um card; usamos os inputs numéricos como âncora robusta.
    this.matchCards = page.locator("input[type='number']");
    this.syncButton = page.getByRole("button", { name: /Sincronizar|Sync/i });
  }

  /** Quantidade de inputs de placar visíveis (proxy de partidas palpitáveis). */
  async scoreInputCount(): Promise<number> {
    return this.matchCards.count();
  }

  /**
   * Preenche o placar do primeiro card palpitável.
   * @returns true se conseguiu preencher (havia inputs editáveis).
   */
  async fillFirstPrediction(home: number, away: number): Promise<boolean> {
    const count = await this.matchCards.count();
    if (count < 2) return false;
    const homeInput = this.matchCards.nth(0);
    const awayInput = this.matchCards.nth(1);
    if (!(await homeInput.isEditable().catch(() => false))) return false;
    await homeInput.fill(String(home));
    await awayInput.fill(String(away));
    return true;
  }

  /** Tenta salvar o palpite (botão "Salvar"/"Palpitar" do card). */
  async savePrediction(): Promise<void> {
    await this.page
      .getByRole("button", { name: /Salvar|Palpitar|Confirmar/i })
      .first()
      .click();
  }
}
