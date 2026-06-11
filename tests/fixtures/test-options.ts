import { test as base, expect } from "@playwright/test";
import { ConsoleErrorCollector } from "../helpers/console-errors";
import { LoginPage } from "../pages/LoginPage";
import { AppShell } from "../pages/AppShell";
import { MatchesPage } from "../pages/MatchesPage";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { AdminPage } from "../pages/AdminPage";
import { CURRENT_VERSION } from "../../data/releases";

/**
 * Fixture estendida do Playwright.
 *
 * Injeta automaticamente em cada teste:
 *  - Page Objects prontos (`loginPage`, `appShell`, `matchesPage`, `leaderboardPage`)
 *  - `consoleErrors`: coletor de erros do navegador (anexado ao report no fim)
 *
 * Use `import { test, expect } from "../fixtures/test-options"` nos specs.
 */

interface Fixtures {
  consoleErrors: ConsoleErrorCollector;
  loginPage: LoginPage;
  appShell: AppShell;
  matchesPage: MatchesPage;
  leaderboardPage: LeaderboardPage;
  adminPage: AdminPage;
}

export const test = base.extend<Fixtures>({
  // Override de `page`: semeia o localStorage ANTES de qualquer navegação
  // para que o WhatsNewModal (App.tsx) nunca abra em browsers limpos.
  //
  // Sem isso, o overlay do modal (`fixed inset-0 z-50 ... bg-black/80`)
  // intercepta cliques no BottomNav e no botão "Sair", quebrando os fluxos
  // que clicam (PRED-01/07, LOCK-01, AUTH-13). `addInitScript` roda em todo
  // documento novo, então cobre navegações e reloads.
  page: async ({ page }, use) => {
    await page.addInitScript((version) => {
      try {
        localStorage.setItem("bolao_last_seen_version", version as string);
      } catch {
        /* localStorage indisponível — segue sem semear */
      }
    }, CURRENT_VERSION);
    await use(page);
  },

  // Coletor de erros — inicia antes do teste, reporta depois.
  consoleErrors: async ({ page }, use, testInfo) => {
    const collector = new ConsoleErrorCollector(page);
    await use(collector);
    // Após o teste: anexa o relatório de erros ao resultado (visível no HTML).
    await collector.attachReport(testInfo);
  },

  // Page Objects (dependem implicitamente de `consoleErrors` já estar ativo
  // garantindo que a captura comece antes de qualquer navegação).
  loginPage: async ({ page, consoleErrors }, use) => {
    void consoleErrors;
    await use(new LoginPage(page));
  },
  appShell: async ({ page }, use) => {
    await use(new AppShell(page));
  },
  matchesPage: async ({ page }, use) => {
    await use(new MatchesPage(page));
  },
  leaderboardPage: async ({ page }, use) => {
    await use(new LeaderboardPage(page));
  },
  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },
});

export { expect };
