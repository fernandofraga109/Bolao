import React, { useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";
import { useDatabase } from "../../contexts/DatabaseContext";
import { useUpdateAvailable } from "../../hooks/useUpdateAvailable";
import { DEPLOY_TARGET } from "../../utils/deployTarget";

/**
 * Banner não-bloqueante "Nova versão disponível — Atualizar".
 *
 * Aparece quando a versão publicada pelo PRÓPRIO deploy (via Realtime em
 * `system_config.app_versions[DEPLOY_TARGET]`) diverge da versão embutida no bundle
 * em execução. NUNCA recarrega sozinho (evita perder um palpite em digitação): o
 * reload só acontece no clique do usuário. Dispensável — mas se uma versão AINDA
 * mais nova for publicada depois, reaparece (o dismiss é por versão).
 */
const UpdateAvailableBanner: React.FC = () => {
  const isStale = useUpdateAvailable();
  const { systemConfig } = useDatabase();
  const published = systemConfig.app_versions?.[DEPLOY_TARGET] ?? null;
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  if (!isStale || published === dismissedVersion) return null;

  return (
    <div className="sticky top-0 z-50 bg-brand-green text-brand-dark shadow-md">
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
        <ArrowUpCircle size={18} className="shrink-0" />
        <span className="text-sm font-semibold flex-1">
          Nova versão disponível
        </span>
        <button
          onClick={() => window.location.reload()}
          className="bg-brand-dark text-white text-xs font-bold uppercase tracking-wide rounded-lg px-3 py-1.5 hover:opacity-90 transition-opacity"
        >
          Atualizar
        </button>
        <button
          onClick={() => setDismissedVersion(published)}
          aria-label="Dispensar"
          className="text-brand-dark/70 hover:text-brand-dark transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default UpdateAvailableBanner;
