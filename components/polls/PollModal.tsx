import React, { useState } from "react";
import { MessageSquare, Check } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { Poll } from "../../types";

interface PollModalProps {
  poll: Poll;
  /** Quantas enquetes ainda estão pendentes (incluindo esta). */
  remaining: number;
  onSubmit: (optionIndexes: number[]) => Promise<boolean>;
}

/**
 * Modal BLOQUEANTE de enquete: não tem botão de fechar nem dismiss — o usuário só
 * sai respondendo. Voto travado (uma submissão por poll). Suporta escolha única
 * (allow_multiple=false) e múltipla (checkbox).
 */
const PollModal: React.FC<PollModalProps> = ({ poll, remaining, onSubmit }) => {
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (idx: number) => {
    if (poll.allow_multiple) {
      setSelected((prev) =>
        prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
      );
    } else {
      setSelected([idx]);
    }
  };

  const handleSubmit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit([...selected].sort((a, b) => a - b));
    if (!ok) setSubmitting(false); // mantém o modal para nova tentativa
  };

  return (
    <ModalShell
      showCloseButton={false}
      title={
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-brand-green" />
          <span>Sua opinião conta</span>
        </div>
      }
      footer={
        <button
          onClick={handleSubmit}
          disabled={selected.length === 0 || submitting}
          className="w-full py-2.5 rounded-xl bg-brand-green text-brand-dark font-bold text-sm transition-colors hover:bg-brand-green/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Enviando..." : "Confirmar resposta"}
        </button>
      }
    >
      <div className="space-y-4">
        {remaining > 1 && (
          <div className="text-xs text-slate-400">
            +{remaining - 1} {remaining - 1 === 1 ? "enquete" : "enquetes"} após esta
          </div>
        )}
        <p className="text-base font-semibold text-white">{poll.question}</p>
        {poll.allow_multiple && (
          <p className="text-xs text-slate-400">Você pode escolher mais de uma opção.</p>
        )}
        <div className="space-y-2">
          {poll.options.map((option, idx) => {
            const isSelected = selected.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggle(idx)}
                className={`w-full flex items-center gap-3 text-left px-3 py-3 rounded-xl border transition-colors ${
                  isSelected
                    ? "border-brand-green bg-brand-green/10 text-white"
                    : "border-slate-700 bg-slate-900/40 text-slate-300 hover:border-slate-600"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-5 h-5 shrink-0 border ${
                    poll.allow_multiple ? "rounded-md" : "rounded-full"
                  } ${
                    isSelected ? "border-brand-green bg-brand-green" : "border-slate-500"
                  }`}
                >
                  {isSelected && <Check size={14} className="text-brand-dark" strokeWidth={3} />}
                </span>
                <span className="text-sm font-medium">{option}</span>
              </button>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
};

export default PollModal;
