import React from "react";
import TournamentStandings from "../TournamentStandings";
import { Match } from "../../types";

interface TournamentPageProps {
  matches: Match[];
  competitionCode: string;
  canPersistToDatabase: boolean;
}

const TournamentPage: React.FC<TournamentPageProps> = ({
  matches,
  competitionCode,
  canPersistToDatabase,
}) => {
  return (
    <TournamentStandings
      matches={matches}
      competitionCode={competitionCode}
      canPersistToDatabase={canPersistToDatabase}
    />
  );
};

export default TournamentPage;
