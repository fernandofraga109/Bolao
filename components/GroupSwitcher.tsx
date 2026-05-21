import React, { useState } from "react";
import { Group, UserRole } from "../types";
import { Check, PlusCircle, Hash, ArrowRight, Copy } from "lucide-react";
import ModalShell from "./ui/ModalShell";
import DualActionButtons from "./ui/DualActionButtons";
import {
  COMPETITION_OPTIONS,
  DEFAULT_COMPETITION_CODE,
} from "../data/competitions";

interface GroupSwitcherProps {
  myGroups: Group[];
  activeGroupId?: string;
  onSwitch: (groupId: string) => void;
  onCreate: (name: string, competitionCode: string, ruleset: "regulamento_1" | "regulamento_2") => void;
  onJoin: (code: string) => void;
  onClose: () => void;
  error?: string | null;
  userRole: UserRole;
}

type ViewMode = "list" | "create" | "join";

const GroupSwitcher: React.FC<GroupSwitcherProps> = ({
  myGroups,
  activeGroupId,
  onSwitch,
  onCreate,
  onJoin,
  onClose,
  error,
  userRole,
}) => {
  const [mode, setMode] = useState<ViewMode>("list");
  const [inputVal, setInputVal] = useState("");
  const [competitionCode, setCompetitionCode] = useState(
    DEFAULT_COMPETITION_CODE,
  );
  const [ruleset, setRuleset] = useState<"regulamento_1" | "regulamento_2">("regulamento_1");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAction = () => {
    if (!inputVal.trim()) return;
    if (mode === "create") onCreate(inputVal, competitionCode, ruleset);
    if (mode === "join") onJoin(inputVal);
  };

  const handleCopy = (code: string, groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const modalTitle =
    mode === "list"
      ? "Meus Grupos"
      : mode === "create"
        ? "Criar Novo Grupo"
        : "Entrar em Grupo";

  return (
    <ModalShell
      title={modalTitle}
      onClose={onClose}
      maxWidthClassName="max-w-md"
      panelClassName="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
      footer={
        mode !== "list" ? (
          <DualActionButtons
            secondaryLabel="Voltar"
            primaryLabel={
              <span className="inline-flex items-center justify-center gap-2">
                {mode === "create" ? "Criar" : "Entrar"}
                <ArrowRight size={16} />
              </span>
            }
            onSecondary={() => {
              setMode("list");
              setInputVal("");
            }}
            onPrimary={handleAction}
            primaryDisabled={!inputVal.trim()}
            primaryClassName="flex-1 py-3 rounded-lg bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        ) : undefined
      }
      footerClassName="px-4 pb-4"
    >
      {error && (
        <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-200 text-sm px-3 py-2 rounded">
          {error}
        </div>
      )}

      {mode === "list" && (
        <div className="space-y-4">
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {myGroups.length === 0 && (
              <p className="text-slate-500 text-center py-4 text-sm">
                Você não está em nenhum grupo.
              </p>
            )}
            {myGroups.map((group) => {
              const isActive = activeGroupId === group.id;
              const isCopied = copiedId === group.id;

              return (
                <div
                  key={group.id}
                  className={`w-full flex items-center justify-between p-2 pl-3 pr-2 rounded-xl border transition-all ${
                    isActive
                      ? "bg-brand-green/10 border-brand-green ring-1 ring-brand-green"
                      : "bg-slate-700/50 border-slate-600 hover:bg-slate-700/80"
                  }`}
                >
                  <button
                    onClick={() => onSwitch(group.id)}
                    className="flex-1 text-left flex flex-col justify-center h-full py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${isActive ? "text-brand-green" : "text-slate-200"}`}
                      >
                        {group.name}
                      </span>
                      {isActive && (
                        <span className="bg-brand-green text-slate-900 text-[10px] font-bold px-1.5 rounded">
                          ATIVO
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono tracking-wider mt-0.5">
                      #{group.code}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">
                      Competicao:
                      <span className="font-mono text-slate-300 ml-1">
                        {(
                          group.competitionCode || DEFAULT_COMPETITION_CODE
                        ).toUpperCase()}
                      </span>
                    </span>
                  </button>

                  <button
                    onClick={(e) => handleCopy(group.code, group.id, e)}
                    className={`p-2 rounded-lg border transition-colors ml-2 flex-shrink-0 ${
                      isCopied
                        ? "bg-brand-green text-slate-900 border-brand-green"
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-600 hover:text-white"
                    }`}
                    title="Copiar código do grupo"
                  >
                    {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-700 pt-4 grid grid-cols-2 gap-3">
            {userRole === "ADMIN" && (
              <button
                onClick={() => setMode("create")}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                <PlusCircle size={24} />
                <span className="text-xs font-bold">Criar Novo</span>
              </button>
            )}
            <button
              onClick={() => setMode("join")}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-colors ${userRole !== "ADMIN" ? "col-span-2" : ""}`}
            >
              <Hash size={24} />
              <span className="text-xs font-bold">Entrar c/ Código</span>
            </button>
          </div>
        </div>
      )}

      {mode !== "list" && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
              {mode === "create" ? "Nome do Grupo" : "Código do Grupo"}
            </label>
            <input
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) =>
                setInputVal(
                  mode === "join"
                    ? e.target.value.toUpperCase()
                    : e.target.value,
                )
              }
              placeholder={
                mode === "create" ? "Ex: Bolão da Firma" : "Ex: COPA26"
              }
              className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
              onKeyDown={(e) => e.key === "Enter" && handleAction()}
            />
          </div>

          {mode === "create" && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
                  Competicao
                </label>
                <select
                  value={competitionCode}
                  onChange={(e) => setCompetitionCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
                >
                  {COMPETITION_OPTIONS.map((competition) => (
                    <option key={competition.code} value={competition.code}>
                      {competition.code} - {competition.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">
                  Regulamento (Regras de Pontuação)
                </label>
                <select
                  value={ruleset}
                  onChange={(e) => setRuleset(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
                >
                  <option value="regulamento_1">Regulamento 1 (Padrão Antigo)</option>
                  <option value="regulamento_2">Regulamento 2 (Bolão do Mesa 2026)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  {ruleset === "regulamento_1" 
                    ? "Regras tradicionais: Exato (10 pts), Saldo (7 pts), Vencedor (5 pts), com Bônus Underdog."
                    : "Regras especiais: Exato (15-22 pts), Saldo (13-19 pts), Vencedor (10-16 pts), Empate sem bônus saldo, Placar Sozinho (+5 pts) e palpites divididos."}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </ModalShell>
  );
};

export default GroupSwitcher;
