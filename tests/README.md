# Testes E2E (Playwright) — Bolão Copa 2026

Infraestrutura de testes ponta-a-ponta com **Playwright**. Os testes unitários/de
componente continuam no **Vitest** (`npm run test`) — são runners separados.

---

## 1. Estrutura

```
tests/
├── e2e/                 # specs *.spec.ts (os testes em si)
│   └── smoke.spec.ts    # exemplo/template (único teste pronto por enquanto)
├── pages/               # Page Objects (1 por tela/área)
│   ├── BasePage.ts      # base comum (goto, waitForAppReady)
│   ├── LoginPage.ts     # login/cadastro/reset
│   ├── AppShell.ts      # Header + BottomNav (navegação entre tabs)
│   ├── MatchesPage.ts   # tab Jogos (palpites)
│   └── LeaderboardPage.ts # tab Rank
├── fixtures/
│   ├── test-options.ts  # fixture estendida: injeta page objects + captura de erros
│   └── test-data.ts     # dados de teste (lidos de env), rótulos das tabs
└── helpers/
    ├── console-errors.ts # captura erros do navegador (console/pageerror/HTTP)
    └── screenshot.ts     # screenshots intencionais nomeados

playwright.config.ts      # configuração (na raiz)
.env.e2e.example          # template de variáveis de ambiente
```

Artefatos gerados (ignorados pelo git): `test-results/`, `playwright-report/`.

---

## 2. Pré-requisitos (já feitos no setup)

- `@playwright/test` instalado (`devDependencies`).
- Navegador Chromium baixado (`npx playwright install chromium`).

Se clonar o repo do zero, rode uma vez:

```bash
npm install
npx playwright install chromium
```

---

## 3. Como executar

O Playwright **sobe o dev server automaticamente** (`npm run dev`, porta 3000)
via `webServer` no config — e reaproveita se já estiver no ar.

| Comando | O que faz |
|---|---|
| `npm run test:e2e` | Roda toda a suíte E2E (headless) |
| `npm run test:e2e:headed` | Roda com o navegador visível |
| `npm run test:e2e:ui` | Abre o **UI Mode** (melhor p/ desenvolver/depurar) |
| `npm run test:e2e:debug` | Modo debug passo-a-passo (Inspector) |
| `npm run test:e2e:report` | Abre o último relatório HTML |
| `npm run test:e2e:codegen` | Gera seletores/ações gravando interações |

Rodar um arquivo ou teste específico:

```bash
npx playwright test tests/e2e/smoke.spec.ts
npx playwright test -g "tela de login"
```

---

## 4. Variáveis de ambiente

O `.env.e2e` **não é carregado automaticamente**. Copie o template e preencha:

```bash
cp .env.e2e.example .env.e2e
```

Para carregar antes de rodar (PowerShell):

```powershell
Get-Content .env.e2e | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { Set-Item "env:$($matches[1].Trim())" $matches[2].Trim() }
}
npm run test:e2e
```

Variáveis suportadas: `PLAYWRIGHT_BASE_URL`, `E2E_USER_EMAIL/PASSWORD/NAME`,
`E2E_ADMIN_EMAIL/PASSWORD`, `E2E_GROUP_CODE` (ver `.env.e2e.example`).

> Testes que dependem de login real usam `test.skip(!hasTestUser, ...)` — eles
> são **pulados** (não falham) quando o ambiente não está configurado.

---

## 5. Recursos automáticos

- **Screenshots em falha** — `screenshot: "only-on-failure"`. Ficam em
  `test-results/` e no relatório HTML. Capturas intencionais: `captureStep()`
  (`helpers/screenshot.ts`).
- **Vídeo e trace em falha** — `video: retain-on-failure`, `trace: on-first-retry`.
  Veja o trace com `npx playwright show-trace <arquivo.zip>`.
- **Captura de erros do navegador** — a fixture `consoleErrors`
  (`helpers/console-errors.ts`) coleta `console.error`, exceções (`pageerror`),
  respostas HTTP ≥ 400 e requests falhos. Anexa um `browser-errors.json` ao
  relatório. Asserte com `expect(consoleErrors.fatal).toHaveLength(0)`.
  Ruídos conhecidos (Vite, flagcdn, avatares, realtime) são ignorados — ajuste
  `IGNORE_PATTERNS` se necessário.

---

## 6. Escrevendo um novo teste

Sempre importe `test`/`expect` da **fixture estendida** (não do pacote direto):

```ts
import { test, expect } from "../fixtures/test-options";

test("usuário faz login e vê a tab Jogos", async ({ loginPage, appShell }) => {
  await loginPage.open();
  await loginPage.login("user@x.com", "senha");
  await expect(await appShell.isAuthenticated()).toBeTruthy();
});
```

Boas práticas:
- **Sem `data-testid`** no app: prefira `getByRole` → `getByText` → `getByPlaceholder`.
  Evite seletores por classe Tailwind.
- Coloque seletores em **Page Objects** (`tests/pages/`), não nos specs.
- Dados de teste em `tests/fixtures/test-data.ts`.
- Um arquivo `.spec.ts` por funcionalidade; agrupe com `test.describe`.

---

## 7. Convenção do projeto

A **suíte completa** de casos está mapeada em
[`documentacao/test-cases.md`](../documentacao/test-cases.md) (P0/P1/P2).
A **implementação** de novos testes segue a regra do projeto: o agente
**`test-runner`** é o responsável por criar/editar arquivos de teste
(ver `documentacao/testing-strategy.md` §2 e `CLAUDE.md`).

Esta entrega contém apenas a **infraestrutura** + um smoke de exemplo —
os demais testes ainda **não** foram implementados.

---

## 8. Integração com o Vitest

Os `*.spec.ts` de E2E são **excluídos do Vitest** (`test.exclude: ["tests/**"]`
em `vite.config.ts`). Assim, `npm run test` (unit) e `npm run test:e2e` (E2E)
não colidem.
