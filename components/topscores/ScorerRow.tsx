import React from "react";
import { PlayerWithContextDB } from "../../types";

interface ScorerRowProps {
  scorer: PlayerWithContextDB;
  rank: number;
}

// Medal accent for the top 3 positions, neutral for the rest.
const rankAccent = (rank: number): string => {
  if (rank === 1) return "bg-amber-400/15 text-amber-300 border-amber-400/40";
  if (rank === 2) return "bg-slate-300/15 text-slate-200 border-slate-300/40";
  if (rank === 3) return "bg-orange-500/15 text-orange-300 border-orange-500/40";
  return "bg-slate-800 text-slate-400 border-slate-700";
};

const ScorerRow: React.FC<ScorerRowProps> = ({ scorer, rank }) => {
  const tp = scorer.tournamentEntry;

  return (
    <div className="flex items-center gap-3 px-3 py-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
      {/* Rank */}
      <span
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-black ${rankAccent(
          rank
        )}`}
      >
        {rank}
      </span>

      {/* Team crest */}
      {tp.teamCrest ? (
        <img
          src={tp.teamCrest}
          alt={tp.teamName}
          className="w-7 h-7 object-contain flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <span className="w-7 h-7 flex-shrink-0" />
      )}

      {/* Name + team */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">{scorer.name}</p>
        <p className="text-[11px] text-slate-400 truncate">{tp.teamName}</p>
      </div>

      {/* Secondary stats */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-semibold">
        {tp.assists > 0 && (
          <span title="Assistências">
            {tp.assists} <span className="text-slate-500">A</span>
          </span>
        )}
        {tp.penalties > 0 && (
          <span title="Pênaltis">
            {tp.penalties} <span className="text-slate-500">P</span>
          </span>
        )}
      </div>

      {/* Goals */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-12">
        <span className="text-lg font-black text-brand-green leading-none">
          {tp.goals}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">
          gols
        </span>
      </div>
    </div>
  );
};

export default ScorerRow;
