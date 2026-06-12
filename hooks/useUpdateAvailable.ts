import { useDatabase } from "../contexts/DatabaseContext";
import { CURRENT_VERSION } from "../data/releases";
import { DEPLOY_TARGET } from "../utils/deployTarget";

/**
 * Detecta (passivamente) se há uma versão mais nova da app publicada pelo PRÓPRIO
 * deploy.
 *
 * Compara a versão embutida no bundle em execução (`CURRENT_VERSION`) com a versão
 * publicada pelo servidor em `system_config.app_versions[DEPLOY_TARGET]`, que chega
 * ao vivo via Realtime — sem polling extra e sem reload. Igualdade de string basta
 * (evita parsing de semver); qualquer divergência = recarregar.
 *
 * Por que keyed por deploy: os dois deploys (`bolao` e `miguelfork`) compartilham o
 * mesmo banco. Lendo só a chave do próprio deploy, um deploy nunca sinaliza "nova
 * versão" para o outro antes do build correspondente subir — evitando o usuário
 * preso no modal enquanto o deploy ainda está carregando. Ver [[per-deploy-version-signal]].
 *
 * Guarda contra falso-positivo: só fica `true` se a versão do deploy for truthy,
 * então bancos legados (chave ausente/NULL) nunca disparam o banner.
 */
export const useUpdateAvailable = (): boolean => {
  const { systemConfig } = useDatabase();
  const published = systemConfig.app_versions?.[DEPLOY_TARGET];
  return !!published && published !== CURRENT_VERSION;
};
