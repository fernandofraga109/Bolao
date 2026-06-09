import { useMemo } from "react";
import { User, Match, MatchStatus, TournamentPredictions, Group } from "../types";
import { calculatePoints, calculateTournamentPoints, calculatePointsRegulamento2, getMatchPhase, calculateTournamentPointsRegulamento2, getScoreCategoryRegulamento1, getScoreCategoryRegulamento2, getR1MatchScoringResult } from "../utils/scoring";
import { DEFAULT_COMPETITION_CODE } from "../data/competitions";

interface UserGroupDB {
  userId: string;
  groupId: string;
  points?: number;
}

interface PredictionDB {
  userId: string;
  groupId: string;
  matchId: string;
}

export const useLeaderboard = (
  users: User[],
  matches: Match[],
  currentUser: User | null,
  tournamentResults: TournamentPredictions | null,
  db: {
    userGroups: UserGroupDB[];
    predictions: PredictionDB[];
  },
  groups: Group[]
) => {
  // --- Calculations (Leaderboard) ---
  const usersWithCalculatedPoints = useMemo(() => {
    // Use viewer's active group to scope the leaderboard
    const activeGroupId =
      currentUser?.activeGroupId || (currentUser?.groupIds && currentUser?.groupIds[0]);
    const activeGroup = groups.find((g) => g.id === activeGroupId);
    const activeRuleset = activeGroup?.ruleset || "regulamento_1";
    const activeCompCode = (activeGroup?.competitionCode || "WC").toUpperCase();
    const activeMinRankDiff = activeGroup?.underdog_min_rank_diff ?? 0;

    // Only matches belonging to this group's competition
    const groupMatches = matches.filter(
      (m) => (m.competitionCode || "WC").toUpperCase() === activeCompCode
    );

    const allGroupPredictions = users
      .filter((u) => u.groupIds.includes(activeGroupId || ""))
      .map((u) => ({
        userId: u.id,
        championTeamId: u.tournamentPredictions?.championTeamId,
        topScorerPlayer: u.tournamentPredictions?.topScorer?.player,
      }));

    return users
      .filter((user) => user.role !== "ADMIN")
      .map((user) => {
        let total = 0;
        const breakdown = {
          exactCount: 0,
          diffCount: 0,
          outcomeCount: 0,
          wrongCount: 0,
          underdogBonusCount: 0,
          underdogBonusTotal: 0,
          aloneBonusCount: 0,
          aloneBonusTotal: 0,
        };
        groupMatches.forEach((match) => {
          const pred = user.predictions[match.id];
          const isLive = match.status === MatchStatus.LIVE ||
                         match.status === MatchStatus.IN_PLAY ||
                         match.status === MatchStatus.PAUSED;
          const isFinished = match.status === MatchStatus.FINISHED;

          if ((isFinished || isLive) && match.result && pred) {
            if (activeRuleset === "regulamento_2") {
              const matchPredictions = users
                .filter((u) => u.groupIds.includes(activeGroupId || "") && u.predictions && u.predictions[match.id])
                .map((u) => ({
                  userId: u.id,
                  homeScore: u.predictions[match.id].home,
                  awayScore: u.predictions[match.id].away,
                }));

              const cat = getScoreCategoryRegulamento2(
                pred.home,
                pred.away,
                match.result.home,
                match.result.away,
                getMatchPhase(match.stage, match.group),
                matchPredictions,
                user.id
              );

              if (cat.type === "exact") breakdown.exactCount++;
              else if (cat.type === "diff") breakdown.diffCount++;
              else if (cat.type === "outcome") breakdown.outcomeCount++;
              else breakdown.wrongCount++;

              if (cat.aloneBonus) {
                breakdown.aloneBonusCount++;
                breakdown.aloneBonusTotal += 5;
              }

              total += calculatePointsRegulamento2(
                pred.home,
                pred.away,
                match.result.home,
                match.result.away,
                getMatchPhase(match.stage, match.group),
                matchPredictions,
                user.id
              );
            } else {
              const isShootout = match.score?.duration === "PENALTY_SHOOTOUT";
              const realWhoClassifiesId = isShootout
                ? (match.score?.winner === "HOME_TEAM" ? match.homeTeam?.id : match.awayTeam?.id)
                : undefined;
              const predWhoClassifiesId = pred.whoClassifiesTeamId;
              const r1Result = getR1MatchScoringResult(
                match.score,
                match.result.home,
                match.result.away
              );

              const cat = getScoreCategoryRegulamento1(
                pred.home,
                pred.away,
                r1Result.home,
                r1Result.away,
                match.homeTeam.ranking,
                match.awayTeam.ranking,
                activeMinRankDiff,
                predWhoClassifiesId,
                realWhoClassifiesId,
              );

              if (cat.type === "exact") breakdown.exactCount++;
              else if (cat.type === "diff") breakdown.diffCount++;
              else if (cat.type === "outcome") breakdown.outcomeCount++;
              else breakdown.wrongCount++;

              if (cat.underdogBonus > 0) {
                breakdown.underdogBonusCount++;
                breakdown.underdogBonusTotal += cat.underdogBonus;
              }

              total += calculatePoints(
                pred.home,
                pred.away,
                r1Result.home,
                r1Result.away,
                match.homeTeam.ranking,
                match.awayTeam.ranking,
                activeMinRankDiff,
                predWhoClassifiesId,
                realWhoClassifiesId,
              );
            }
          }
        });

        if (tournamentResults) {
          if (activeRuleset === "regulamento_2") {
            total += calculateTournamentPointsRegulamento2(
              user.tournamentPredictions,
              tournamentResults,
              allGroupPredictions,
              user.id
            );
          } else {
            total += calculateTournamentPoints(
              user.tournamentPredictions,
              tournamentResults,
            );
          }
        }

        return { ...user, totalPoints: total, scoreBreakdown: breakdown };
      });
  }, [matches, users, tournamentResults, currentUser, groups, db.userGroups]);

  const leaderboardData = useMemo(() => {
    if (!currentUser) return [];

    const activeGroupId =
      currentUser.activeGroupId || (currentUser.groupIds && currentUser.groupIds[0]) || undefined;
    if (!activeGroupId) return [];

    return usersWithCalculatedPoints.filter((u) =>
      u.groupIds.includes(activeGroupId),
    );
  }, [currentUser, usersWithCalculatedPoints]);

  const leaderboardSections = useMemo(() => {
    if (!currentUser) return [];

    const groupNameMap = new Map<string, string>();
    const groupCompetitionMap = new Map<string, string>();
    groups.forEach((group) => {
      groupNameMap.set(group.id, group.name);
      groupCompetitionMap.set(
        group.id,
        (group.competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase(),
      );
    });

    return (currentUser.groupIds || [])
      .map((groupId) => {
        const groupUsers = usersWithCalculatedPoints
          .filter((u) => u.groupIds.includes(groupId))
          .map((user) => {
            return {
              ...user,
              predictionsCount: db.predictions.filter(
                (p) => p.userId === user.id && p.groupId === groupId,
              ).length,
            };
          });

        const fallbackGroupName =
          (currentUser.groupIds && currentUser.groupIds.length === 1)
            ? "Meu Grupo"
            : `Grupo ${(currentUser.groupIds && currentUser.groupIds.indexOf(groupId) + 1) || ""}`;

        return {
          groupId,
          groupName: groupNameMap.get(groupId) || fallbackGroupName,
          competitionCode:
            groupCompetitionMap.get(groupId) || DEFAULT_COMPETITION_CODE,
          users: groupUsers,
        };
      })
      .filter((section) => section.users.length > 0);
  }, [
    currentUser,
    usersWithCalculatedPoints,
    db.userGroups,
    groups,
    db.predictions,
  ]);

  return {
    usersWithCalculatedPoints,
    leaderboardData,
    leaderboardSections,
  };
};
