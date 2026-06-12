import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import ModalShell from "./ModalShell";
import { useDatabase } from "../../contexts/DatabaseContext";
import { useUpdateAvailable } from "../../hooks/useUpdateAvailable";
import { CURRENT_VERSION } from "../../data/releases";
import { DEPLOY_TARGET } from "../../utils/deployTarget";

/**
 * Modal obrigatório "Nova versão disponível — Atualizar".
 *
 * Aparece quando a versão publicada pelo PRÓPRIO deploy (via Realtime em
 * `system_config.app_versions[DEPLOY_TARGET]`) diverge da versão embutida no bundle
 * em execução. Bloqueia o uso do app até que o usuário clique em "Atualizar Agora".
 * Não há opção de dispensar — atualização é forçada.
 */
const UpdateAvailableModal: React.FC = () => {
  const isStale = useUpdateAvailable();
  const { systemConfig } = useDatabase();
  const published = systemConfig.app_versions?.[DEPLOY_TARGET] ?? null;

  if (!isStale || !published) return null;

  const handleUpdate = () => {
    // Reload com timestamp para forçar cache refresh
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.href = url.toString();
  };

  const footer = (
    <button
      onClick={handleUpdate}
      className="w-full py-3.5 px-4 rounded-xl bg-brand-green text-brand-dark hover:scale-[1.02] active:scale-[0.98] font-black uppercase text-[11px] tracking-wider transition-all shadow-lg shadow-brand-green/10 flex items-center justify-center gap-2"
    >
      <RefreshCw size={16} />
      Atualizar Agora
    </button>
  );

  return (
    <ModalShell
      title="Atualização Obrigatória"
      footer={footer}
      maxWidthClassName="max-w-sm"
      showCloseButton={false}
    >
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <AlertCircle size={32} className="text-amber-400" />
        </div>

        <div className="text-center space-y-2">
          <p className="text-sm text-slate-300 leading-relaxed">
            Uma nova versão do app está disponível.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs font-mono">
            <span className="text-slate-500">v{CURRENT_VERSION}</span>
            <span className="text-slate-600">→</span>
            <span className="text-brand-green font-bold">v{published}</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Você precisa atualizar para continuar usando o app.
          </p>
        </div>
      </div>
    </ModalShell>
  );
};

export default UpdateAvailableModal;
