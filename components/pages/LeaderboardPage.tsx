import React from "react";
import Leaderboard from "../Leaderboard";

interface LeaderboardSection {
  groupId: string;
  groupName: string;
  competitionCode?: string;
  users: any[];
}

interface LeaderboardPageProps {
  sections: LeaderboardSection[];
}

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ sections }) => {
  return <Leaderboard sections={sections} />;
};

export default LeaderboardPage;
