import React from "react";
import { Team } from "../types";
import { TeamFormEntry, FormOutcome } from "../utils/teamForm";
import ModalShell from "./ui/ModalShell";

interface LastFiveMatchesModalProps {
  team: Team;
  entries: TeamFormEntry[];
  onClose: () => void;
}

const OUTCOME_BADGE: Record<FormOutcome, { label: string; cls: string }> = {
  W: { label: "V", cls: "bg-brand-green/15 text-brand-green border-brand-green/30" },
  D: { label: "E", cls: "bg-slate-600/20 text-slate-300 border-slate-500/30" },
  L: { label: "D", cls: "bg-brand-red/15 text-brand-red border-brand-red/30" },
};

/**
 * Modal com os últimos jogos do time (adversário, placar, data, V/E/D).
 * Recebe `entries` já calculadas (em memória) — não busca nada no banco.
 */
const LastFiveMatchesModal: React.FC<LastFiveMatchesModalProps> = ({ team, entries, onClose }) => {
  const title = (
    <div className="flex items-center gap-2">
      {team.flag && (
        <img src={team.flag} alt={team.name} className="w-6 h-6 rounded-sm object-contain" />
      )}
      <span className="text-base">Últimos jogos · {team.name}</span>
    </div>
  );

  return (
    <ModalShell title={title} onClose={onClose} maxWidthClassName="max-w-md">
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">
          Sem jogos anteriores nesta competição.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const { match, outcome, isHome, opponent, goalsFor, goalsAgainst } = entry;
            const badge = OUTCOME_BADGE[outcome];
            const date = new Date(match.date).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
            return (
              <div
                key={match.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-700/40"
              >
                <span
                  className={`w-7 h-7 shrink-0 rounded-lg border flex items-center justify-center text-xs font-black ${badge.cls}`}
                >
                  {badge.label}
                </span>

                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {opponent.flag && (
                    <img
                      src={opponent.flag}
                      alt={opponent.name}
                      className="w-5 h-5 rounded-sm object-contain shrink-0"
                    />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-200 truncate">
                      {opponent.name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {isHome ? "Casa" : "Fora"} · {date}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 font-mono font-black text-slate-200 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span>{goalsFor}</span>
                  <span className="text-slate-600 text-xs">×</span>
                  <span>{goalsAgainst}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
};

export default LastFiveMatchesModal;
