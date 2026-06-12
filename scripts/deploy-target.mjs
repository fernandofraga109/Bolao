/**
 * Deriva o identificador estável do deploy a partir do dono do repositório Git,
 * injetado automaticamente pela Vercel em build (`VERCEL_GIT_REPO_OWNER`).
 *
 * Os dois deploys que compartilham o mesmo banco vêm de repos com donos distintos,
 * então não é preciso configurar nenhuma env var manual na Vercel:
 *   - `Miguel-de-Castro`        → "miguelfork"
 *   - qualquer outro / local    → "bolao"
 *
 * Cada deploy publica/lê só a sua própria chave em `system_config.app_versions`,
 * evitando que um deploy sinalize "nova versão" para o outro antes do build
 * correspondente subir.
 */
export const DEFAULT_DEPLOY_TARGET = "bolao";

export const resolveDeployTarget = (repoOwner) =>
  repoOwner === "Miguel-de-Castro" ? "miguelfork" : DEFAULT_DEPLOY_TARGET;
