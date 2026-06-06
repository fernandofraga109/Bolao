import React, { useState } from "react";
import { Match, MatchDB, User, TournamentPredictions } from "../../types";
import TopScorerCard from "../TopScorerCard";
import { ExtraPhasePredictionsCard } from "../ExtraPhasePredictionsCard";
import { GroupClassificationsCard } from "../GroupClassificationsCard";
import { KnockoutClassificationsCard } from "../KnockoutClassificationsCard";
import { Sparkles, Info, ChevronDown, ChevronUp } from "lucide-react";

interface SpecialsPageProps {
  matches: Match[];
  currentUser: User;
  tournamentResults?: any;
  lockDate: string | null;
  onPredictTournament: (predictions: TournamentPredictions) => void;
  allowedChampionTeamIds: string[];
  ruleset?: "regulamento_1" | "regulamento_2";
  competitionCode?: string;
}

const SpecialsPage: React.FC<SpecialsPageProps> = ({
  matches,
  currentUser,
  tournamentResults,
  lockDate,
  onPredictTournament,
  allowedChampionTeamIds,
  ruleset = "regulamento_1",
  competitionCode,
}) => {
  const [showSpecialsRules, setShowSpecialsRules] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl overflow-hidden border border-indigo-500/20 shadow-xl">
        <div className="p-6 flex items-center gap-4">
          <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/30 text-indigo-400">
            <Sparkles size={28} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">
              Palpites Especiais
            </h2>
            <p className="text-slate-400 text-xs md:text-sm">
              Configure suas apostas de longo prazo e bônus por fase antes do prazo expirar!
            </p>
          </div>
        </div>

        {/* Rules accordion for Especiais */}
        <div className="border-t border-indigo-500/20">
          <button
            onClick={() => setShowSpecialsRules(!showSpecialsRules)}
            className="w-full px-6 py-2.5 flex items-center justify-between text-indigo-300 hover:bg-indigo-500/10 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Info size={14} />
              <span>Regras de Pontuação - Especiais</span>
            </div>
            {showSpecialsRules ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showSpecialsRules && (
            <div className="px-6 pb-4 text-xs text-indigo-200/80 space-y-3">
              {ruleset === "regulamento_2" ? (
                <>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Campeão (Palpite pré-Copa)</h4>
                    <p>Acerto isolado: <b>100pts</b> · 2 acertam: <b>70pts</b> · 3 acertam: <b>50pts</b> · 4+: <b>40pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Artilheiro (Palpite pré-Copa)</h4>
                    <p>Acerto isolado: <b>60pts</b> · 2 acertam: <b>40pts</b> · 3 acertam: <b>30pts</b> · 4+: <b>25pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Classificados dos Grupos (Pré-Copa)</h4>
                    <p>Cada classificado correto (1º e 2º): <b>10pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Classificados 2ª Fase (Oitavas, Quartas, Semi)</h4>
                    <p>Cada classificado correto: <b>5pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Seleção Maior Goleadora em Jogo Único (Pré-Copa)</h4>
                    <p>Acertar a seleção: <b>20pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Seleção Maior Goleada em Jogo Único (Pré-Copa)</h4>
                    <p>Acertar a seleção: <b>20pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Maior Diferença de Gols por Fase (Pré-Fase)</h4>
                    <p>Acertar o jogo com maior diferença: <b>20pts</b> por fase</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Seleção Campeã</h4>
                    <p>Acertar o campeão: <b>100pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Artilheiro (Nome)</h4>
                    <p>Acertar o artilheiro: <b>100pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Artilheiro (Gols)</h4>
                    <p>Acertar o número de gols: <b>100pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Melhor Jogador</h4>
                    <p>Acertar o melhor jogador: <b>100pts</b></p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-indigo-300 text-[11px] uppercase tracking-wide">Melhor Goleiro</h4>
                    <p>Acertar o melhor goleiro: <b>100pts</b></p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <TopScorerCard
        prediction={currentUser.tournamentPredictions}
        onPredict={onPredictTournament}
        lockDate={lockDate ? new Date(lockDate) : new Date(0)}
        finalResult={tournamentResults}
        allowedChampionTeamIds={allowedChampionTeamIds}
        ruleset={ruleset}
        currentUserId={currentUser.id}
        currentGroupId={currentUser.activeGroupId}
        defaultExpanded={ruleset === "regulamento_1"}
        competitionCode={competitionCode}
      />

      {ruleset === "regulamento_2" && (
        <>
          <GroupClassificationsCard
            matches={matches}
            prediction={currentUser.tournamentPredictions}
            lockDate={lockDate ? new Date(lockDate) : new Date(0)}
            onPredict={onPredictTournament}
            currentUserId={currentUser.id}
            currentGroupId={currentUser.activeGroupId}
          />
          <KnockoutClassificationsCard
            matches={matches}
            prediction={currentUser.tournamentPredictions}
            lockDate={lockDate ? new Date(lockDate) : new Date(0)}
            onPredict={onPredictTournament}
            currentUserId={currentUser.id}
            currentGroupId={currentUser.activeGroupId}
          />
        </>
      )}

      {currentUser.activeGroupId && ruleset === "regulamento_2" && (
        <ExtraPhasePredictionsCard
          groupId={currentUser.activeGroupId}
          userId={currentUser.id}
          matches={matches.map((m) => ({
            ...m,
            homeTeamId: m.homeTeam?.id ?? "",
            awayTeamId: m.awayTeam?.id ?? "",
            resultHome: m.result?.home,
            resultAway: m.result?.away,
          })) as unknown as MatchDB[]}
          lockDate={lockDate ? new Date(lockDate) : new Date(0)}
        />
      )}
    </div>
  );
};

export default SpecialsPage;
