import type { Page, TestInfo } from "@playwright/test";

/**
 * Captura de erros do navegador durante um teste E2E.
 *
 * Coleta:
 *  - `console.error` / `console.warning` emitidos pela página
 *  - exceções não tratadas (`pageerror`)
 *  - respostas HTTP com status >= 400 (`response`)
 *  - falhas de request (`requestfailed`)
 *
 * Uso típico: instanciado automaticamente pela fixture `test` em
 * `tests/fixtures/test-options.ts`. Também pode ser usado manualmente.
 */

export interface BrowserError {
  type: "console" | "pageerror" | "http" | "requestfailed";
  text: string;
  url?: string;
  status?: number;
}

/**
 * Padrões de erro que são ruído conhecido e devem ser ignorados na asserção
 * de "console limpo". Ajuste conforme necessário.
 */
const IGNORE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  // O app carrega Tailwind via CDN no index.html (warning esperado em dev):
  /cdn\.tailwindcss\.com should not be used in production/i,
  // Recursos externos opcionais (bandeiras, avatares) podem falhar offline:
  /flagcdn\.com/i,
  /ui-avatars\.com/i,
  /crests\.football-data\.org/i,
  // Realtime/Supabase pode logar reconexões em ambiente sem credenciais:
  /realtime/i,
];

const shouldIgnore = (text: string): boolean =>
  IGNORE_PATTERNS.some((re) => re.test(text));

export class ConsoleErrorCollector {
  readonly errors: BrowserError[] = [];

  constructor(private readonly page: Page) {
    this.attach();
  }

  private attach() {
    this.page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        const text = msg.text();
        if (!shouldIgnore(text)) {
          this.errors.push({ type: "console", text });
        }
      }
    });

    this.page.on("pageerror", (err) => {
      const text = err.message || String(err);
      if (!shouldIgnore(text)) {
        this.errors.push({ type: "pageerror", text });
      }
    });

    this.page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) {
        const url = res.url();
        if (!shouldIgnore(url)) {
          this.errors.push({ type: "http", text: `HTTP ${status}`, url, status });
        }
      }
    });

    this.page.on("requestfailed", (req) => {
      const failure = req.failure();
      const text = failure?.errorText || "request failed";
      const url = req.url();
      // `net::ERR_ABORTED` é comum em navegação/cancelamento — ignora.
      if (!/ERR_ABORTED/i.test(text) && !shouldIgnore(url)) {
        this.errors.push({ type: "requestfailed", text, url });
      }
    });
  }

  /** Apenas erros graves (exceções e console.error), sem HTTP/warnings. */
  get fatal(): BrowserError[] {
    return this.errors.filter(
      (e) => e.type === "pageerror" || e.type === "console",
    );
  }

  /** Anexa o relatório de erros ao resultado do teste (visível no report HTML). */
  async attachReport(testInfo: TestInfo) {
    if (this.errors.length === 0) return;
    await testInfo.attach("browser-errors.json", {
      body: JSON.stringify(this.errors, null, 2),
      contentType: "application/json",
    });
  }
}
