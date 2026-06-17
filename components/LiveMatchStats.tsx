import React, { useMemo } from "react";
import { Match, LiveTeamStat } from "../types";
import MirroredBarChart, { MirroredStatRow } from "./MirroredBarChart";

interface LiveMatchStatsProps {
  match: Match;
}

// Traduções dos rótulos de estatística vindos da api-sports (inglês) para pt-BR.
const STAT_PT: Record<string, string> = {
  "Ball Possession": "Posse de bola",
  "Total Shots": "Finalizações",
  "Shots on Goal": "No gol",
  "Shots off Goal": "Para fora",
  "Blocked Shots": "Bloqueadas",
  "Shots insidebox": "Dentro da área",
  "Shots outsidebox": "Fora da área",
  "Fouls": "Faltas",
  "Corner Kicks": "Escanteios",
  "Offsides": "Impedimentos",
  "Yellow Cards": "Cartões amarelos",
  "Red Cards": "Cartões vermelhos",
  "Goalkeeper Saves": "Defesas",
  "Total passes": "Passes",
  "Passes accurate": "Passes certos",
  "Passes %": "Acerto de passes",
  "expected_goals": "Gols esperados (xG)",
  "goals_prevented": "Gols evitados",
};

// Ordem de exibição preferida; tipos fora desta lista vão ao fim, na ordem recebida.
const STAT_ORDER = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "Shots off Goal",
  "Blocked Shots",
  "Shots insidebox",
  "Shots outsidebox",
  "expected_goals",
  "Corner Kicks",
  "Offsides",
  "Fouls",
  "Yellow Cards",
  "Red Cards",
  "Goalkeeper Saves",
  "Total passes",
  "Passes accurate",
  "Passes %",
];

const translateStat = (type: string): string => STAT_PT[type] ?? type;

/**
 * Painel "Estatísticas" da partida (api-sports `fixtures/statistics`).
 * Mirrored comparison bar chart: mandante (verde, esquerda) × visitante
 * (azul, direita), a partir de um eixo central.
 *
 * Dados puramente informativos — NÃO entram em nenhum cálculo de pontos.
 */
export const LiveMatchStats: React.FC<LiveMatchStatsProps> = ({ match }) => {
  const stats = match.liveStats;

  const rows = useMemo<MirroredStatRow[]>(() => {
    if (!stats) return [];
    const byTypeHome = new Map<string, LiveTeamStat["value"]>();
    const byTypeAway = new Map<string, LiveTeamStat["value"]>();
    stats.home?.forEach((s) => byTypeHome.set(s.type, s.value));
    stats.away?.forEach((s) => byTypeAway.set(s.type, s.value));

    const allTypes = Array.from(
      new Set([...byTypeHome.keys(), ...byTypeAway.keys()]),
    );
    allTypes.sort((x, y) => {
      const ix = STAT_ORDER.indexOf(x);
      const iy = STAT_ORDER.indexOf(y);
      return (ix === -1 ? 999 : ix) - (iy === -1 ? 999 : iy);
    });

    return allTypes.map((type) => ({
      key: type,
      label: translateStat(type),
      left: byTypeHome.get(type) ?? null,
      right: byTypeAway.get(type) ?? null,
    }));
  }, [stats]);

  if (!stats) return null;

  return (
    <div className="px-3 sm:px-5 pb-5 border-t border-slate-700/50 bg-slate-900/20 pt-4 animate-slideDown">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">
        Estatísticas
      </h4>

      {/* Legenda mandante × visitante */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-brand-green shrink-0" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider truncate">
            {match.homeTeam?.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0 justify-end">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider truncate">
            {match.awayTeam?.name}
          </span>
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="max-h-72 overflow-y-auto pr-2 custom-scrollbar">
          <MirroredBarChart rows={rows} />
        </div>
      ) : (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center py-2">
          Sem estatísticas registradas ainda
        </p>
      )}
    </div>
  );
};

export default LiveMatchStats;
