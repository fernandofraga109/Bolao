/**
 * Identificador do deploy atual, embutido no bundle em build via Vite
 * (`import.meta.env.VITE_DEPLOY_TARGET`, definido em `vite.config.ts` a partir do
 * dono do repositório Git que a Vercel injeta). Em dev/test cai no fallback.
 *
 * Usado pelo banner "Nova versão disponível" para ler apenas a versão publicada
 * pelo PRÓPRIO deploy em `system_config.app_versions[DEPLOY_TARGET]` — assim um
 * deploy nunca dispara o banner para o outro antes do build correspondente subir.
 */
export const DEFAULT_DEPLOY_TARGET = "bolao";

export const DEPLOY_TARGET: string =
  (import.meta.env.VITE_DEPLOY_TARGET as string | undefined) || DEFAULT_DEPLOY_TARGET;
