import React, { useEffect, useState } from "react";
import { Goal, RefreshCw } from "lucide-react";
import { PlayerWithContextDB } from "../../types";
import { useDatabase } from "../../contexts/DatabaseContext";
import ScorerRow from "./ScorerRow";

interface TopScoresPageProps {
  competitionCode: string;
}

const TopScoresPage: React.FC<TopScoresPageProps> = ({ competitionCode }) => {
  const db = useDatabase();
  const [scorers, setScorers] = useState<PlayerWithContextDB[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!competitionCode) return;

    setIsLoading(true);
    db.getTopScorers(competitionCode, 30)
      .then((rows) => {
        if (!cancelled) setScorers(rows);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `db.getTopScorers` is intentionally excluded: it is a fresh closure on every
    // DatabaseContext render (polling, realtime, etc.), so depending on it would
    // refetch + flicker on every context update. Refetching on competition change
    // is the correct trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionCode]);

  const lastUpdated = scorers[0]?.tournamentEntry?.lastUpdated;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-950 to-slate-900 rounded-2xl overflow-hidden border border-brand-green/20 shadow-xl">
        <div className="p-6 flex items-center gap-4">
          <div className="bg-brand-green/10 p-3 rounded-xl border border-brand-green/30 text-brand-green">
            <Goal size={28} />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
              Artilharia
            </h2>
            <p className="text-slate-400 text-xs md:text-sm">
              Ranking de goleadores da competição, atualizado a cada sincronização.
            </p>
          </div>
        </div>

        {/* Legenda das abreviações exibidas em cada linha */}
        <div className="px-6 pb-4 -mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="font-black text-brand-green">Gols</span>
            <span className="text-slate-500">— total de gols</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-slate-200">A</span>
            <span className="text-slate-500">— assistências</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-bold text-slate-200">P</span>
            <span className="text-slate-500">— pênaltis convertidos</span>
          </span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
          <RefreshCw size={28} className="animate-spin" />
          <p className="text-sm font-semibold">Carregando artilheiros…</p>
        </div>
      ) : scorers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6 gap-3">
          <div className="bg-slate-800 p-4 rounded-full border border-slate-700 text-slate-500">
            <Goal size={32} />
          </div>
          <p className="text-slate-300 font-bold">Nenhum gol ainda</p>
          <p className="text-slate-500 text-sm max-w-xs">
            A artilharia aparece assim que os jogos começarem e os dados forem
            sincronizados. Volte após o início da competição.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {scorers.map((scorer, index) => (
              <ScorerRow key={scorer.id} scorer={scorer} rank={index + 1} />
            ))}
          </div>

          {lastUpdated && (
            <p className="text-center text-[10px] uppercase tracking-widest text-slate-600 font-bold">
              Atualizado em {new Date(lastUpdated).toLocaleString("pt-BR")}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default TopScoresPage;
