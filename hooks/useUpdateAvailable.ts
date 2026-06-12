import { useDatabase } from "../contexts/DatabaseContext";
import { CURRENT_VERSION } from "../data/releases";

/**
 * Detecta (passivamente) se há uma versão mais nova da app publicada no servidor.
 *
 * Compara a versão embutida no bundle em execução (`CURRENT_VERSION`) com a versão
 * publicada pelo servidor em `system_config.app_version`, que chega ao vivo via
 * Realtime — sem polling extra e sem reload. Igualdade de string basta (evita
 * parsing de semver); qualquer divergência = recarregar.
 *
 * Guarda contra falso-positivo: só fica `true` se `app_version` for truthy, então
 * bancos legados (coluna NULL) nunca disparam o banner.
 */
export const useUpdateAvailable = (): boolean => {
  const { systemConfig } = useDatabase();
  const published = systemConfig.app_version;
  return !!published && published !== CURRENT_VERSION;
};
