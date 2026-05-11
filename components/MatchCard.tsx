import React, { useState, useEffect, useMemo } from "react";
import {
  Match,
  MatchStatus,
  Prediction,
  Friend,
  AIPredictionResult,
} from "../types";
import {
  calculatePoints,
  calculateUnderdogBonus,
  POINTS_EXACT,
  POINTS_GOAL_DIFF,
  POINTS_OUTCOME,
} from "../utils/scoring";
import {
  Users,
  Bot,
  Save,
  Pencil,
  Trophy,
  Lock,
  Clock,
  Zap,
  EyeOff,
  MapPin,
  CheckCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import { getAIPrediction } from "../services/geminiService";
import AvatarWithFallback from "./ui/AvatarWithFallback";

interface MatchCardProps {
  match: Match;
  userPrediction?: Prediction;
  friends: Friend[];
  onPredict: (
    matchId: string,
    home: number,
    away: number,
  ) => Promise<void> | void;
  isAdmin?: boolean;
  onFinishMatch?: (matchId: string, home: number, away: number) => void;
  minRankDiff?: number;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  userPrediction,
  friends,
  onPredict,
  isAdmin = false,
  onFinishMatch,
  minRankDiff,
}) => {
  const [showFriends, setShowFriends] = useState(false);
  const [homeInput, setHomeInput] = useState<string>("");
  const [awayInput, setAwayInput] = useState<string>("");
  const [isSavingPrediction, setIsSavingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [hasSavedPrediction, setHasSavedPrediction] = useState(
    Boolean(userPrediction),
  );

  const [isPredictingAI, setIsPredictingAI] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AIPredictionResult | null>(
    null,
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
    } else {
      if (userPrediction) {
        setHomeInput(userPrediction.homeScore.toString());
        setAwayInput(userPrediction.awayScore.toString());
      }
    }
  }, [userPrediction, match.result, isAdmin, match.id]);

  const handlePredict = async () => {
    if (isSavingPrediction || isPredictionDisabled) return;
    if (homeInput === "" || awayInput === "") return;
    const h = parseInt(homeInput);
    const a = parseInt(awayInput);
    if (!isNaN(h) && !isNaN(a)) {
      try {
        setPredictionError(null);
        setIsSavingPrediction(true);
        await onPredict(match.id, h, a);
        setHasSavedPrediction(true);
      } catch (error: any) {
        setPredictionError(error?.message || "Erro ao salvar palpite.");
      } finally {
        setIsSavingPrediction(false);
      }
    }
  };

  const handleAIPredict = async () => {
    setIsPredictingAI(true);
    setAiPrediction(null);
    const result = await getAIPrediction(match.homeTeam.name, match.awayTeam.name);
    setAiPrediction(result);
    setIsPredictingAI(false);
  };

  const matchDate = new Date(match.date);
  const isLocked = new Date() > matchDate || match.status !== MatchStatus.SCHEDULED;
  const isLive = match.status === MatchStatus.LIVE;
  const isFinished = match.status === MatchStatus.FINISHED;
  const isPredictionDisabled = !isAdmin && (isFinished || isLive || isLocked);

  const rankDiff = Math.abs((match.homeTeam?.ranking ?? 0) - (match.awayTeam?.ranking ?? 0));
  const isZebraCandidate = match.status === MatchStatus.SCHEDULED && rankDiff >= (minRankDiff ?? 10);
  const underdogTeam = (match.homeTeam?.ranking ?? 0) > (match.awayTeam?.ranking ?? 0)
    ? match.homeTeam
    : match.awayTeam;

  // --- CENTRALIZED SCORING HELPER ---
  const getScoringDetails = (home: number, away: number) => {
    if (!match.result) return { points: 0, bonus: 0 };
    
    const points = calculatePoints(
      home,
      away,
      match.result.home,
      match.result.away,
      match.homeTeam?.ranking,
      match.awayTeam?.ranking
    );

    let bonus = 0;
    if (points > 0 && match.result.home !== match.result.away) {
      const winnerRank = match.result.home > match.result.away ? match.homeTeam.ranking : match.awayTeam.ranking;
      const loserRank = match.result.home > match.result.away ? match.awayTeam.ranking : match.homeTeam.ranking;
      bonus = calculateUnderdogBonus(winnerRank, loserRank);
    }

    return { points, bonus };
  };

  const userScoring = useMemo(() => {
    if ((isFinished || isLive) && match.result && userPrediction) {
      if (typeof userPrediction.points === 'number') {
        // Find bonus for display purposes even if stored
        const details = getScoringDetails(userPrediction.homeScore, userPrediction.awayScore);
        return { points: userPrediction.points, bonus: details.bonus };
      }
      return getScoringDetails(userPrediction.homeScore, userPrediction.awayScore);
    }
    return { points: 0, bonus: 0 };
  }, [isFinished, isLive, match.result, userPrediction]);

  const getPointsStyle = (pts: number) => {
    if (pts >= POINTS_EXACT) return "bg-brand-gold text-brand-dark shadow-brand-gold/30";
    if (pts >= POINTS_GOAL_DIFF) return "bg-brand-blue text-white shadow-brand-blue/30";
    if (pts >= POINTS_OUTCOME) return "bg-indigo-600 text-white shadow-indigo-500/30";
    return "bg-slate-700 text-slate-400";
  };

  return (
    <div className={`group bg-slate-800 rounded-3xl shadow-xl border border-slate-700/50 overflow-hidden relative transition-all duration-300 hover:shadow-2xl hover:border-slate-600 ${isFinished ? "opacity-90 saturate-[0.8]" : ""}`}>
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
               <span className="text-[10px] font-black text-brand-red uppercase tracking-tighter">AO VIVO</span>
            </div>
          )}

          {isZebraCandidate && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">ZEBRA</span>
              {underdogTeam?.flag && (
                <img src={underdogTeam.flag} alt={underdogTeam.name} className="w-3.5 h-3.5 rounded-sm object-cover" />
              )}
              <span className="text-[10px] text-amber-400 truncate max-w-[60px]">{underdogTeam?.name}</span>
            </div>
          )}
        </div>

        {isFinished && (
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2.5 py-1 rounded-full">Encerrado</span>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="relative group/flag w-16 h-16 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden transition-all group-hover/flag:border-slate-500 group-hover/flag:shadow-lg group-hover/flag:shadow-brand-green/10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent"></div>
              <img
                src={match.homeTeam.flag}
                alt={match.homeTeam.name}
                className="w-12 h-12 object-contain transition-transform group-hover/flag:scale-110 relative z-10"
              />
            </div>

            <span className="text-xs font-black text-center text-slate-200 uppercase tracking-tight leading-none h-8 flex items-center">
              {match.homeTeam.name}
            </span>
            {match.homeTeam.ranking ? (
              <span className="text-[10px] text-slate-500 text-center">#{match.homeTeam.ranking}</span>
            ) : null}
          </div>

          {/* Inputs/Results Container */}
          <div className="flex flex-col items-center gap-4">
            {(isFinished || isLive) && !isAdmin ? (
              <div className="flex flex-col items-center gap-3 animate-fadeIn">
                {/* Placar atual (live) ou resultado final */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-black tracking-tighter ${isLive ? "text-brand-red" : "text-white"}`}>
                      {match.result?.home ?? 0}
                    </span>
                    <span className="text-xl font-black text-slate-600">×</span>
                    <span className={`text-4xl font-black tracking-tighter ${isLive ? "text-brand-red" : "text-white"}`}>
                      {match.result?.away ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">
                    {isLive ? "Ao Vivo" : "Resultado"}
                  </span>
                </div>

                {/* Palpite do Usuário */}
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
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-3">
                  {/* Home score stepper */}
                  <div className="flex flex-col items-center gap-1">
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setHomeInput(v => String(Math.max(0, (parseInt(v) || 0) + 1)))}
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-brand-green hover:text-brand-dark text-slate-400 font-black text-base transition-all active:scale-90"
                      >+</button>
                    )}
                    <input
                      type="number"
                      value={homeInput}
                      onChange={(e) => setHomeInput(e.target.value)}
                      disabled={isPredictionDisabled}
                      className="w-14 h-14 text-center font-black text-2xl rounded-2xl bg-slate-900 border border-slate-700 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none disabled:opacity-50 disabled:bg-slate-800/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="-"
                    />
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setHomeInput(v => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-400 font-black text-base transition-all active:scale-90"
                      >−</button>
                    )}
                  </div>

                  <span className="text-slate-600 font-black text-xl tracking-tighter">×</span>

                  {/* Away score stepper */}
                  <div className="flex flex-col items-center gap-1">
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setAwayInput(v => String(Math.max(0, (parseInt(v) || 0) + 1)))}
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-brand-green hover:text-brand-dark text-slate-400 font-black text-base transition-all active:scale-90"
                      >+</button>
                    )}
                    <input
                      type="number"
                      value={awayInput}
                      onChange={(e) => setAwayInput(e.target.value)}
                      disabled={isPredictionDisabled}
                      className="w-14 h-14 text-center font-black text-2xl rounded-2xl bg-slate-900 border border-slate-700 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 transition-all outline-none disabled:opacity-50 disabled:bg-slate-800/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="-"
                    />
                    {!isPredictionDisabled && (
                      <button
                        onClick={() => setAwayInput(v => String(Math.max(0, (parseInt(v) || 0) - 1)))}
                        className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-400 font-black text-base transition-all active:scale-90"
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
            <div className="relative group/flag w-16 h-16 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden transition-all group-hover/flag:border-slate-500 group-hover/flag:shadow-lg group-hover/flag:shadow-brand-green/10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/3 to-transparent"></div>
              <img
                src={match.awayTeam.flag}
                alt={match.awayTeam.name}
                className="w-12 h-12 object-contain transition-transform group-hover/flag:scale-110 relative z-10"
              />
            </div>

            <span className="text-xs font-black text-center text-slate-200 uppercase tracking-tight leading-none h-8 flex items-center">
              {match.awayTeam.name}
            </span>
            {match.awayTeam.ranking ? (
              <span className="text-[10px] text-slate-500 text-center">#{match.awayTeam.ranking}</span>
            ) : null}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            {!isPredictionDisabled && (
              <button
                onClick={handleAIPredict}
                disabled={isPredictingAI}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
              >
                {isPredictingAI ? <Loader2 size={20} className="animate-spin" /> : <Bot size={20} />}
              </button>
            )}
            <button
              onClick={() => setShowFriends(!showFriends)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl border transition-all ${showFriends ? "bg-slate-700 border-slate-600 text-white" : "bg-slate-800 border-slate-700 text-slate-500 hover:text-white"}`}
            >
              <Users size={20} />
            </button>
          </div>

          <div className="flex-1 flex justify-end pl-4">
            {isAdmin ? (
               <button
                 onClick={() => onFinishMatch?.(match.id, parseInt(homeInput), parseInt(awayInput))}
                 className="bg-brand-blue text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:scale-105 active:scale-95 transition-all"
               >
                 Salvar Edição
               </button>
            ) : (
              <>
                {(isFinished || isLive) && match.result ? (
                   <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg border border-white/5 ${getPointsStyle(userScoring.points)}`}>
                      <Trophy size={16} className={userScoring.points >= POINTS_EXACT ? "fill-brand-dark/30" : ""} />
                      <div className="flex flex-col">
                         <span className="text-lg font-black leading-none">{userScoring.points} <span className="text-[10px]">PTS</span></span>
                         {userScoring.points >= POINTS_EXACT && (
                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-70">Placar Exato!</span>
                         )}
                         {userScoring.bonus > 0 && userScoring.points < POINTS_EXACT && (
                            <span className="text-[8px] font-black uppercase tracking-tighter text-yellow-300 flex items-center gap-0.5">
                               <Zap size={8} fill="currentColor" /> BÔNUS ZEBRA +{userScoring.bonus}
                            </span>
                         )}
                         {userScoring.bonus > 0 && userScoring.points >= POINTS_EXACT && (
                            <span className="text-[8px] font-black uppercase tracking-tighter flex items-center gap-0.5 opacity-70">
                               <Zap size={8} fill="currentColor" /> +{userScoring.bonus} zebra
                            </span>
                         )}
                      </div>
                   </div>
                ) : isPredictionDisabled ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500">
                     <Lock size={14} /> Fechado
                  </div>
                ) : (
                  <button
                    onClick={handlePredict}
                    disabled={isSavingPrediction}
                    className="group/save flex items-center gap-2 bg-brand-green text-brand-dark px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-brand-green/20 hover:scale-105 active:scale-95 transition-all"
                  >
                    {isSavingPrediction ? <Loader2 size={16} className="animate-spin" /> : (hasSavedPrediction ? <Pencil size={16} /> : <Save size={16} />)}
                    {isSavingPrediction ? "Salvando" : (hasSavedPrediction ? "Editar" : "Palpitar")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Friends predictions section would go here, simplified or kept from original */}
      {showFriends && (
        <div className="px-6 pb-6 border-t border-slate-700/50 bg-slate-900/20 pt-4 animate-slideDown">
           <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">O que a galera acha</h4>
           <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {friends.length === 0 ? <p className="text-xs text-slate-600 italic">Ainda ninguém palpitou...</p> : 
                friends.filter(f => f.predictions[match.id]).map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-slate-700/30">
                     <div className="flex items-center gap-2">
                        <AvatarWithFallback src={f.avatar} alt={f.name} className="w-6 h-6 rounded-full" iconSize={12} />
                        <span className={`text-xs font-bold ${f.id === 'me' ? 'text-brand-green' : 'text-slate-300'}`}>{f.name}</span>
                     </div>
                     <span className="font-mono font-black text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                        {isPredictionDisabled || f.id === 'me' ? `${f.predictions[match.id].home} - ${f.predictions[match.id].away}` : <EyeOff size={12} />}
                     </span>
                  </div>
                ))
              }
           </div>
        </div>
      )}
    </div>
  );
};

export default MatchCard;
