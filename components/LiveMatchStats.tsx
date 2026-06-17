import React, { useMemo } from "react";
import { Match, LiveTeamStat } from "../types";

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

// Extrai um número de valores como 12, "55%", "1.8" — para dimensionar a barra.
const toNumber = (v: number | string | null): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};

// Formata o valor para exibição (preserva "%", troca null por "0").
const formatValue = (v: number | string | null): string => {
  if (v == null) return "0";
  return String(v);
};

const StatRow: React.FC<{
  label: string;
  home: number | string | null;
  away: number | string | null;
}> = ({ label, home, away }) => {
  const h = toNumber(home);
  const a = toNumber(away);
  const total = h + a;
  const homePct = total > 0 ? (h / total) * 100 : 50;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-black text-slate-200 tabular-nums w-12 text-left">
          {formatValue(home)}
        </span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center flex-1 px-1">
          {label}
        </span>
        <span className="font-black text-slate-200 tabular-nums w-12 text-right">
          {formatValue(away)}
        </span>
      </div>
      <div className="flex items-center gap-1 h-1.5">
        <div className="flex-1 flex justify-end">
          <div
            className="h-full rounded-full bg-brand-green transition-all"
            style={{ width: `${homePct}%` }}
          />
        </div>
        <div className="flex-1 flex justify-start">
          <div
            className="h-full rounded-full bg-sky-400 transition-all"
            style={{ width: `${100 - homePct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Painel de estatísticas da partida (api-sports `fixtures/statistics`).
 * Barras comparativas mandante (verde, esquerda) × visitante (azul, direita).
 *
 * Dados puramente informativos — NÃO entram em nenhum cálculo de pontos.
 */
export const LiveMatchStats: React.FC<LiveMatchStatsProps> = ({ match }) => {
  const stats = match.liveStats;

  const rows = useMemo(() => {
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
      type,
      label: translateStat(type),
      home: byTypeHome.get(type) ?? null,
      away: byTypeAway.get(type) ?? null,
    }));
  }, [stats]);

  if (!stats) return null;

  return (
    <div className="px-3 sm:px-5 pb-5 border-t border-slate-700/50 bg-slate-900/20 pt-4 animate-slideDown">
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
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
          {rows.map((r) => (
            <StatRow key={r.type} label={r.label} home={r.home} away={r.away} />
          ))}
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
