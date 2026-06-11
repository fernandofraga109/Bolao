import { expect, type Page, type Locator } from "@playwright/test";
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
   * Aguarda os jogos serem carregados de forma assíncrona do Supabase.
   *
   * Após `goToTab('matches')` a página renderiza o shell imediatamente, mas a
   * lista de partidas chega via fetch/realtime alguns instantes depois. Sem
   * esperar, os helpers (`expandAllGroups`, `fillPredictionAt`, etc.) leem 0
   * inputs e os testes pulam (skip gracioso) por engano.
   *
   * Espera até que QUALQUER um dos sinais de "página de jogos pronta" apareça:
   *   - um input de placar (`input[type=number]`) — há jogo palpitável hoje; OU
   *   - um acordeão de data fechado ("N jogos") — há jogos futuros; OU
   *   - um estado vazio legítimo ("Nenhum jogo encontrado" / "não está em um
   *     grupo") — não há jogos mesmo.
   *
   * Resolve graciosamente (sem lançar) se o timeout estourar, para que os
   * `test.skip` graciosos a jusante ainda funcionem em ambientes sem seed.
   */
  async waitForMatchesLoaded(timeout = 20_000): Promise<void> {
    const numberInput = this.matchCards.first();
    const dateAccordion = this.page.getByText(/\d+\s+jogos?$/i).first();
    const emptyState = this.page
      .getByText(/Nenhum jogo encontrado|não está em um grupo/i)
      .first();
    await Promise.race([
      numberInput.waitFor({ state: "attached", timeout }).catch(() => {}),
      dateAccordion.waitFor({ state: "visible", timeout }).catch(() => {}),
      emptyState.waitFor({ state: "visible", timeout }).catch(() => {}),
    ]);
  }

  /** Recarrega a página e reabre a tab "Jogos" (reler estado do backend). */
  async reloadAndReopenMatches(appShell: { goToTab: (t: "matches") => Promise<void> }): Promise<void> {
    await this.page.reload();
    await this.waitForAppReady();
    await appShell.goToTab("matches");
    await this.expandAllGroups();
  }

  /** Botão de replicação (RefreshCw) do card; só visível com grupos elegíveis. */
  replicateButton(): Locator {
    return this.page.getByTitle(/Sincronizar este palpite com outros grupos/i).first();
  }

  /**
   * Botão de replicação (RefreshCw) DENTRO do card em `pairIndex`. Garante que
   * o clique mira o card preenchido (não o primeiro card elegível da página).
   */
  replicateButtonAt(pairIndex: number): Locator {
    const homeInput = this.scoreInputAt(pairIndex, "home");
    const card = homeInput.locator(
      "xpath=ancestor::div[contains(@class,'rounded-3xl')][1]",
    );
    return card.getByTitle(/Sincronizar este palpite com outros grupos/i);
  }

  /** Cabeçalho do modal de replicação ("Sincronizar Palpite"). */
  replicateModalHeading(): Locator {
    return this.page.getByRole("heading", { name: /Sincronizar Palpite/i });
  }

  /** Botão "Replicar Palpite" dentro do modal de replicação. */
  replicateConfirmButton(): Locator {
    return this.page.getByRole("button", { name: /Replicar Palpite/i });
  }

  // -------------------------------------------------------------------------
  // Helpers de SEED determinístico (tests/seed/seed-fixtures.sql)
  // -------------------------------------------------------------------------
  // O card de partida não tem `data-testid`; localizamos um card específico
  // pelo bloco que contém AMBOS os nomes das seleções do match sintético.
  // Os jogos do seed usam os 2 times reais de ranking extremo (primeiro e
  // último de `test.v2_teams`), então localizamos via accordion aberto.

  /**
   * Abre todos os accordions de data/fase para garantir que os cards de jogos
   * futuros (do seed) fiquem visíveis. Acordeões fechados escondem os inputs.
   */
  async expandAllGroups(): Promise<void> {
    // Os jogos chegam de forma assíncrona; sem isso lemos a página vazia e
    // nenhum acordeão é aberto (causa raiz dos PRED pulando por engano).
    await this.waitForMatchesLoaded();

    // Acordeões de data/fase FECHADOS exibem um marcador "N jogos"
    // (ex.: "terça-feira, 1 de dezembro\n1 jogos"); ABERTOS escondem esse
    // marcador. O título do acordeão (a data) é estável e único, então o
    // usamos como âncora. Capturamos a lista de títulos dos acordeões fechados
    // e clicamos cada um pelo título — assim, mesmo que abrir um acordeão
    // injete cards e desloque índices, cada clique mira um botão estável.
    const closedMarkers = this.page.getByText(/^\d+\s+jogos?$/i);
    const titles: string[] = [];
    const markerCount = await closedMarkers.count();
    for (let i = 0; i < markerCount; i++) {
      // O acordeão é o <button> ancestral; seu <h3> tem o título (a data).
      const header = closedMarkers.nth(i).locator("xpath=ancestor::button[1]");
      const title = await header
        .locator("h3")
        .innerText()
        .catch(() => "");
      if (title.trim()) titles.push(title.trim());
    }
    for (const title of titles) {
      const header = this.page
        .locator("button", { has: this.page.getByText(title, { exact: true }) })
        .first();
      await header.click().catch(() => {});
      // Aguarda os cards do acordeão renderizarem antes de seguir.
      await this.page.waitForTimeout(150);
    }
  }

  /**
   * Localiza o card de uma partida pelo card que contém os dois inputs de
   * placar e pertence ao bloco de jogos futuros. Retorna o Locator do card
   * (o container do MatchCard) ou null se não houver cards palpitáveis.
   *
   * Estratégia: cada MatchCard editável tem exatamente 2 inputs number.
   * Agrupamos por par. O índice `pairIndex` seleciona o N-ésimo card.
   */
  scoreInputAt(pairIndex: number, side: "home" | "away"): Locator {
    return this.matchCards.nth(pairIndex * 2 + (side === "home" ? 0 : 1));
  }

  /**
   * Preenche o placar do par de inputs em `pairIndex` (0-based por card).
   * @returns true se os inputs existiam e eram editáveis.
   */
  async fillPredictionAt(pairIndex: number, home: number, away: number): Promise<boolean> {
    const homeInput = this.scoreInputAt(pairIndex, "home");
    const awayInput = this.scoreInputAt(pairIndex, "away");
    if (!(await homeInput.count())) return false;
    if (!(await homeInput.isEditable().catch(() => false))) return false;
    await homeInput.fill(String(home));
    await awayInput.fill(String(away));
    return true;
  }

  /**
   * Localiza o índice (0-based por card) do PRIMEIRO par de inputs EDITÁVEL.
   *
   * Análogo a `findKnockoutPairIndex`, mas sem exigir mata-mata: serve a
   * qualquer card palpitável (fase de grupos OU mata-mata). Necessário porque
   * o índice 0 pode pertencer a um jogo de "hoje" já TRAVADO (`isPrediction
   * Disabled` → inputs `disabled`), enquanto os jogos futuros (seed sintético
   * + jogos reais de jun/26) nos acordeões seguintes continuam editáveis.
   *
   * @returns o pairIndex do 1º card editável, ou -1 se nenhum for editável.
   */
  async findFirstEditablePairIndex(): Promise<number> {
    const total = await this.matchCards.count();
    const pairs = Math.floor(total / 2);
    for (let i = 0; i < pairs; i++) {
      const homeInput = this.scoreInputAt(i, "home");
      if (!(await homeInput.count())) continue;
      if (await homeInput.isEditable().catch(() => false)) return i;
    }
    return -1;
  }

  /**
   * Localiza um card de mata-mata: aquele que, ao receber um EMPATE, exibe a
   * UI "Quem se classifica?". Percorre os cards editáveis preenchendo um
   * empate (1×1) e verificando o aparecimento do seletor.
   * @returns o pairIndex do card de mata-mata, ou -1 se nenhum encontrado.
   */
  async findKnockoutPairIndex(): Promise<number> {
    const total = await this.matchCards.count();
    const pairs = Math.floor(total / 2);
    for (let i = 0; i < pairs; i++) {
      const ok = await this.fillPredictionAt(i, 1, 1);
      if (!ok) continue;
      const selector = this.whoClassifiesSelector();
      if (await selector.isVisible().catch(() => false)) {
        return i;
      }
    }
    return -1;
  }

  /** Locator do seletor "Quem se classifica?" (só em mata-mata + empate). */
  whoClassifiesSelector(): Locator {
    return this.page.getByText(/Quem se classifica\?/i).first();
  }

  /** Botões de seleção de time dentro do seletor "Quem se classifica?". */
  whoClassifiesButtons(): Locator {
    // O seletor é um bloco com 2 <button> de seleção de seleção (home/away).
    return this.whoClassifiesSelector()
      .locator("xpath=ancestor::div[1]")
      .locator("button");
  }

  /**
   * Marca o primeiro time como "quem se classifica" no card de mata-mata
   * (assumindo que o seletor já está visível). Idempotente: se já marcado,
   * não desmarca.
   */
  async selectFirstTieWinner(): Promise<void> {
    const btns = this.whoClassifiesButtons();
    await btns.first().click();
  }

  /**
   * Verdadeiro se algum time está marcado como vencedor do empate.
   * Marcação visual: o botão ativo recebe a classe `border-amber-500/60`.
   */
  async hasTieWinnerSelected(): Promise<boolean> {
    const active = this.page.locator("button.border-amber-500\\/60");
    return (await active.count()) > 0;
  }

  /** Limpa a seleção de "quem se classifica" (clica no botão ativo). */
  async clearTieWinner(): Promise<void> {
    const active = this.page.locator("button.border-amber-500\\/60");
    if (await active.count()) {
      await active.first().click();
    }
  }

  /** Aguarda o seletor de mata-mata ficar visível (após empate). */
  async expectWhoClassifiesVisible(): Promise<void> {
    await expect(this.whoClassifiesSelector()).toBeVisible({ timeout: 10_000 });
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

  /**
   * Salva o palpite do card que contém o par de inputs em `pairIndex`.
   *
   * Mais robusto que `savePrediction()` quando o card alvo NÃO é o primeiro
   * card editável: localiza o botão "Salvar/Palpitar" DENTRO do mesmo
   * MatchCard (ancestral do input), evitando clicar no save de outro card.
   */
  async savePredictionAt(pairIndex: number): Promise<void> {
    const homeInput = this.scoreInputAt(pairIndex, "home");
    // Sobe até o container do MatchCard (a raiz tem rounded-3xl) e mira o
    // botão de salvar daquele card específico.
    const card = homeInput.locator(
      "xpath=ancestor::div[contains(@class,'rounded-3xl')][1]",
    );
    const saveBtn = card.getByRole("button", { name: /Salvar|Palpitar|Confirmar/i });
    if (await saveBtn.count()) {
      await saveBtn.first().click();
      return;
    }
    // Fallback: comportamento legado (primeiro save da página).
    await this.savePrediction();
  }
}
