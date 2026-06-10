import type { Page, TestInfo } from "@playwright/test";

/**
 * Helpers de screenshot.
 *
 * O Playwright já captura screenshot automaticamente em falhas
 * (`screenshot: "only-on-failure"` em playwright.config.ts).
 *
 * Estes helpers servem para capturas *intencionais* durante o fluxo
 * (ex.: documentar uma etapa, comparar estados), salvas em
 * `test-results/screenshots/` e anexadas ao relatório HTML.
 */

const SCREENSHOT_DIR = "test-results/screenshots";

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Captura um screenshot nomeado da página inteira e o anexa ao teste atual.
 * @param page    Página do Playwright.
 * @param testInfo `testInfo` do teste (para nomear/anexar).
 * @param name    Rótulo legível da captura (ex.: "ranking-apos-jogo").
 */
export async function captureStep(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<string> {
  const fileName = `${slugify(testInfo.title)}__${slugify(name)}.png`;
  const filePath = testInfo.outputPath(`${SCREENSHOT_DIR}/${fileName}`);
  await page.screenshot({ path: filePath, fullPage: true });
  await testInfo.attach(name, { path: filePath, contentType: "image/png" });
  return filePath;
}

/**
 * Captura apenas um elemento específico (ex.: um card de partida).
 */
export async function captureElement(
  page: Page,
  testInfo: TestInfo,
  selector: string,
  name: string,
): Promise<void> {
  const locator = page.locator(selector).first();
  const fileName = `${slugify(testInfo.title)}__${slugify(name)}.png`;
  const filePath = testInfo.outputPath(`${SCREENSHOT_DIR}/${fileName}`);
  await locator.screenshot({ path: filePath });
  await testInfo.attach(name, { path: filePath, contentType: "image/png" });
}
