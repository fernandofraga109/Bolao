import React, { useState, useEffect, useMemo } from "react";
import {
  Match,
  MatchStatus,
  Prediction,
  Friend,
  GroupDB,
} from "../types";
import {
  calculatePoints,
  calculateUnderdogBonus,
  calculatePointsRegulamento2,
  getScoreCategoryRegulamento1,
  getScoreCategoryRegulamento2,
  getMatchPhase,
  getR1MatchScoringResult,
  getMatchDuration,
  getKnockoutAdvancingTeamId,
  POINTS_EXACT,
  POINTS_GOAL_DIFF,
  POINTS_OUTCOME,
  POINTS_CLASSIFIES_BONUS,
} from "../utils/scoring";
import { SCORING_COLORS, ScoringCategory } from "./ui/ScoringGuide";
import {
  Users,
  Save,
  Pencil,
  Trophy,
  Lock,
  LockKeyhole,
  Clock,
  Zap,
  EyeOff,
  MapPin,
  CheckCircle,
  Loader2,
  Calendar,
  RefreshCw,
} from "lucide-react";
import AvatarWithFallback from "./ui/AvatarWithFallback";
import ReplicatePredictionModal from "./ReplicatePredictionModal";

interface MatchCardProps {
  match: Match;
  userPrediction?: Prediction;
  friends: Friend[];
  currentUserId?: string;
  onPredict: (
    matchId: string,
    home: number,
    away: number,
    targetGroupIds?: string[],
    whoClassifiesTeamId?: string,
  ) => Promise<void> | void;
  isAdmin?: boolean;
  onAdminSaveMatch?: (
    matchId: string,
    status: "started" | "live" | "ended",
    home: number,
    away: number,
  ) => void;
  onAdminToggleSyncLock?: (matchId: string, locked: boolean) => void;
  minRankDiff?: number;
  ruleset?: "regulamento_1" | "regulamento_2";
  eligibleGroups?: GroupDB[];
  phaseLockSet?: Set<string>;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  match,
  userPrediction,
  friends,
  currentUserId,
  onPredict,
  isAdmin = false,
  onAdminSaveMatch,
  onAdminToggleSyncLock,
  minRankDiff,
  ruleset = "regulamento_1",
  eligibleGroups = [],
  phaseLockSet,
}) => {
  const [showFriends, setShowFriends] = useState(false);
  const [homeInput, setHomeInput] = useState<string>("");
  const [awayInput, setAwayInput] = useState<string>("");
  const [adminStatus, setAdminStatus] = useState<"started" | "live" | "ended">("started");
  const [isSavingPrediction, setIsSavingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [hasSavedPrediction, setHasSavedPrediction] = useState(
    Boolean(userPrediction),
  );
  const [isReplicateModalOpen, setIsReplicateModalOpen] = useState(false);
  const [whoClassifiesTeamId, setWhoClassifiesTeamId] = useState<string | null>(
    userPrediction?.whoClassifiesTeamId ?? null
  );

  // Initialize inputs
  useEffect(() => {
    if (isAdmin) {
      if (match.result) {
        setHomeInput(match.result.home.toString());
        setAwayInput(match.result.away.toString());
      } else {
        setHomeInput("");
        setAwayInput("");
      }
      setAdminStatus(
        match.status === MatchStatus.FINISHED
          ? "ended"
          : match.status === MatchStatus.LIVE
          ? "live"
          : "started",
      );
    } else {
      if (userPrediction) {
        setHomeInput(userPrediction.homeScore.toString());
        setAwayInput(userPrediction.awayScore.toString());
        setWhoClassifiesTeamId(userPrediction.whoClassifiesTeamId ?? null);
      }
    }
  }, [userPrediction, match.result, isAdmin, match.id, match.status]);

  const handlePredict = async () => {
    if (isSavingPrediction || isPredictionDisabled) return;
    if (homeInput === "" || awayInput === "") return;
    const h = parseInt(homeInput);
    const a = parseInt(awayInput);
    if (!isNaN(h) && !isNaN(a)) {
      try {
        setPredictionError(null);
        setIsSavingPrediction(true);
        const effectiveTieWinner = isKnockoutMatch && h === a ? (whoClassifiesTeamId ?? undefined) : undefined;
        await onPredict(match.id, h, a, undefined, effectiveTieWinner);
        setHasSavedPrediction(true);
      } catch (error: any) {
        setPredictionError(error?.message || "Erro ao salvar palpite.");
      } finally {
        setIsSavingPrediction(false);
      }
    }
  };

  const handleAdminSave = () => {
    if (!onAdminSaveMatch) return;
    const h = homeInput === "" ? 0 : parseInt(homeInput);
    const a = awayInput === "" ? 0 : parseInt(awayInput);
    if (Number.isNaN(h) || Number.isNaN(a)) return;
    onAdminSaveMatch(match.id, adminStatus, h, a);
  };

  const matchDate = new Date(match.date);
  const isLocked = new Date() > matchDate || match.status !== MatchStatus.SCHEDULED;
  const isLive = match.status === MatchStatus.LIVE;
  const isFinished = match.status === MatchStatus.FINISHED;
  const isPhaseLocked = ruleset === "regulamento_2" && phaseLockSet?.has(getMatchPhase(match.stage, match.group));
  const isPredictionDisabled = !isAdmin && (isFinished || isLive || isLocked || !!isPhaseLocked);
  const isKnockoutMatch = ruleset === "regulamento_1" && getMatchPhase(match.stage, match.group) !== "groups";
  const homeInputNum = parseInt(homeInput);
  const awayInputNum = parseInt(awayInput);
  const isPredictingDraw = !isPredictionDisabled && isKnockoutMatch && !isNaN(homeInputNum) && !isNaN(awayInputNum) && homeInputNum === awayInputNum;

  const underdogTeam = (match.homeTeam?.ranking ?? 0) > (match.awayTeam?.ranking ?? 0)
    ? match.homeTeam
    : match.awayTeam;
  const favoriteTeam = underdogTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
  const zebraBonus = ruleset === "regulamento_2" ? 0 : calculateUnderdogBonus(
    underdogTeam?.ranking,
    favoriteTeam?.ranking,
    minRankDiff ?? 0,
  );
  const isZebraCandidate = ruleset !== "regulamento_2" && match.status === MatchStatus.SCHEDULED && zebraBonus > 0;

  // --- CENTRALIZED SCORING HELPER ---
  const getScoringDetails = (home: number, away: number) => {
    if (!match.result) return { points: 0, bonus: 0, category: 'wrong' as const };

    if (ruleset === "regulamento_2") {
      const matchPredictions = friends
        .filter((f) => f.predictions && f.predictions[match.id])
        .map((f) => ({
          userId: f.id,
          homeScore: f.predictions[match.id].home,
          awayScore: f.predictions[match.id].away,
        }));

      if (userPrediction && currentUserId && !matchPredictions.some(p => p.userId === currentUserId)) {
        matchPredictions.push({
          userId: currentUserId,
          homeScore: userPrediction.homeScore,
          awayScore: userPrediction.awayScore
        });
      }

      const phase = getMatchPhase(match.stage, match.group);
      const points = calculatePointsRegulamento2(home, away, match.result.home, match.result.away, phase, matchPredictions, currentUserId || "");
      const cat = getScoreCategoryRegulamento2(home, away, match.result.home, match.result.away, phase, matchPredictions, currentUserId || "");

      return { points, bonus: 0, category: cat.type, aloneBonus: cat.aloneBonus ?? false };
    }

    const realWhoClassifiesId = getKnockoutAdvancingTeamId(match);
    const predWhoClassifiesId = userPrediction?.whoClassifiesTeamId;
    const r1Result = getR1MatchScoringResult(match, match.result.home, match.result.away);

    const points = calculatePoints(
      home, away, r1Result.home, r1Result.away,
      match.homeTeam?.ranking, match.awayTeam?.ranking, minRankDiff ?? 0,
      home === away ? predWhoClassifiesId : undefined, realWhoClassifiesId
    );
    const cat = getScoreCategoryRegulamento1(
      home, away, r1Result.home, r1Result.away,
      match.homeTeam?.ranking, match.awayTeam?.ranking, minRankDiff ?? 0,
      home === away ? predWhoClassifiesId : undefined, realWhoClassifiesId
    );

    let bonus = 0;
    if (points > 0 && r1Result.home !== r1Result.away) {
      const winnerRank = r1Result.home > r1Result.away ? match.homeTeam.ranking : match.awayTeam.ranking;
      const loserRank = r1Result.home > r1Result.away ? match.awayTeam.ranking : match.homeTeam.ranking;
      bonus = calculateUnderdogBonus(winnerRank, loserRank, minRankDiff ?? 0);
    }

    return { points, bonus, category: cat.type, aloneBonus: false };
  };

  // For R1 knockout matches that went to extra time/penalties, show regularTime score.
  // For R2 (and all group matches), show the full result (regularTime + extraTime).
  const displayResult = useMemo(() => {
    if (!match.result) return null;
    if (ruleset === "regulamento_1") {
      return getR1MatchScoringResult(match, match.result.home, match.result.away);
    }
    return { home: match.result.home, away: match.result.away };
  }, [match.result, match.regularHome, match.regularAway, match.extraTimeHome, match.penaltiesHome, match.score, ruleset]);

  const userScoring = useMemo(() => {
    if ((isFinished || isLive) && match.result && userPrediction) {
      const details = getScoringDetails(userPrediction.homeScore, userPrediction.awayScore);
      if (typeof userPrediction.points === 'number') {
        return { points: userPrediction.points, bonus: details.bonus, category: details.category, aloneBonus: details.aloneBonus };
      }
      return details;
    }
    return { points: 0, bonus: 0, category: "wrong" as ScoringCategory, aloneBonus: false };
  }, [isFinished, isLive, match.result, userPrediction]);

  const getPointsStyle = (category: ScoringCategory) => SCORING_COLORS[category].bg + " shadow-lg";

  return (
    <div className={`group bg-slate-800 rounded-3xl shadow-xl border border-slate-700/50 overflow-hidden relative transition-all duration-300 hover:shadow-2xl hover:border-slate-600 ${isFinished ? "opacity-50" : ""}`}>
      {/* Header Info */}
      <div className="px-5 py-3 flex justify-between items-center bg-slate-900/40 border-b border-slate-700/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Calendar size={12} className="text-brand-green" />
            {matchDate.toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Clock size={12} className="text-brand-green" />
            {matchDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-red/10 border border-brand-red/30">
               <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse"></span>
               <span className="text-[10px] font-black text-brand-red uppercase tracking-tighter">
                 {match.minute ? `AO VIVO • ${match.minute}'` : "AO VIVO"}
               </span>
            </div>
          )}

          {isZebraCandidate && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">ZEBRA</span>
              {underdogTeam?.flag && (
                <img src={underdogTeam.flag} alt={underdogTeam.name} className="w-3.5 h-3.5 rounded-sm object-cover" />
              )}
              <span className="text-[10px] text-amber-400 truncate max-w-[60px]">{underdogTeam?.name}</span>
              <span className="text-[10px] font-black text-amber-300">+{zebraBonus}pts</span>
            </div>
          )}
        </div>

        {isFinished && (
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2.5 py-1 rounded-full">Encerrado</span>
        )}
      </div>

      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="relative group/flag w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden transition-all group-hover/flag:border-slate-500 group-hover/flag:shadow-lg group-hover/flag:shadow-brand-green/10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent"></div>
              <img
                src={match.homeTeam.flag}
                alt={match.homeTeam.name}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain transition-transform group-hover/flag:scale-110 relative z-10"
              />
            </div>

            <span className="w-full text-[10px] sm:text-xs font-black text-center text-slate-200 uppercase tracking-tight leading-none h-8 flex items-center justify-center">
              {match.homeTeam.name}
            </span>
            {match.homeTeam.ranking ? (
              <span className="text-[10px] text-slate-500 text-center">#{match.homeTeam.ranking}</span>
            ) : null}
          </div>

          {/* Inputs/Results Container */}
          <div className="flex flex-col items-center gap-4">
            {(isFinished || isLive) && !isAdmin ? (
              <div className="flex flex-col items-center gap-2 animate-fadeIn">
                {/* Score — regular time (or live) */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-black tracking-tighter ${isLive ? "text-brand-red" : "text-white"}`}>
                      {displayResult?.home ?? 0}
                    </span>
                    <span className="text-xl font-black text-slate-600">×</span>
                    <span className={`text-4xl font-black tracking-tighter ${isLive ? "text-brand-red" : "text-white"}`}>
                      {displayResult?.away ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">
                    {isLive
                      ? (match.minute ? `Minuto ${match.minute}'` : "Ao Vivo")
                      : ruleset === "regulamento_1" && getMatchDuration(match) !== 'REGULAR'
                        ? "Tempo Regular"
                        : "Resultado"}
                  </span>
                </div>

                {/* User prediction */}
                <div className="flex flex-col items-center mt-1">
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/50 border border-slate-700/50">
                    <span className="text-xl font-black text-brand-green tracking-tighter">
                      {userPrediction?.homeScore ?? "-"}
                    </span>
                    <span className="text-sm font-bold text-slate-600">×</span>
                    <span className="text-xl font-black text-brand-green tracking-tighter">
                      {userPrediction?.awayScore ?? "-"}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Seu Palpite</span>
                  {userPrediction?.whoClassifiesTeamId && (() => {
                    const classifiesTeam = userPrediction.whoClassifiesTeamId === match.homeTeam.id ? match.homeTeam : match.awayTeam;
                    return (
                      <div className="flex items-center gap-1.5 mt-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        {classifiesTeam.flag && <img src={classifiesTeam.flag} alt={classifiesTeam.name} className="w-4 h-4 rounded-sm object-contain" />}
                        <span className="text-[9px] font-bold text-amber-300">{classifiesTeam.name}</span>
                        <span className="text-[8px] text-amber-400/70">se classifica</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {/* Who classifies selector — only for Reg.1 knockout draws */}
                {isPredictingDraw && (
                  <div className="flex flex-col items-center gap-1.5 w-full px-2 py-2 rounded-xl bg-amber-500/8 border border-amber-500/25 animate-fadeIn">
                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Quem se classifica?</span>
                    <div className="flex gap-2 w-full justify-center">
                      <button
                        onClick={() => setWhoClassifiesTeamId(prev => prev === match.homeTeam.id ? null : match.homeTeam.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black transition-all ${
                          whoClassifiesTeamId === match.homeTeam.id
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-500/40"
                        }`}
                      >
                        {match.homeTeam.flag && <img src={match.homeTeam.flag} alt={match.homeTeam.name} className="w-4 h-4 rounded-sm object-contain" />}
                        {match.homeTeam.name}
                      </button>
                      <button
                        onClick={() => setWhoClassifiesTeamId(prev => prev === match.awayTeam.id ? null : match.awayTeam.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black transition-all ${
                          whoClassifiesTeamId === match.awayTeam.id
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-amber-500/40"
                        }`}
                      >
                        {match.awayTeam.flag && <img src={match.awayTeam.flag} alt={match.awayTeam.name} className="w-4 h-4 rounded-sm object-contain" />}
                        {match.awayTeam.name}
                      </button>
                    </div>
                    <span className="text-[8px] text-amber-400/60">Opcional · +{POINTS_CLASSIFIES_BONUS} pts se acertar</span>
                  </div>
                )}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Home score stepper */}
                  <div className="flex flex-col items-center gap-1">
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setHomeInput(v => String(Math.max(0, (parseInt(v) || 0) + 1)))}
                        className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-brand-green hover:text-brand-dark text-slate-400 font-black text-base transition-all active:scale-90"
                      >+</button>
                    )}
                    <input
                      type="number"
                      value={homeInput}
                      onChange={(e) => setHomeInput(e.target.value)}
                      disabled={isPredictionDisabled}
                      className="w-12 h-12 sm:w-14 sm:h-14 text-center font-black text-xl sm:text-2xl rounded-2xl bg-slate-900 border border-slate-700 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none disabled:opacity-50 disabled:bg-slate-800/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="-"
                    />
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setHomeInput(v => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                        className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-400 font-black text-base transition-all active:scale-90"
                      >−</button>
                    )}
                  </div>

                  <span className="text-slate-600 font-black text-xl tracking-tighter">×</span>

                  {/* Away score stepper */}
                  <div className="flex flex-col items-center gap-1">
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setAwayInput(v => String(Math.max(0, (parseInt(v) || 0) + 1)))}
                        className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-brand-green hover:text-brand-dark text-slate-400 font-black text-base transition-all active:scale-90"
                      >+</button>
                    )}
                    <input
                      type="number"
                      value={awayInput}
                      onChange={(e) => setAwayInput(e.target.value)}
                      disabled={isPredictionDisabled}
                      className="w-12 h-12 sm:w-14 sm:h-14 text-center font-black text-xl sm:text-2xl rounded-2xl bg-slate-900 border border-slate-700 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none disabled:opacity-50 disabled:bg-slate-800/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="-"
                    />
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setAwayInput(v => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                        className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-400 font-black text-base transition-all active:scale-90"
                      >−</button>
                    )}
                  </div>
                </div>
                {!isPredictionDisabled && (
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sua Aposta</span>
                )}
              </div>
            )}
          </div>


          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="relative group/flag w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden transition-all group-hover/flag:border-slate-500 group-hover/flag:shadow-lg group-hover/flag:shadow-brand-green/10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent"></div>
              <img
                src={match.awayTeam.flag}
                alt={match.awayTeam.name}
                className="w-9 h-9 sm:w-12 sm:h-12 object-contain transition-transform group-hover/flag:scale-110 relative z-10"
              />
            </div>

            <span className="w-full text-[10px] sm:text-xs font-black text-center text-slate-200 uppercase tracking-tight leading-none h-8 flex items-center justify-center">
              {match.awayTeam.name}
            </span>
            {match.awayTeam.ranking ? (
              <span className="text-[10px] text-slate-500 text-center">#{match.awayTeam.ranking}</span>
            ) : null}
          </div>
        </div>

        {/* Extra Time + Penalties row — shown below teams for finished R1 knockout matches */}
        {!isAdmin && (isFinished || isLive) && ruleset === "regulamento_1" && (
          getMatchDuration(match) !== 'REGULAR' ||
          (match.penaltiesHome != null || match.penaltiesAway != null)
        ) && (
          <div className="flex gap-3 mb-4 animate-fadeIn">
            {/* Extra Time block */}
            {getMatchDuration(match) !== 'REGULAR' && match.result && (
              <div className="flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl bg-slate-700/30 border border-slate-600/40">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Após Prorrogação</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-black text-white">{match.result.home}</span>
                  <span className="text-sm font-bold text-slate-500">×</span>
                  <span className="text-lg font-black text-white">{match.result.away}</span>
                </div>
              </div>
            )}

            {/* Penalties block */}
            {(match.penaltiesHome != null || match.penaltiesAway != null) && (
              <div className="flex-1 flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Disputa de Pênaltis</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-black text-white">{match.penaltiesHome ?? 0}</span>
                  <span className="text-sm font-bold text-slate-500">×</span>
                  <span className="text-lg font-black text-white">{match.penaltiesAway ?? 0}</span>
                </div>
                {(() => {
                  const winnerId = getKnockoutAdvancingTeamId(match);
                  if (!winnerId) return null;
                  const winnerName = winnerId === match.homeTeam?.id ? match.homeTeam.name : match.awayTeam.name;
                  return (
                    <span className="text-[9px] font-bold text-amber-300 text-center leading-tight">
                      Vencedor: {winnerName}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        {predictionError && (
          <div className="mb-3 p-2 bg-brand-red/10 border border-brand-red/20 text-brand-red text-[10px] font-bold rounded-lg text-center animate-fadeIn">
            {predictionError}
          </div>
        )}

        <div className={`flex mt-4 ${isAdmin ? "flex-col gap-3" : "items-center justify-between"}`}>
          {/* Row 1: icon buttons + (non-admin) action */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setShowFriends(!showFriends)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${showFriends ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-800 border-slate-700 text-slate-500 hover:text-white"}`}
              >
                <Users size={20} />
              </button>

              {eligibleGroups.length > 0 && !isPredictionDisabled && (
                <button
                  onClick={() => {
                    if (homeInput !== "" && awayInput !== "") {
                      setIsReplicateModalOpen(true);
                    } else {
                      setPredictionError("Digite um palpite antes de sincronizar.");
                      setTimeout(() => setPredictionError(null), 3000);
                    }
                  }}
                  disabled={isSavingPrediction}
                  title="Sincronizar este palpite com outros grupos"
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0 animate-fadeIn"
                >
                  <RefreshCw size={18} />
                </button>
              )}
            </div>

            {!isAdmin && (
              <div className="flex-1 flex justify-end pl-4">
                {(isFinished || isLive) && match.result ? (
                   <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/5 ${getPointsStyle(userScoring.category)}`}>
                      <Trophy size={16} className={userScoring.category === "exact" ? "fill-brand-dark/30" : ""} />
                      <div className="flex flex-col">
                         <span className="text-lg font-black leading-none">{userScoring.points} <span className="text-[10px]">PTS</span></span>
                         {userScoring.category === "exact" && (
                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-70">Placar Exato!</span>
                         )}
                         {userScoring.aloneBonus && (
                            <span className="text-[8px] font-black uppercase tracking-tighter text-amber-300 flex items-center gap-0.5">
                               ✨ +5 Placar Isolado
                            </span>
                         )}
                         {userScoring.bonus > 0 && userScoring.category !== "exact" && (
                            <span className="text-[8px] font-black uppercase tracking-tighter text-yellow-300 flex items-center gap-0.5">
                               <Zap size={8} fill="currentColor" /> BÔNUS ZEBRA +{userScoring.bonus}
                            </span>
                         )}
                         {userScoring.bonus > 0 && userScoring.category === "exact" && (
                            <span className="text-[8px] font-black uppercase tracking-tighter flex items-center gap-0.5 opacity-70">
                               <Zap size={8} fill="currentColor" /> +{userScoring.bonus} zebra
                            </span>
                         )}
                         {userPrediction?.whoClassifiesTeamId && getMatchDuration(match) !== 'REGULAR' && (() => {
                            const realWhoClassifies = getKnockoutAdvancingTeamId(match);
                            const hit = userPrediction.whoClassifiesTeamId === realWhoClassifies;
                            return hit ? (
                               <span className="text-[8px] font-black uppercase tracking-tighter text-amber-300 flex items-center gap-0.5">
                                 <Zap size={8} fill="currentColor" /> +{POINTS_CLASSIFIES_BONUS} classifica
                               </span>
                            ) : null;
                         })()}
                      </div>
                   </div>
                ) : isPredictionDisabled ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                     <Lock size={14} />
                     {isPhaseLocked && !isLocked ? "Fase Iniciada" : "Fechado"}
                  </div>
                ) : (
                  <button
                    onClick={handlePredict}
                    disabled={isSavingPrediction}
                    className="group/save flex items-center gap-2 bg-brand-green text-brand-dark px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-brand-green/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    {isSavingPrediction ? <Loader2 size={16} className="animate-spin" /> : (hasSavedPrediction ? <Pencil size={16} /> : <Save size={16} />)}
                    {isSavingPrediction ? "Salvando" : (hasSavedPrediction ? "Salvar" : "Palpitar")}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Row 2 (admin only): status selector + save button */}
          {isAdmin && (
            <div className="flex flex-col gap-2 w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 shrink-0">Status</label>
                  <select
                    value={adminStatus}
                    onChange={(e) => setAdminStatus(e.target.value as "started" | "live" | "ended")}
                    className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-2xl border border-slate-700 focus:outline-none min-w-0 flex-1"
                  >
                    <option value="started">SCHEDULED</option>
                    <option value="live">LIVE</option>
                    <option value="ended">FINISHED</option>
                  </select>
                </div>
                <button
                  onClick={handleAdminSave}
                  className="shrink-0 bg-brand-blue text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Salvar Edição
                </button>
              </div>
              <button
                onClick={() => onAdminToggleSyncLock?.(match.id, !match.syncLocked)}
                className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  match.syncLocked
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                    : "bg-slate-900/50 border-slate-700/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                }`}
              >
                <LockKeyhole size={12} />
                {match.syncLocked ? "Sync Bloqueado (Clique para Desbloquear)" : "Bloquear Sync deste Jogo"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Friends predictions section would go here, simplified or kept from original */}
      {showFriends && (
        <div className="px-6 pb-6 border-t border-slate-700/50 bg-slate-900/20 pt-4 animate-slideDown">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
            O que a galera acha
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {friends
              .filter((f) => f.predictions[match.id] && f.id !== currentUserId)
              .map((f) => {
                const pred = f.predictions[match.id];
                const friendScoring = getScoringDetails(pred.home, pred.away);
                const pts = friendScoring.points + friendScoring.bonus;
                return (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-slate-700/30"
                >
                  <div className="flex items-center gap-2">
                    <AvatarWithFallback
                      src={f.avatar}
                      alt={f.name}
                      className="w-6 h-6 rounded-full"
                      iconSize={12}
                    />
                    <span className="text-xs font-bold text-slate-300">
                      {f.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        pts > 0
                          ? "text-brand-green bg-brand-green/10"
                          : "text-slate-600 bg-slate-800"
                      }`}
                    >
                      {pts > 0 ? `+${pts}pts` : "0pts"}
                    </span>
                    <span className="font-mono font-black text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                      {isPredictionDisabled ? `${pred.home} - ${pred.away}` : <EyeOff size={12} />}
                    </span>
                  </div>
                </div>
                );
              })}
          </div>
        </div>
      )}
      {/* Replicate Prediction Modal */}
      {isReplicateModalOpen && (
        <ReplicatePredictionModal
          isOpen={isReplicateModalOpen}
          onClose={() => setIsReplicateModalOpen(false)}
          eligibleGroups={eligibleGroups}
          match={match}
          homeScore={parseInt(homeInput) || 0}
          awayScore={parseInt(awayInput) || 0}
          onConfirm={async (targetGroupIds) => {
            const h = parseInt(homeInput);
            const a = parseInt(awayInput);
            const effectiveTieWinner = isKnockoutMatch && h === a ? (whoClassifiesTeamId ?? undefined) : undefined;
            await onPredict(match.id, h, a, targetGroupIds, effectiveTieWinner);
            setHasSavedPrediction(true);
          }}
        />
      )}
    </div>
  );
};

export default MatchCard;
