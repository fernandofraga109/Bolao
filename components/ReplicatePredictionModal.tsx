import React, { useState } from "react";
import { GroupDB, Match } from "../types";
import ModalShell from "./ui/ModalShell";
import { Check, Copy, AlertCircle, Loader2 } from "lucide-react";

interface ReplicatePredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  eligibleGroups: GroupDB[];
  match: Match;
  homeScore: number;
  awayScore: number;
  onConfirm: (selectedGroupIds: string[]) => Promise<void>;
}

export const ReplicatePredictionModal: React.FC<ReplicatePredictionModalProps> = ({
  isOpen,
  onClose,
  eligibleGroups,
  match,
  homeScore,
  awayScore,
  onConfirm,
}) => {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    eligibleGroups.map((g) => g.id)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleAll = () => {
    if (selectedGroupIds.length === eligibleGroups.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(eligibleGroups.map((g) => g.id));
    }
  };

  const handleConfirm = async () => {
    if (selectedGroupIds.length === 0) {
      setError("Selecione ao menos um grupo para replicar.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(selectedGroupIds);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao replicar palpite.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between gap-3 w-full">
      <button
        onClick={onClose}
        disabled={isSubmitting}
        className="flex-1 py-3 px-4 rounded-xl border border-slate-700 hover:bg-slate-700/50 text-slate-300 font-black uppercase text-[10px] tracking-wider transition-all disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        onClick={handleConfirm}
        disabled={isSubmitting || selectedGroupIds.length === 0}
        className="flex-1 py-3 px-4 rounded-xl bg-brand-green text-brand-dark hover:scale-[1.02] active:scale-[0.98] font-black uppercase text-[10px] tracking-wider transition-all shadow-lg shadow-brand-green/10 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Replicando...
          </>
        ) : (
          <>
            <Copy size={12} />
            Replicar Palpite
          </>
        )}
      </button>
    </div>
  );

  return (
    <ModalShell
      title="Sincronizar Palpite"
      onClose={onClose}
      footer={footer}
      maxWidthClassName="max-w-md"
    >
      <div className="space-y-4 py-2">
        {/* Match Prediction Info */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            Resultado a ser replicado
          </span>
          <div className="flex items-center justify-center gap-4 w-full">
            <div className="flex items-center gap-2 flex-1 justify-end">
              <span className="text-xs font-bold text-slate-300 truncate max-w-[80px] sm:max-w-[110px]">
                {match.homeTeam.name}
              </span>
              {match.homeTeam.flag ? (
                <img
                  src={match.homeTeam.flag}
                  alt={match.homeTeam.name}
                  className="w-5 h-5 object-contain"
                />
              ) : (
                <div className="w-5 h-5 bg-slate-700 rounded flex items-center justify-center">
                  <span className="text-slate-400 text-xs">?</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 font-mono font-black text-brand-green text-base">
              <span>{homeScore}</span>
              <span className="text-slate-600 text-xs">×</span>
              <span>{awayScore}</span>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-start">
              {match.awayTeam.flag ? (
                <img
                  src={match.awayTeam.flag}
                  alt={match.awayTeam.name}
                  className="w-5 h-5 object-contain"
                />
              ) : (
                <div className="w-5 h-5 bg-slate-700 rounded flex items-center justify-center">
                  <span className="text-slate-400 text-xs">?</span>
                </div>
              )}
              <span className="text-xs font-bold text-slate-300 truncate max-w-[80px] sm:max-w-[110px]">
                {match.awayTeam.name}
              </span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 text-center leading-relaxed">
          Gostaria de replicar este mesmo palpite para os seus outros grupos da mesma competição e mesmo regulamento?
        </p>

        {error && (
          <div className="bg-brand-red/10 border border-brand-red/20 text-brand-red p-3 rounded-xl flex items-start gap-2 text-xs">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Groups Selection List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Seus Grupos ({selectedGroupIds.length}/{eligibleGroups.length})
            </span>
            <button
              onClick={toggleAll}
              className="text-[9px] font-black uppercase text-brand-green hover:underline cursor-pointer"
            >
              {selectedGroupIds.length === eligibleGroups.length
                ? "Desmarcar todos"
                : "Selecionar todos"}
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
            {eligibleGroups.map((group) => {
              const isChecked = selectedGroupIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isChecked
                      ? "bg-slate-700/30 border-brand-green/30 text-white"
                      : "bg-slate-900/20 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-black">{group.name}</span>
                    <span className="text-[9px] font-mono text-slate-500">
                      Código: #{group.code}
                    </span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                      isChecked
                        ? "bg-brand-green border-brand-green text-brand-dark"
                        : "border-slate-700"
                    }`}
                  >
                    {isChecked && <Check size={12} className="stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default ReplicatePredictionModal;
