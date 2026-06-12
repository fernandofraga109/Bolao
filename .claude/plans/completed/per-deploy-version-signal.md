# Plano: Sinal de "Nova versão" por deploy (fim da corrida entre bolao e miguelfork)

_Status_: DONE — 2026-06-12

## Problema

Os dois deploys (`bolao` no Vercel do Fernando, `miguelfork` no Vercel do Miguel)
compartilham o **mesmo banco Supabase**. O banner "Nova versão disponível" compara
o `CURRENT_VERSION` do bundle com **um único** `system_config.app_version`.

Quem deploya primeiro sobrescreve a versão para os dois. Se o `bolao` publica 1.X
antes de o `miguelfork` terminar o build, os usuários do `miguelfork` veem
"atualize", mas recarregar continua servindo o bundle antigo (deploy ainda não
subiu) → **preso no modal** e `useBackgroundSync` bloqueado nesse intervalo.

## Causa raiz

"Existe versão nova do MEU app?" só pode ser respondido pelo MEU deploy, mas hoje
é respondido por um valor que o outro deploy sobrescreve.

## Solução escolhida — versão por deploy, sem config manual na Vercel

A Vercel injeta automaticamente `VERCEL_GIT_REPO_OWNER` em build. Os repos têm
donos distintos → derivamos o alvo do deploy automaticamente, sem env var manual:

- `Miguel-de-Castro` → `miguelfork`
- qualquer outro (`fernandofraga109`, local) → `bolao`

Cada deploy publica/lê **só a sua própria chave** em `system_config.app_versions`
(JSONB): `{ "bolao": "1.36.0", "miguelfork": "1.35.1" }`.

## Arquivos

- `scripts/deploy-target.mjs` — `resolveDeployTarget(owner)` (compartilhado por build).
- `vite.config.ts` — injeta `import.meta.env.VITE_DEPLOY_TARGET` em build.
- `utils/deployTarget.ts` — `DEPLOY_TARGET` para o cliente (fallback `bolao`).
- `database/migrations/0030_per_deploy_app_versions.sql` — coluna `app_versions jsonb`
  + função `publish_app_version(target, v)` (SECURITY DEFINER, jsonb_set).
- `types.ts` — `app_versions?: Record<string,string> | null` em `SystemConfigDB`.
- `hooks/useUpdateAvailable.ts` — lê `app_versions[DEPLOY_TARGET]`.
- `scripts/publish-version.mjs` — chama `publish_app_version(target, version)`.
- `data/system_config_sql.ts` + docs — coluna no setup e doc atualizada.

## Passo manual (DBA)

Aplicar `0030_per_deploy_app_versions.sql` no Supabase compartilhado antes/junto do
deploy. Coluna nullable → enquanto NULL, nenhum banner dispara (seguro).

## Transição

A função nova grava só `app_versions`. Abas já abertas com bundle antigo (que leem
`app_version` legado) não recebem este 1º nudge — pegam o bundle novo no próximo
refresh natural. Aceitável (one-time). `app_version` legado fica órfão e pode ser
removido depois que ambos os deploys estiverem no bundle novo.

## Validação

- `useUpdateAvailable.test.ts` atualizado (test-runner) para o formato keyed.
- Build local não publica (guarda `VERCEL_ENV === production` mantida).
