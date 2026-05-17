import React from "react";
import { Match, User, TournamentPredictions } from "../../types";
import TopScorerCard from "../TopScorerCard";
import { ExtraPhasePredictionsCard } from "../ExtraPhasePredictionsCard";
import { GroupClassificationsCard } from "../GroupClassificationsCard";
import { KnockoutClassificationsCard } from "../KnockoutClassificationsCard";
import { Sparkles } from "lucide-react";

interface SpecialsPageProps {
  matches: Match[];
  currentUser: User;
  tournamentResults?: any;
  lockDate: string | null;
  onPredictTournament: (predictions: TournamentPredictions) => void;
  allowedChampionTeamIds: string[];
  ruleset?: "regulamento_1" | "regulamento_2";
}

const SpecialsPage: React.FC<SpecialsPageProps> = ({
  matches,
  currentUser,
  tournamentResults,
  lockDate,
  onPredictTournament,
  allowedChampionTeamIds,
  ruleset = "regulamento_1",
}) => {
  return (
    <div className="space-y-6">
      {/* Header Title */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-indigo-500/20 shadow-xl flex items-center gap-4">
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

      {ruleset === "regulamento_2" && (
        <>
          <GroupClassificationsCard
            matches={matches}
            prediction={currentUser.tournamentPredictions}
            lockDate={lockDate ? new Date(lockDate) : new Date(0)}
            onPredict={onPredictTournament}
          />
          <KnockoutClassificationsCard
            matches={matches}
            prediction={currentUser.tournamentPredictions}
            lockDate={lockDate ? new Date(lockDate) : new Date(0)}
            onPredict={onPredictTournament}
          />
        </>
      )}

      <TopScorerCard
        prediction={currentUser.tournamentPredictions}
        onPredict={onPredictTournament}
        lockDate={lockDate ? new Date(lockDate) : new Date(0)}
        finalResult={tournamentResults}
        allowedChampionTeamIds={allowedChampionTeamIds}
        ruleset={ruleset}
      />

      {currentUser.activeGroupId && (
        <ExtraPhasePredictionsCard
          groupId={currentUser.activeGroupId}
          userId={currentUser.id}
          matches={matches}
          lockDate={lockDate ? new Date(lockDate) : new Date(0)}
        />
      )}
    </div>
  );
};

export default SpecialsPage;
