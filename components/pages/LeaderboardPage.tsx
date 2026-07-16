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
  lockDate: string | null;
}

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  sections,
  allUsers,
  matches,
  groups,
  tournamentResults,
  currentUserId,
  rawPredictions,
  lockDate,
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
  const activeGroup = groups.find((g) => g.id === viewingGroupId);
  const ruleset = activeGroup?.ruleset || "regulamento_1";

  return (
    <>
      <Leaderboard
        sections={sections}
        ruleset={ruleset}
        onUserClick={(u) => setAuditUser(u as User)}
      />
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
          lockDate={lockDate}
          onClose={() => setAuditUser(null)}
        />
      )}
    </>
  );
};

export default LeaderboardPage;
