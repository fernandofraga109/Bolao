import { test as base, expect } from "@playwright/test";
import { ConsoleErrorCollector } from "../helpers/console-errors";
import { LoginPage } from "../pages/LoginPage";
import { AppShell } from "../pages/AppShell";
import { MatchesPage } from "../pages/MatchesPage";
import { LeaderboardPage } from "../pages/LeaderboardPage";
import { AdminPage } from "../pages/AdminPage";

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
