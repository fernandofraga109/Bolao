import React, { useState, useEffect } from "react";
import Leaderboard from "../Leaderboard";
import UserAuditModal from "../UserAuditModal";
import { User, Match, TournamentPredictions, Group, PredictionDB } from "../../types";
import { useDatabase } from "../../contexts/DatabaseContext";

interface LeaderboardSection {
  groupId: string;
  groupName: string;
  competitionCode?: string;
  users: any[];
}

interface LeaderboardPageProps {
  sections: LeaderboardSection[];
  allUsers: User[];
  matches: Match[];
  groups: Group[];
  tournamentResults: TournamentPredictions | null;
  currentUserId: string;
  rawPredictions: PredictionDB[];
}

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  sections,
  allUsers,
  matches,
  groups,
  tournamentResults,
  currentUserId,
  rawPredictions,
}) => {
  const [auditUser, setAuditUser] = useState<User | null>(null);
  const db = useDatabase();

  // Refetch points and predictions when the leaderboard page is visited
  // to ensure user doesn't see stale consolidated points.
  useEffect(() => {
    db.refetchUserGroups();
    db.refetchPredictions();
  }, []);

  // The sections are already filtered to a single group in App.tsx
  const viewingGroupId = sections[0]?.groupId || "";

  return (
    <>
      <Leaderboard sections={sections} onUserClick={(u) => setAuditUser(u as User)} />
      {auditUser && (
        <UserAuditModal
          user={auditUser}
          allUsers={allUsers}
          matches={matches}
          groups={groups}
          tournamentResults={tournamentResults}
          currentUserId={currentUserId}
          rawPredictions={rawPredictions}
          viewingGroupId={viewingGroupId}
          onClose={() => setAuditUser(null)}
        />
      )}
    </>
  );
};

export default LeaderboardPage;
