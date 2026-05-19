import React from "react";
import { Sparkles } from "lucide-react";
import ModalShell from "./ModalShell";
import { RELEASES } from "../../data/releases";

interface WhatsNewModalProps {
  onClose: () => void;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ onClose }) => {
  const latest = RELEASES[0];

  return (
    <ModalShell
      title={
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-brand-green" />
          <span>O que há de novo</span>
        </div>
      }
      showCloseButton={false}
      footer={
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-brand-green text-brand-dark font-bold text-sm hover:bg-brand-green/90 transition-colors"
        >
          Entendido!
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-brand-green/10 text-brand-green border border-brand-green/30 px-2 py-0.5 rounded">
            v{latest.version}
          </span>
          <span className="text-xs text-slate-400">{latest.date}</span>
        </div>
        <ul className="space-y-2">
          {latest.changes.map((change, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-brand-green mt-0.5 shrink-0">•</span>
              <span>{change}</span>
            </li>
          ))}
        </ul>
      </div>
    </ModalShell>
  );
};

export default WhatsNewModal;
