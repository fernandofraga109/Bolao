import { useMemo } from "react";
import { User, Match, MatchStatus, TournamentPredictions, Group } from "../types";
import { calculateTournamentPoints, calculateTournamentPointsRegulamento2, getScoreCategoryRegulamento1, getScoreCategoryRegulamento2, getMatchPhase, getR1MatchScoringResult } from "../utils/scoring";
import { DEFAULT_COMPETITION_CODE } from "../data/competitions";
import { normalizeCompetitionCode, isMatchLive, isMatchFinished, resolveShootoutWinnerId } from "../utils/matchUtils";
import { calculateMatchPoints } from "../utils/pointsUtils";

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
    const activeCompCode = normalizeCompetitionCode(activeGroup?.competitionCode);
    const activeMinRankDiff = activeGroup?.underdog_min_rank_diff ?? 0;

    // Only matches belonging to this group's competition
    const groupMatches = matches.filter(
      (m) => normalizeCompetitionCode(m.competitionCode) === activeCompCode
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
          if ((isMatchFinished(match.status) || isMatchLive(match.status)) && match.result && pred) {
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

              total += calculateMatchPoints({
                pred: { homeScore: pred.home, awayScore: pred.away },
                match,
                ruleset: "regulamento_2",
                groupMatchPredictions: matchPredictions,
                userId: user.id,
              });
            } else {
              const realWhoClassifiesId = resolveShootoutWinnerId(match.score, match.homeTeam?.id, match.awayTeam?.id);
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

              total += calculateMatchPoints({
                pred: { homeScore: pred.home, awayScore: pred.away, tieWinnerTeamId: predWhoClassifiesId },
                match,
                ruleset: "regulamento_1",
                minRankDiff: activeMinRankDiff,
              });
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
        normalizeCompetitionCode(group.competitionCode || DEFAULT_COMPETITION_CODE),
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
