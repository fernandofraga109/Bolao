import React from "react";
import TournamentStandings from "../TournamentStandings";
import { Match } from "../../types";

interface TournamentPageProps {
  matches: Match[];
  userHasGroup: boolean;
  competitionCode: string;
  canPersistToDatabase: boolean;
}

const TournamentPage: React.FC<TournamentPageProps> = ({
  matches,
  userHasGroup,
  competitionCode,
  canPersistToDatabase,
}) => {
  if (!userHasGroup) {
    return (
      <div className="text-center py-8 border border-slate-700 rounded-xl bg-slate-800/50 border-dashed">
        <p className="text-slate-300 text-sm">
          Entre em um grupo para ver a tabela.
        </p>
      </div>
    );
  }

  return (
    <TournamentStandings
      matches={matches}
      competitionCode={competitionCode}
      canPersistToDatabase={canPersistToDatabase}
    />
  );
};

export default TournamentPage;
