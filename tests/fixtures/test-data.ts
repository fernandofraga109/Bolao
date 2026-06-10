/**
 * Dados de teste reutilizáveis.
 *
 * Credenciais e códigos de grupo vêm de variáveis de ambiente para não
 * versionar segredos. Defina-os em `.env.e2e` (ver `tests/README.md`).
 *
 * Em testes que dependem de login real, use `test.skip(!hasTestUser, ...)`
 * para pular graciosamente quando o ambiente não está configurado.
 */

export interface TestUser {
  email: string;
  password: string;
  name?: string;
}

export const TEST_USER: TestUser = {
  email: process.env.E2E_USER_EMAIL || "",
  password: process.env.E2E_USER_PASSWORD || "",
  name: process.env.E2E_USER_NAME || "Usuário E2E",
};

export const TEST_ADMIN: TestUser = {
  email: process.env.E2E_ADMIN_EMAIL || "",
  password: process.env.E2E_ADMIN_PASSWORD || "",
};

/** Código de grupo válido para fluxos de cadastro/entrada. */
export const TEST_GROUP_CODE = process.env.E2E_GROUP_CODE || "";

/** Flags de disponibilidade para `test.skip(...)`. */
export const hasTestUser = !!(TEST_USER.email && TEST_USER.password);
export const hasTestAdmin = !!(TEST_ADMIN.email && TEST_ADMIN.password);
export const hasTestGroup = !!TEST_GROUP_CODE;

/** Gera um e-mail único para testes de cadastro. */
export const uniqueEmail = (prefix = "e2e"): string =>
  `${prefix}+${Date.now()}@bolao-test.local`;

/** Rótulos das tabs do BottomNav (pt-BR), úteis para navegação. */
export const TABS = {
  matches: "Jogos",
  tournament: "Tabela",
  specials: "Especiais",
  leaderboard: "Rank",
  stats: "Stats",
  admin: "Admin",
} as const;
