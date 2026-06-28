import React, { useMemo, useState, useEffect } from "react";
import { X, Star, CheckCircle2, XCircle, Minus, ChevronDown, ChevronUp, Info } from "lucide-react";
import ScoringGuide from "./ui/ScoringGuide";
import { User, Match, MatchStatus, TournamentPredictions, Group, PredictionDB } from "../types";
import { useDatabase } from "../contexts/DatabaseContext";
import {
  calculatePoints,
  calculatePointsRegulamento2,
  getScoreCategoryRegulamento1,
  getScoreCategoryRegulamento2,
  getMatchPhase,
  POINTS_CHAMPION,
  POINTS_TOP_SCORER_NAME,
  POINTS_TOP_SCORER_GOALS,
  POINTS_BEST_PLAYER,
  POINTS_BEST_GOALKEEPER,
  POINTS_CLASSIFIES_BONUS,
  getR1MatchScoringResult,
  getKnockoutAdvancingTeamId,
  getMatchDuration,
  calculateUnderdogBonus,
  calculateExtraPhasePoints,
  getExtraPhaseKey,
  isTournamentFinalFinished,
} from "../utils/scoring";
import { translateGroupName } from "../utils/translations";
import AvatarWithFallback from "./ui/AvatarWithFallback";

interface UserAuditModalProps {
  user: User;
  allUsers: User[];
  matches: Match[];
  groups: Group[];
  tournamentResults: TournamentPredictions | null;
  currentUserId: string;
  rawPredictions: PredictionDB[];
  viewingGroupId: string;
  lockDate: string | null;
  onClose: () => void;
}

type AuditTab = "jogos" | "especiais";

interface MatchAuditRow {
  match: Match;
  pred: { home: number; away: number; points?: number; whoClassifiesTeamId?: string };
  pts: number;
  pointsSource: "db" | "calc";
  isExact: boolean;
  isOutcomeCorrect: boolean;
  isDiffCorrect: boolean;
  resultLabel: string;
  classifiesBonus: number;
  zebraBonus: number;
  aloneBonus: boolean;
}

const UserAuditModal: React.FC<UserAuditModalProps> = ({
  user,
  allUsers,
  matches,
  groups,
  tournamentResults,
  currentUserId,
  rawPredictions,
  viewingGroupId,
  lockDate,
  onClose,
}) => {
  const [auditTab, setAuditTab] = useState<AuditTab>("jogos");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const db = useDatabase();

  // Refetch fresh data when modal opens to avoid stale results
  useEffect(() => {
    db.refetchMatches();
    db.refetchPredictions();
    db.refetchUserGroups();
  }, []);

  // Use the group the viewer is looking at (from the leaderboard section), not user.activeGroupId
  const activeGroupId = viewingGroupId || user.activeGroupId || user.groupIds?.[0];
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const ruleset = activeGroup?.ruleset || "regulamento_1";
  const activeCompCode = (activeGroup?.competitionCode || "WC").toUpperCase();
  const minRankDiff = activeGroup?.underdog_min_rank_diff ?? 0;

  const auditMatches = useMemo(() => {
    return db.matches
      .map((m) => {
        const homeTeam = db.teams.find((t) => t.id === m.homeTeamId);
        const awayTeam = db.teams.find((t) => t.id === m.awayTeamId);
        if (!homeTeam || !awayTeam) return null;

        return {
          ...m,
          homeTeam,
          awayTeam,
          status: m.status as MatchStatus,
          result: m.resultHome != null ? { home: m.resultHome, away: m.resultAway! } : undefined,
        } as Match;
      })
      .filter((m): m is Match => m !== null);
  }, [db.matches, db.teams]);

  const canonicalMatchById = useMemo(() => {
    const bySignature = new Map<string, Match>();
    const makeSignature = (match: Match) =>
      [
        (match.competitionCode || "WC").toUpperCase(),
        match.homeTeam.id,
        match.awayTeam.id,
        match.matchday ?? "",
        new Date(match.date).toISOString().slice(0, 10),
      ].join("|");

    auditMatches.forEach((match) => {
      const signature = makeSignature(match);
      const existing = bySignature.get(signature);
      const shouldReplace =
        !existing ||
        (!existing.externalMatchId && !!match.externalMatchId) ||
        (existing.status !== MatchStatus.FINISHED && match.status === MatchStatus.FINISHED);

      if (shouldReplace) {
        bySignature.set(signature, match);
      }
    });

    const byId = new Map<string, Match>();
    auditMatches.forEach((match) => {
      byId.set(match.id, bySignature.get(makeSignature(match)) || match);
    });
    return byId;
  }, [auditMatches]);

  const matchAudit = useMemo((): MatchAuditRow[] => {
    const rows: MatchAuditRow[] = [];

    Object.entries(user.predictions).forEach(([matchId, pred]) => {
      const match = canonicalMatchById.get(matchId);
      if (
        !match ||
        (match.status !== MatchStatus.FINISHED && match.status !== MatchStatus.LIVE) ||
        !match.result ||
        (match.competitionCode || "WC").toUpperCase() !== activeCompCode
      ) {
        return;
      }

      let pts = 0;
      let pointsSource: "db" | "calc" = "calc";

      if (ruleset === "regulamento_2") {
        const matchPredictions = allUsers
          .filter((u) => u.groupIds.includes(activeGroupId || "") && u.predictions && u.predictions[matchId])
          .map((u) => ({
            userId: u.id,
            homeScore: u.predictions[matchId].home,
            awayScore: u.predictions[matchId].away,
          }));
        pts = calculatePointsRegulamento2(
          pred.home,
          pred.away,
          match.result!.home,
          match.result!.away,
          getMatchPhase(match.stage, match.group),
          matchPredictions,
          user.id
        );
      } else {
        const realWhoClassifiesId = getKnockoutAdvancingTeamId(match);
        const predWhoClassifiesId = pred.whoClassifiesTeamId;
        const r1Result = getR1MatchScoringResult(
          match,
          match.result!.home,
          match.result!.away
        );

        pts = calculatePoints(
          pred.home,
          pred.away,
          r1Result.home,
          r1Result.away,
          match.homeTeam.ranking,
          match.awayTeam.ranking,
          minRankDiff,
          predWhoClassifiesId,
          realWhoClassifiesId
        );
      }

      if (typeof pred.points === "number" && pred.points === pts) {
        pointsSource = "db";
      }

      // Derive display category from the same scoring functions used for pts,
      // so label/color always matches the calculated points.
      let isExact = false;
      let isDiffCorrect = false;
      let isOutcomeCorrect = false;

      if (ruleset === "regulamento_2") {
        const phase = getMatchPhase(match.stage, match.group);
        const matchPredsForCat = allUsers
          .filter((u) => u.groupIds.includes(activeGroupId || "") && u.predictions && u.predictions[matchId])
          .map((u) => ({
            userId: u.id,
            homeScore: u.predictions[matchId].home,
            awayScore: u.predictions[matchId].away,
          }));
        const r2Cat = getScoreCategoryRegulamento2(
          pred.home, pred.away,
          match.result!.home, match.result!.away,
          phase, matchPredsForCat, user.id
        );
        isExact = r2Cat.type === "exact";
        isDiffCorrect = r2Cat.type === "diff";
        isOutcomeCorrect = r2Cat.type !== "wrong";
      } else {
        const auditScore = getR1MatchScoringResult(match, match.result!.home, match.result!.away);
        const realWhoClassifiesIdForCat = getKnockoutAdvancingTeamId(match);
        const r1Cat = getScoreCategoryRegulamento1(
          pred.home, pred.away,
          auditScore.home, auditScore.away,
          match.homeTeam.ranking, match.awayTeam.ranking,
          minRankDiff,
          pred.whoClassifiesTeamId, realWhoClassifiesIdForCat
        );
        isExact = r1Cat.type === "exact";
        isDiffCorrect = r1Cat.type === "diff";
        isOutcomeCorrect = r1Cat.type !== "wrong";
      }

      let resultLabel = "";
      let aloneBonus = false;
      
      if (pts === 0) resultLabel = "Errou";
      else if (isExact) {
        // Verificar se ganhou bônus de acertar sozinho no Regulamento 2
        if (ruleset === "regulamento_2") {
          const matchPredsForBonus = allUsers
            .filter((u) => u.groupIds.includes(activeGroupId || "") && u.predictions && u.predictions[matchId])
            .map((u) => ({
              userId: u.id,
              homeScore: u.predictions[matchId].home,
              awayScore: u.predictions[matchId].away,
            }));
          const exactHits = matchPredsForBonus.filter(
            (p) => p.homeScore === match.result!.home && p.awayScore === match.result!.away
          );
          aloneBonus = exactHits.length === 1 && exactHits[0].userId === user.id;
        }
        resultLabel = aloneBonus ? "Placar exato (só você)" : "Placar exato";
      }
      else if (isOutcomeCorrect && isDiffCorrect) resultLabel = "Diferença certa";
      else if (isOutcomeCorrect) resultLabel = "Resultado certo";

      const realWhoClassifiesIdDisplay = getKnockoutAdvancingTeamId(match);
      const classifiesBonus =
        ruleset !== "regulamento_2" &&
        pred.home === pred.away &&
        !!pred.whoClassifiesTeamId &&
        !!realWhoClassifiesIdDisplay &&
        pred.whoClassifiesTeamId === realWhoClassifiesIdDisplay
          ? POINTS_CLASSIFIES_BONUS
          : 0;

      // Bônus zebra (só R1): recalculado a partir do placar do tempo regular +
      // rankings, igual ao MatchCard. Só conta quando pontuou e não foi empate real.
      let zebraBonus = 0;
      if (ruleset !== "regulamento_2" && pts > 0) {
        const s = getR1MatchScoringResult(match, match.result!.home, match.result!.away);
        if (s.home !== s.away) {
          const winnerRank = s.home > s.away ? match.homeTeam.ranking : match.awayTeam.ranking;
          const loserRank = s.home > s.away ? match.awayTeam.ranking : match.homeTeam.ranking;
          zebraBonus = calculateUnderdogBonus(winnerRank, loserRank, minRankDiff);
        }
      }

      rows.push({
        match,
        pred,
        pts,
        pointsSource,
        isExact,
        isOutcomeCorrect,
        isDiffCorrect,
        resultLabel,
        classifiesBonus,
        zebraBonus,
        aloneBonus,
      });
    });

    rows.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
    return rows;
  }, [canonicalMatchById, user.predictions, allUsers, ruleset, activeCompCode, minRankDiff, activeGroupId, user.id]);

  const matchTotal = useMemo(
    () => matchAudit.reduce((sum, row) => sum + row.pts, 0),
    [matchAudit]
  );

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    db.teams.forEach((team) => {
      map.set(team.id, team.name);
      if (team.code) map.set(team.code, team.name);
      if (team.externalTeamId) map.set(String(team.externalTeamId), team.name);
    });
    return map;
  }, [db.teams]);

  const formatTeamName = (teamId?: string) => {
    if (!teamId) return "–";
    return teamNameById.get(teamId) || teamId;
  };

  const formatTeamList = (teamIds: string[]) =>
    teamIds.map((teamId) => formatTeamName(teamId)).join(", ");

  const formatTopScorerNames = (playerIds?: string[] | null) => {
    if (!playerIds || playerIds.length === 0) return undefined;
    const names = playerIds
      .map((id) => db.players.find((p) => p.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : undefined;
  };

  const phaseStarted = (phaseName: string) => {
    const now = Date.now();
    const normalized = phaseName.toLowerCase();

    const phaseMatches = auditMatches.filter((match) => {
      const stage = (match.stage || "").toUpperCase();
      const group = (match.group || "").toUpperCase();

      if (normalized === "dezesseisavos" || normalized === "round_of_32" || normalized === "16avos" || normalized === "16_avos") {
        return stage.includes("ROUND_OF_32") || stage.includes("LAST_32") || group.includes("16_AVOS") || group.includes("16AVOS");
      }
      if (normalized === "oitavas" || normalized === "round_of_16" || normalized === "last_16") {
        return stage.includes("ROUND_OF_16") || stage.includes("LAST_16") || group.includes("OITAVAS");
      }
      if (normalized === "quartas") {
        return stage.includes("QUARTER") || group.includes("QUARTAS");
      }
      if (normalized === "semis") {
        return stage.includes("SEMI") || group.includes("SEMI");
      }
      return (
        stage.includes("REGULAR") ||
        stage.includes("GROUP") ||
        group.includes("GRUPO")
      );
    });

    if (phaseMatches.length === 0) return false;
    return Math.min(...phaseMatches.map((match) => new Date(match.date).getTime())) <= now;
  };

  // Special predictions should only be visible after lock date (same rule as OtherUsersPredictions)
  const isLocked = lockDate ? new Date() >= new Date(lockDate) : false;
  const isPreCupSpecialVisible = isLocked;

  // Reset to jogos tab if specials tab is active but competition hasn't started
  useEffect(() => {
    if (auditTab === "especiais" && !isPreCupSpecialVisible) {
      setAuditTab("jogos");
    }
  }, [auditTab, isPreCupSpecialVisible]);

  const tournamentAudit = useMemo(() => {
    // Extra phase predictions (R2) are scored from match results alone, so they may
    // exist before any tournamentResults are set. Don't bail out if those exist.
    const hasExtraPhasePreds =
      ruleset === "regulamento_2" &&
      (db.extraPhasePredictions || []).some(
        (ep) => ep.userId === user.id && ep.groupId === activeGroupId
      );
    if ((!tournamentResults || !user.tournamentPredictions) && !hasExtraPhasePreds) return null;

    const pred = user.tournamentPredictions || ({} as TournamentPredictions);
    const actual = tournamentResults || ({} as TournamentPredictions);
    const items: { label: string; predicted: string; actual: string; pts: number }[] = [];

    if (ruleset === "regulamento_2") {
      const allGroupPredictions = allUsers
        .filter((u) => u.groupIds.includes(activeGroupId || ""))
        .map((u) => ({
          userId: u.id,
          championTeamId: u.tournamentPredictions?.championTeamId,
          topScorerPlayer: u.tournamentPredictions?.topScorer?.player,
          topScorerPlayerId: u.tournamentPredictions?.topScorerPlayerId,
        }));

      // Champion
      if (isPreCupSpecialVisible && pred.championTeamId) {
        let pts = 0;
        if (actual.championTeamId && pred.championTeamId === actual.championTeamId) {
          const count = allGroupPredictions.filter(
            (p) => p.championTeamId === actual.championTeamId
          ).length;
          pts = count === 1 ? 100 : count === 2 ? 70 : count === 3 ? 50 : 40;
        }
        items.push({
          label: "Campeão",
          predicted: formatTeamName(pred.championTeamId),
          actual: formatTeamName(actual.championTeamId),
          pts,
        });
      }

      // Top scorer
      if (isPreCupSpecialVisible && pred.topScorer?.player) {
        let pts = 0;
        let isCorrect = false;
        let count = 0;

        if (actual.topScorerPlayerIds && actual.topScorerPlayerIds.length > 0) {
          if (pred.topScorerPlayerId && actual.topScorerPlayerIds.includes(pred.topScorerPlayerId)) {
            isCorrect = true;
            count = allGroupPredictions.filter(
              (p) => p.topScorerPlayerId && actual.topScorerPlayerIds!.includes(p.topScorerPlayerId)
            ).length;
          }
        } else if (actual.topScorer?.player) {
          const predPlayer = pred.topScorer.player.trim().toLowerCase();
          const actualPlayer = actual.topScorer.player.trim().toLowerCase();
          if (predPlayer === actualPlayer) {
            isCorrect = true;
            count = allGroupPredictions.filter(
              (p) => {
                if (p.topScorerPlayerId && pred.topScorerPlayerId)
                  return p.topScorerPlayerId === pred.topScorerPlayerId;
                return p.topScorerPlayer && p.topScorerPlayer.trim().toLowerCase() === actualPlayer;
              }
            ).length;
          }
        }

        if (isCorrect) {
          pts = count === 1 ? 60 : count === 2 ? 40 : count === 3 ? 30 : 25;
        }

        items.push({
          label: "Artilheiro",
          predicted: pred.topScorer.player,
          actual: formatTopScorerNames(actual.topScorerPlayerIds) || actual.topScorer?.player || "–",
          pts,
        });
      }

      // Most goals team
      if (isPreCupSpecialVisible && pred.mostGoalsTeamId) {
        const officialMostGoalsIds =
          actual.mostGoalsTeamIds && actual.mostGoalsTeamIds.length > 0
            ? actual.mostGoalsTeamIds
            : actual.mostGoalsTeamId
              ? [actual.mostGoalsTeamId]
              : [];
        const pts = officialMostGoalsIds.includes(pred.mostGoalsTeamId) ? 20 : 0;
        items.push({
          label: "Seleção com mais gols num jogo",
          predicted: formatTeamName(pred.mostGoalsTeamId),
          actual:
            officialMostGoalsIds.length > 0
              ? formatTeamList(officialMostGoalsIds)
              : formatTeamName(actual.mostGoalsTeamId),
          pts,
        });
      }

      // Most conceded team
      if (isPreCupSpecialVisible && pred.mostConcededTeamId) {
        const officialMostConcededIds =
          actual.mostConcededTeamIds && actual.mostConcededTeamIds.length > 0
            ? actual.mostConcededTeamIds
            : actual.mostConcededTeamId
              ? [actual.mostConcededTeamId]
              : [];
        const pts = officialMostConcededIds.includes(pred.mostConcededTeamId) ? 20 : 0;
        items.push({
          label: "Seleção que tomou mais gols num jogo",
          predicted: formatTeamName(pred.mostConcededTeamId),
          actual:
            officialMostConcededIds.length > 0
              ? formatTeamList(officialMostConcededIds)
              : formatTeamName(actual.mostConcededTeamId),
          pts,
        });
      }

      // Group classifications
      if (pred.groupClassifications && actual.groupClassifications) {
        Object.entries(pred.groupClassifications).forEach(([groupName, predTeams]) => {
          if (!phaseStarted(groupName)) return;
          const actualTeams = actual.groupClassifications?.[groupName];
          if (actualTeams && Array.isArray(predTeams)) {
            const validPreds = predTeams.filter(Boolean);
            const isKnockout = ["DezesseisAvos", "Oitavas", "Quartas", "Semis"].includes(groupName);
            let pts = 0;
            validPreds.forEach((teamId) => {
              if (actualTeams.includes(teamId)) {
                pts += isKnockout ? 5 : 10;
              }
            });
            if (validPreds.length > 0) {
              const knockoutLabel = groupName === "DezesseisAvos" ? "16 Avos" : groupName;
              items.push({
                label: `Classificados – ${knockoutLabel}`,
                predicted: formatTeamList(validPreds),
                actual: formatTeamList(actualTeams),
                pts,
              });
            }
          }
        });
      }

      // Extra phase predictions (jogo com maior diferença de gols por fase)
      const userExtraPhasePreds = (db.extraPhasePredictions || []).filter(
        (ep) => ep.userId === user.id && ep.groupId === activeGroupId
      );

      if (userExtraPhasePreds.length > 0) {
        const activeCompetition = db.competitions.find(
          (c) => (c.code || "").toUpperCase() === activeCompCode
        );
        const biggestGoalDiffMatchIds: Record<string, string[]> =
          activeCompetition?.biggestGoalDiffMatchIds ||
          Object.fromEntries(
            Object.entries(activeCompetition?.biggestGoalDiffMatches || {}).map(
              ([phase, matchId]) => [phase, matchId ? [matchId] : []]
            )
          );

        const matchLabelById = (matchId?: string) => {
          if (!matchId) return "–";
          const m = auditMatches.find((am) => am.id === matchId);
          if (!m) return "–";
          return `${m.homeTeam.name} x ${m.awayTeam.name}`;
        };

        const phaseLabels: Record<string, string> = {
          groups: "Fase de Grupos",
          round_of_32: "16 Avos de Final",
          oitavas: "Oitavas de Final",
          quartas: "Quartas de Final",
          semis: "Semifinais",
        };
        const phaseOrder = ["groups", "round_of_32", "oitavas", "quartas", "semis"];

        phaseOrder.forEach((phaseKey) => {
          const ep = userExtraPhasePreds.find((p) => p.phase === phaseKey);
          if (!ep || !ep.matchId) return;
          if (!phaseStarted(phaseKey)) return;

          const phaseMatches = auditMatches
            .filter((m) => getExtraPhaseKey(m.stage, m.group) === phaseKey)
            .map((m) => ({
              id: m.id,
              resultHome: m.result?.home ?? null,
              resultAway: m.result?.away ?? null,
              status: m.status,
            }));

          const officialMatchIds = biggestGoalDiffMatchIds[phaseKey] || undefined;
          const pts = calculateExtraPhasePoints(
            { phase: phaseKey, matchId: ep.matchId },
            phaseMatches,
            officialMatchIds
          );

          // Resolve the actual "biggest goal diff" match(es) for display
          let actualLabel = "–";
          if (officialMatchIds && officialMatchIds.length > 0) {
            actualLabel = officialMatchIds.map((id) => matchLabelById(id)).join(", ");
          } else {
            const finished = phaseMatches.filter(
              (m) => m.status === "FINISHED" && m.resultHome != null && m.resultAway != null
            );
            if (finished.length > 0) {
              const maxDiff = Math.max(
                ...finished.map((m) => Math.abs((m.resultHome ?? 0) - (m.resultAway ?? 0)))
              );
              actualLabel = finished
                .filter((m) => Math.abs((m.resultHome ?? 0) - (m.resultAway ?? 0)) === maxDiff)
                .map((m) => matchLabelById(m.id))
                .join(", ");
            }
          }

          items.push({
            label: `Maior diferença de gols – ${phaseLabels[phaseKey] || phaseKey}`,
            predicted: matchLabelById(ep.matchId),
            actual: actualLabel,
            pts,
          });
        });
      }
    } else {
      // Regulamento 1: só calcula pontos de torneio se a final estiver finalizada
      // Filtra apenas jogos da competição ativa para verificar a final
      const compMatches = auditMatches.filter((m) => (m.competitionCode || 'WC').toUpperCase() === activeCompCode);
      const isFinalFinished = isTournamentFinalFinished(compMatches);
      if (isFinalFinished) {
        if (isPreCupSpecialVisible && pred.topScorer?.player) {
          const pts =
            actual.topScorer?.player &&
            pred.topScorer.player.trim().toLowerCase() ===
              actual.topScorer.player.trim().toLowerCase()
              ? POINTS_TOP_SCORER_NAME
              : 0;
          items.push({
            label: "Artilheiro (nome)",
            predicted: pred.topScorer.player,
            actual: formatTopScorerNames(actual.topScorerPlayerIds) || actual.topScorer?.player || "–",
            pts,
          });
        }

        if (isPreCupSpecialVisible && pred.topScorer?.goals) {
          const pts =
            actual.topScorer?.goals && pred.topScorer.goals === actual.topScorer.goals
              ? POINTS_TOP_SCORER_GOALS
              : 0;
          items.push({
            label: "Artilheiro (gols)",
            predicted: String(pred.topScorer.goals),
            actual: actual.topScorer?.goals ? String(actual.topScorer.goals) : "–",
            pts,
          });
        }

        if (isPreCupSpecialVisible && pred.championTeamId) {
          const pts =
            actual.championTeamId && pred.championTeamId === actual.championTeamId
              ? POINTS_CHAMPION
              : 0;
          items.push({
            label: "Campeão",
            predicted: formatTeamName(pred.championTeamId),
            actual: formatTeamName(actual.championTeamId),
            pts,
          });
        }

        if (isPreCupSpecialVisible && pred.bestPlayer) {
          const pts =
            actual.bestPlayer &&
            pred.bestPlayer.trim().toLowerCase() ===
              actual.bestPlayer.trim().toLowerCase()
              ? POINTS_BEST_PLAYER
              : 0;
          items.push({
            label: "Melhor jogador",
            predicted: pred.bestPlayer,
            actual: actual.bestPlayer || "–",
            pts,
          });
        }

        if (isPreCupSpecialVisible && pred.bestGoalkeeper) {
          const pts =
            actual.bestGoalkeeper &&
            pred.bestGoalkeeper.trim().toLowerCase() ===
              actual.bestGoalkeeper.trim().toLowerCase()
              ? POINTS_BEST_GOALKEEPER
              : 0;
          items.push({
            label: "Melhor goleiro",
            predicted: pred.bestGoalkeeper,
            actual: actual.bestGoalkeeper || "–",
            pts,
          });
        }
      }
    }

    const total = items.reduce((sum, i) => sum + i.pts, 0);
    return { items, total };
  }, [tournamentResults, user, allUsers, activeGroupId, ruleset, isPreCupSpecialVisible, teamNameById, auditMatches, db.extraPhasePredictions, db.competitions, db.players, activeCompCode]);

  const grandTotal = matchTotal + (tournamentAudit?.total ?? 0);

  const getMedalBadge = (pts: number, isExact: boolean, isOutcomeCorrect: boolean, isDiffCorrect: boolean) => {
    if (pts === 0) return null;
    if (isExact)
      return (
        <span
          title="Placar exato"
          className="text-base leading-none drop-shadow-[0_0_6px_rgba(245,158,11,0.7)]"
        >
          🥇
        </span>
      );
    if (isOutcomeCorrect && isDiffCorrect)
      return (
        <span title="Diferença de gols certa" className="text-base leading-none">
          🥈
        </span>
      );
    if (isOutcomeCorrect)
      return (
        <span title="Resultado certo" className="text-base leading-none">
          🥉
        </span>
      );
    return null;
  };

  const getPointsBadge = (pts: number, isExact: boolean, isOutcomeCorrect: boolean, aloneBonus: boolean = false) => {
    if (pts === 0)
      return <span className="text-slate-500 font-bold text-sm">0</span>;
    if (isExact) {
      return (
        <div className="flex items-center gap-1">
          <span className="text-brand-gold font-black text-sm drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]">
            +{pts}
          </span>
          {aloneBonus && (
            <span className="text-[8px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1 rounded-full">
              SOZINHO
            </span>
          )}
        </div>
      );
    }
    if (isOutcomeCorrect)
      return <span className="text-brand-green font-bold text-sm">+{pts}</span>;
    return <span className="text-slate-400 font-bold text-sm">+{pts}</span>;
  };

  const getRowAccent = (pts: number, isExact: boolean, isOutcomeCorrect: boolean) => {
    if (pts === 0) return "border-l-2 border-red-500/20";
    if (isExact) return "border-l-2 border-brand-gold/60";
    if (isOutcomeCorrect) return "border-l-2 border-brand-green/50";
    return "border-l-2 border-transparent";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <AvatarWithFallback
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-full border-2 border-slate-600"
              fallbackClassName="bg-slate-700 text-slate-300"
              iconSize={18}
            />
            <div>
              <h2 className="font-black text-white text-base leading-tight">{user.name}</h2>
              <p className="text-slate-400 text-xs">Auditoria de pontos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white">{grandTotal}</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">pts</span>
              </div>
              <p className="text-[10px] text-slate-500">total</p>
            </div>
            <button
              onClick={() => setShowScoringGuide(true)}
              className="p-2 rounded-full hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
              title="Guia de pontuação"
            >
              <Info size={15} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/60 shrink-0">
          <button
            onClick={() => setAuditTab("jogos")}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
              auditTab === "jogos"
                ? "text-brand-green border-b-2 border-brand-green"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Jogos ({matchAudit.length})
          </button>
          {isPreCupSpecialVisible && (
            <button
              onClick={() => setAuditTab("especiais")}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${
                auditTab === "especiais"
                  ? "text-brand-green border-b-2 border-brand-green"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Palpites Especiais
            </button>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {auditTab === "jogos" && (
            <div className="divide-y divide-slate-700/30">
              {matchAudit.length === 0 && (
                <div className="p-10 text-center text-slate-500 text-sm">
                  Nenhum palpite em jogo finalizado ainda.
                </div>
              )}
              {matchAudit.map((row) => {
                const isExpanded = expandedMatchId === row.match.id;
                return (
                  <div
                    key={row.match.id}
                    className={`${getRowAccent(row.pts, row.isExact, row.isOutcomeCorrect)}`}
                  >
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors text-left"
                      onClick={() =>
                        setExpandedMatchId(isExpanded ? null : row.match.id)
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {row.pts === 0 ? (
                            <XCircle size={14} className="text-red-500/60 shrink-0" />
                          ) : row.isExact ? (
                            <Star size={14} className="text-brand-gold shrink-0" />
                          ) : row.isOutcomeCorrect ? (
                            <CheckCircle2 size={14} className="text-brand-green shrink-0" />
                          ) : (
                            <Minus size={14} className="text-slate-600 shrink-0" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-200 text-sm font-medium truncate">
                            {row.match.homeTeam.name}{" "}
                            <span className="text-slate-500">vs</span>{" "}
                            {row.match.awayTeam.name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                              {translateGroupName(row.match.group)}
                            </p>
                            <span className="text-slate-700">·</span>
                            <p className="text-[10px] text-slate-600">
                              {new Date(row.match.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {getMedalBadge(row.pts, row.isExact, row.isOutcomeCorrect, row.isDiffCorrect)}
                        {getPointsBadge(row.pts, row.isExact, row.isOutcomeCorrect, row.aloneBonus)}
                        {isExpanded ? (
                          <ChevronUp size={14} className="text-slate-500" />
                        ) : (
                          <ChevronDown size={14} className="text-slate-500" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 bg-slate-800/30">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                            <p className="text-slate-500 uppercase tracking-widest text-[9px] mb-1">Resultado real</p>
                            <p className="text-white font-black text-lg">
                              {row.match.result!.home} – {row.match.result!.away}
                            </p>
                          </div>
                          <div className="bg-slate-900/60 rounded-xl p-3 text-center">
                            <p className="text-slate-500 uppercase tracking-widest text-[9px] mb-1">Palpite</p>
                            <p
                              className={`font-black text-lg ${
                                row.pts === 0
                                  ? "text-red-400/70"
                                  : row.isExact
                                  ? "text-brand-gold"
                                  : "text-brand-green"
                              }`}
                            >
                              {row.pred.home} – {row.pred.away}
                            </p>
                          </div>
                        </div>
                        {getMatchDuration(row.match) !== "REGULAR" && (
                          <div className="mt-2 space-y-1 px-1">
                            {row.match.regularHome != null && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-500">Tempo Regular (R1)</span>
                                <span className="text-slate-400 font-bold tabular-nums">
                                  {row.match.regularHome} – {row.match.regularAway}
                                </span>
                              </div>
                            )}
                            {row.match.extraTimeHome != null && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-500">Após Prorrogação</span>
                                <span className="text-slate-400 font-bold tabular-nums">
                                  {row.match.result!.home} – {row.match.result!.away}
                                </span>
                              </div>
                            )}
                            {row.match.penaltiesHome != null && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-500">Pênaltis</span>
                                <span className="text-slate-400 font-bold tabular-nums">
                                  {row.match.penaltiesHome} – {row.match.penaltiesAway}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">{row.resultLabel}</span>
                            {row.pred.whoClassifiesTeamId && (
                              <span className="text-[9px] text-slate-400">
                                Classifica: {formatTeamName(row.pred.whoClassifiesTeamId)}
                              </span>
                            )}
                            {row.classifiesBonus > 0 && (
                              <span className="text-[9px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                                +{row.classifiesBonus} classifica
                              </span>
                            )}
                            {row.zebraBonus > 0 && (
                              <span className="text-[9px] font-black text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">
                                +{row.zebraBonus} zebra
                              </span>
                            )}
                            {row.aloneBonus && (
                              <span className="text-[9px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                                +5 bônus (só você)
                              </span>
                            )}
                          </div>
                          {row.pointsSource === "db" && (
                            <span className="text-[9px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded-full">
                              consolidado
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {auditTab === "especiais" && (
            <div className="p-4 space-y-3">
              {!tournamentAudit || tournamentAudit.items.length === 0 ? (
                <div className="p-10 text-center text-slate-500 text-sm">
                  Nenhum palpite especial registrado ou resultados ainda não disponíveis.
                </div>
              ) : (
                tournamentAudit.items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between rounded-xl p-3 border ${
                      item.pts > 0
                        ? "bg-brand-green/5 border-brand-green/20"
                        : "bg-slate-800/40 border-slate-700/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">
                        {item.label}
                      </p>
                      <p className="text-sm text-slate-200 font-medium truncate">
                        {item.predicted}
                      </p>
                      {item.actual !== "–" && (
                        <p className="text-[10px] text-slate-500 truncate">
                          Resultado: {item.actual}
                        </p>
                      )}
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      {item.pts > 0 ? (
                        <span className="text-brand-green font-black text-sm">+{item.pts}</span>
                      ) : (
                        <span className="text-slate-600 font-bold text-sm">0</span>
                      )}
                      <p className="text-[9px] text-slate-600">pts</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer totals */}
        <div className="border-t border-slate-700/60 p-4 shrink-0 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="flex gap-4 text-xs text-slate-500">
              <span>
                Jogos:{" "}
                <span className="text-slate-300 font-bold">{matchTotal} pts</span>
              </span>
              {tournamentAudit && (
                <span>
                  Especiais:{" "}
                  <span className="text-slate-300 font-bold">
                    {tournamentAudit.total} pts
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-slate-500 uppercase tracking-widest">Total</span>
              <span className="text-xl font-black text-white">{grandTotal}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase">pts</span>
            </div>
          </div>
        </div>
      </div>
      {showScoringGuide && (
        <ScoringGuide
          ruleset={ruleset as "regulamento_1" | "regulamento_2"}
          onClose={() => setShowScoringGuide(false)}
        />
      )}
    </div>
  );
};

export default UserAuditModal;
