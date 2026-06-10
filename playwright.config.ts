import { defineConfig, devices } from "@playwright/test";

/**
 * Configuração de testes E2E (Playwright) — Bolão Copa 2026.
 *
 * - testDir: `tests/e2e` (specs ficam separados dos testes unitários do Vitest).
 * - baseURL: configurável por `PLAYWRIGHT_BASE_URL` (default: dev server na :3000).
 * - webServer: sobe `npm run dev` automaticamente (reaproveita se já estiver no ar).
 * - Screenshots/vídeo/trace: capturados automaticamente em falhas.
 *
 * Execução: ver `tests/README.md`.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  // Padrão de arquivos de teste E2E.
  testMatch: "**/*.spec.ts",

  // Tempo máximo por teste e por asserção.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  // Falha o build de CI se sobrar `test.only`.
  forbidOnly: !!process.env.CI,
  // Re-tentativas: 2 em CI, 0 localmente.
  retries: process.env.CI ? 2 : 0,
  // Paraleliza dentro de cada arquivo.
  fullyParallel: true,
  // Workers: 1 em CI (estável), default localmente.
  workers: process.env.CI ? 1 : undefined,

  // Relatórios: HTML (não abre sozinho) + lista no terminal.
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  // Pasta de artefatos (screenshots/vídeos/traces de falhas).
  outputDir: "test-results",

  use: {
    baseURL: BASE_URL,
    // Captura automática em falhas:
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
    // Locale/timezone determinísticos (app é pt-BR).
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Perfil mobile (app é mobile-first). Descomente para rodar também:
    // {
    //   name: "mobile-chrome",
    //   use: { ...devices["Pixel 7"] },
    // },
  ],

  // Sobe o dev server automaticamente antes dos testes.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
