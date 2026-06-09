import React, { useMemo, useState, useEffect } from "react";
import { X, Star, CheckCircle2, XCircle, Minus, ChevronDown, ChevronUp, Info } from "lucide-react";
import ScoringGuide from "./ui/ScoringGuide";
import { User, Match, MatchStatus, TournamentPredictions, Group, PredictionDB } from "../types";
import { useDatabase } from "../contexts/DatabaseContext";
import {
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
} from "../utils/scoring";
import { translateGroupName } from "../utils/translations";
import { hydrateMatchDB, resolveShootoutWinnerId, normalizeCompetitionCode } from "../utils/matchUtils";
import { calculateMatchPoints } from "../utils/pointsUtils";
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
  const activeCompCode = normalizeCompetitionCode(activeGroup?.competitionCode);
  const minRankDiff = activeGroup?.underdog_min_rank_diff ?? 0;

  const auditMatches = useMemo(() => {
    return db.matches
      .map((m) => hydrateMatchDB(m, db.teams))
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

  // Reconstruct predictions for the clicked user scoped to their own activeGroupId.
  // user.predictions was hydrated using viewerActiveGroupId (bug in useUserSystem for other users),
  // so we must rebuild from raw DB predictions to get the correct scoped data.
  const userPredictions = useMemo(() => {
    const map: Record<string, { home: number; away: number; points?: number; whoClassifiesTeamId?: string }> = {};
    rawPredictions
      .filter((p) => p.userId === user.id && (activeGroupId ? p.groupId === activeGroupId : true))
      .forEach((p) => {
        // If multiple entries exist (legacy + group-scoped), group-scoped wins
        const existing = map[p.matchId];
        if (!existing || p.groupId === activeGroupId) {
          map[p.matchId] = { home: p.homeScore, away: p.awayScore, points: p.points, whoClassifiesTeamId: p.tieWinnerTeamId };
        }
      });
    return map;
  }, [rawPredictions, user.id, activeGroupId]);

  // Similarly rebuild predictions for all group members for reg2 placar-sozinho context
  const groupUserPredictions = useMemo(() => {
    const byUserId: Record<string, Record<string, { home: number; away: number }>> = {};
    rawPredictions
      .filter((p) => activeGroupId ? p.groupId === activeGroupId : true)
      .forEach((p) => {
        if (!byUserId[p.userId]) byUserId[p.userId] = {};
        byUserId[p.userId][p.matchId] = { home: p.homeScore, away: p.awayScore };
      });
    return byUserId;
  }, [rawPredictions, activeGroupId]);

  const matchAudit = useMemo((): MatchAuditRow[] => {
    const rows: MatchAuditRow[] = [];

    Object.entries(userPredictions).forEach(([matchId, pred]) => {
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
        const matchPredictions = Object.entries(groupUserPredictions)
          .filter(([, preds]) => !!preds[matchId])
          .map(([userId, preds]) => ({
            userId,
            homeScore: preds[matchId].home,
            awayScore: preds[matchId].away,
          }));
        pts = calculateMatchPoints({
          pred: { homeScore: pred.home, awayScore: pred.away },
          match,
          ruleset: "regulamento_2",
          groupMatchPredictions: matchPredictions,
          userId: user.id,
        });
      } else {
        pts = calculateMatchPoints({
          pred: { homeScore: pred.home, awayScore: pred.away, tieWinnerTeamId: pred.whoClassifiesTeamId },
          match,
          ruleset: "regulamento_1",
          minRankDiff,
        });
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
        const matchPredsForCat = Object.entries(groupUserPredictions)
          .filter(([, preds]) => !!preds[matchId])
          .map(([uid, preds]) => ({ userId: uid, homeScore: preds[matchId].home, awayScore: preds[matchId].away }));
        const r2Cat = getScoreCategoryRegulamento2(
          pred.home, pred.away,
          match.result!.home, match.result!.away,
          phase, matchPredsForCat, user.id
        );
        isExact = r2Cat.type === "exact";
        isDiffCorrect = r2Cat.type === "diff";
        isOutcomeCorrect = r2Cat.type !== "wrong";
      } else {
        const auditScore = getR1MatchScoringResult((match as any).score, match.result!.home, match.result!.away);
        const realWhoClassifiesIdForCat = resolveShootoutWinnerId((match as any).score, match.homeTeam?.id, match.awayTeam?.id);
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
      if (pts === 0) resultLabel = "Errou";
      else if (isExact) resultLabel = "Placar exato";
      else if (isOutcomeCorrect && isDiffCorrect) resultLabel = "Diferença certa";
      else if (isOutcomeCorrect) resultLabel = "Resultado certo";

      // Calculate classifiesBonus for display (Reg. 1 only)
      const realWhoClassifiesIdDisplay = resolveShootoutWinnerId((match as any).score, match.homeTeam?.id, match.awayTeam?.id);
      const classifiesBonus =
        ruleset === "regulamento_1" &&
        pred.home === pred.away &&
        !!pred.whoClassifiesTeamId &&
        !!realWhoClassifiesIdDisplay &&
        pred.whoClassifiesTeamId === realWhoClassifiesIdDisplay
          ? POINTS_CLASSIFIES_BONUS
          : 0;

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
      });
    });

    rows.sort((a, b) => new Date(b.match.date).getTime() - new Date(a.match.date).getTime());
    return rows;
  }, [canonicalMatchById, userPredictions, groupUserPredictions, ruleset, activeCompCode, minRankDiff]);

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

  const phaseStarted = (phaseName: string) => {
    const now = Date.now();
    const normalized = phaseName.toLowerCase();

    const phaseMatches = auditMatches.filter((match) => {
      const stage = (match.stage || "").toUpperCase();
      const group = (match.group || "").toUpperCase();

      if (normalized === "oitavas") {
        return stage.includes("ROUND_OF_16") || group.includes("OITAVAS");
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
    if (!tournamentResults || !user.tournamentPredictions) return null;

    const pred = user.tournamentPredictions;
    const actual = tournamentResults;
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
        if (actual.topScorer?.player) {
          const predPlayer = pred.topScorer.player.trim().toLowerCase();
          const actualPlayer = actual.topScorer.player.trim().toLowerCase();
          if (predPlayer === actualPlayer) {
            const count = allGroupPredictions.filter(
              (p) => {
                if (p.topScorerPlayerId && pred.topScorerPlayerId)
                  return p.topScorerPlayerId === pred.topScorerPlayerId;
                return p.topScorerPlayer && p.topScorerPlayer.trim().toLowerCase() === actualPlayer;
              }
            ).length;
            pts = count === 1 ? 60 : count === 2 ? 40 : count === 3 ? 30 : 25;
          }
        }
        items.push({
          label: "Artilheiro",
          predicted: pred.topScorer.player,
          actual: actual.topScorer?.player || "–",
          pts,
        });
      }

      // Most goals team
      if (isPreCupSpecialVisible && pred.mostGoalsTeamId) {
        const pts =
          actual.mostGoalsTeamId && pred.mostGoalsTeamId === actual.mostGoalsTeamId
            ? 20
            : 0;
        items.push({
          label: "Seleção com mais gols num jogo",
          predicted: formatTeamName(pred.mostGoalsTeamId),
          actual: formatTeamName(actual.mostGoalsTeamId),
          pts,
        });
      }

      // Most conceded team
      if (isPreCupSpecialVisible && pred.mostConcededTeamId) {
        const pts =
          actual.mostConcededTeamId &&
          pred.mostConcededTeamId === actual.mostConcededTeamId
            ? 20
            : 0;
        items.push({
          label: "Seleção que tomou mais gols num jogo",
          predicted: formatTeamName(pred.mostConcededTeamId),
          actual: formatTeamName(actual.mostConcededTeamId),
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
            const isKnockout = ["Oitavas", "Quartas", "Semis"].includes(groupName);
            let pts = 0;
            validPreds.forEach((teamId) => {
              if (actualTeams.includes(teamId)) {
                pts += isKnockout ? 5 : 10;
              }
            });
            if (validPreds.length > 0) {
              items.push({
                label: `Classificados – ${groupName}`,
                predicted: formatTeamList(validPreds),
                actual: formatTeamList(actualTeams),
                pts,
              });
            }
          }
        });
      }
    } else {
      // Regulamento 1
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
          actual: actual.topScorer?.player || "–",
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

    const total = items.reduce((sum, i) => sum + i.pts, 0);
    return { items, total };
  }, [tournamentResults, user, allUsers, activeGroupId, ruleset, isPreCupSpecialVisible, teamNameById, auditMatches]);

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

  const getPointsBadge = (pts: number, isExact: boolean, isOutcomeCorrect: boolean) => {
    if (pts === 0)
      return <span className="text-slate-500 font-bold text-sm">0</span>;
    if (isExact)
      return (
        <span className="text-brand-gold font-black text-sm drop-shadow-[0_0_4px_rgba(245,158,11,0.5)]">
          +{pts}
        </span>
      );
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
                        {getPointsBadge(row.pts, row.isExact, row.isOutcomeCorrect)}
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
