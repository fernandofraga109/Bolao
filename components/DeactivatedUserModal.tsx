import React from "react";
import { AlertCircle, LogOut } from "lucide-react";
import ModalShell from "./ui/ModalShell";

interface DeactivatedUserModalProps {
  onLogout: () => void;
}

const DeactivatedUserModal: React.FC<DeactivatedUserModalProps> = ({
  onLogout,
}) => {
  const footer = (
    <button
      onClick={onLogout}
      className="w-full py-3.5 px-4 rounded-xl bg-brand-green text-brand-dark hover:scale-[1.02] active:scale-[0.98] font-black uppercase text-[11px] tracking-wider transition-all shadow-lg shadow-brand-green/10 flex items-center justify-center gap-2"
    >
      <LogOut size={16} />
      Sair
    </button>
  );

  return (
    <ModalShell
      title="Mensagem do sistema"
      footer={footer}
      maxWidthClassName="max-w-sm"
      showCloseButton={false}
    >
      <div className="flex flex-col items-center gap-5 py-4">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <AlertCircle size={32} className="text-amber-400" />
        </div>

        <p className="text-sm text-slate-300 text-center leading-relaxed">
          Usuário desativado. Para mais informações contacte o administrador.
        </p>
      </div>
    </ModalShell>
  );
};

export default DeactivatedUserModal;
