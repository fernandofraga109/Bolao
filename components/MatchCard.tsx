
import React, { useState, useEffect, useMemo } from 'react';
import { Match, MatchStatus, Prediction, Friend, AIPredictionResult } from '../types';
import { calculatePoints, calculateUnderdogBonus, POINTS_EXACT, POINTS_GOAL_DIFF, POINTS_OUTCOME } from '../utils/scoring';
import { Users, Bot, Save, Trophy, Lock, Clock, Play, Zap, EyeOff, MapPin, CheckCircle } from 'lucide-react';
import { getAIPrediction } from '../services/geminiService';

interface MatchCardProps {
  match: Match;
  userPrediction?: Prediction;
  friends: Friend[];
  onPredict: (matchId: string, home: number, away: number) => void;
  isAdmin?: boolean;
  // Admin Controls
  onStartMatch?: (matchId: string) => void;
  onUpdateLiveScore?: (matchId: string, home: number, away: number) => void;
  onFinishMatch?: (matchId: string, home: number, away: number) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  userPrediction,
  friends,
  onPredict,
  isAdmin = false,
  onStartMatch,
  onUpdateLiveScore,
  onFinishMatch
}) => {
  const [showFriends, setShowFriends] = useState(false);
  const [homeInput, setHomeInput] = useState<string>('');
  const [awayInput, setAwayInput] = useState<string>('');
  
  const [isPredictingAI, setIsPredictingAI] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AIPredictionResult | null>(null);

  // Initialize inputs based on state
  useEffect(() => {
    if (isAdmin) {
        if (match.result) {
            setHomeInput(match.result.home.toString());
            setAwayInput(match.result.away.toString());
        } else {
            setHomeInput('');
            setAwayInput('');
        }
    } else {
        if (userPrediction) {
            setHomeInput(userPrediction.homeScore.toString());
            setAwayInput(userPrediction.awayScore.toString());
        }
    }
  }, [userPrediction, match.result, isAdmin, match.id]);

  const handlePredict = () => {
    if (homeInput === '' || awayInput === '') return;
    const h = parseInt(homeInput);
    const a = parseInt(awayInput);
    if (!isNaN(h) && !isNaN(a)) {
      onPredict(match.id, h, a);
    }
  };

  const handleAdminStart = () => {
      if (onStartMatch) onStartMatch(match.id);
  };

  const handleAdminUpdateLive = () => {
      if (homeInput === '' || awayInput === '' || !onUpdateLiveScore) return;
      const h = parseInt(homeInput);
      const a = parseInt(awayInput);
      onUpdateLiveScore(match.id, h, a);
  };

  const handleAdminFinish = () => {
      if (homeInput === '' || awayInput === '' || !onFinishMatch) return;
      if (window.confirm("Tem certeza que deseja encerrar o jogo? Isso calculará os pontos.")) {
          const h = parseInt(homeInput);
          const a = parseInt(awayInput);
          onFinishMatch(match.id, h, a);
      }
  };

  const handleAIPredict = async () => {
    setIsPredictingAI(true);
    setAiPrediction(null);
    const result = await getAIPrediction(match.homeTeam.name, match.awayTeam.name);
    setAiPrediction(result);
    setIsPredictingAI(false);
  };

  const applyAIPrediction = () => {
    if (aiPrediction) {
      setHomeInput(aiPrediction.homeScore.toString());
      setAwayInput(aiPrediction.awayScore.toString());
    }
  };

  const matchDate = new Date(match.date);
  const isLocked = new Date() > matchDate || match.status !== MatchStatus.SCHEDULED;
  const isLive = match.status === MatchStatus.LIVE;
  const isFinished = match.status === MatchStatus.FINISHED;
  
  const getPointsStyle = (points: number) => {
      if (points >= POINTS_EXACT) return 'bg-yellow-500 text-black border-yellow-400'; 
      if (points >= POINTS_GOAL_DIFF) return 'bg-teal-600 text-white border-teal-500'; 
      if (points >= POINTS_OUTCOME) return 'bg-blue-600 text-white border-blue-500'; 
      if (points > 0) return 'bg-indigo-600 text-white border-indigo-500'; 
      return 'bg-slate-700 text-slate-400 border-slate-600'; 
  };

  // Calculate user's points
  let pointsEarned = 0;
  let bonusEarned = 0;
  let pointsClass = '';
  
  if ((isFinished || isLive) && match.result && userPrediction) {
      pointsEarned = calculatePoints(
          userPrediction.homeScore, 
          userPrediction.awayScore, 
          match.result.home, 
          match.result.away,
          match.homeTeam.ranking,
          match.awayTeam.ranking
      );

      // Extract bonus for display
      if (pointsEarned > 0 && match.homeTeam.ranking && match.awayTeam.ranking && match.result.home !== match.result.away) {
          const winnerRank = match.result.home > match.result.away ? match.homeTeam.ranking : match.awayTeam.ranking;
          const loserRank = match.result.home > match.result.away ? match.awayTeam.ranking : match.homeTeam.ranking;
          bonusEarned = calculateUnderdogBonus(winnerRank, loserRank);
      }

      pointsClass = getPointsStyle(pointsEarned);
  }

  const basePoints = pointsEarned - bonusEarned;

  // --- FRIENDS LIST LOGIC ---
  const sortedFriends = useMemo(() => {
      const predictedFriends = friends.filter(f => f.predictions[match.id]);
      const withPoints = predictedFriends.map(friend => {
          const pred = friend.predictions[match.id];
          let currentPoints = 0;
          let friendBonus = 0;

          if ((isLive || isFinished) && match.result) {
              currentPoints = calculatePoints(
                  pred.home,
                  pred.away,
                  match.result.home,
                  match.result.away,
                  match.homeTeam.ranking,
                  match.awayTeam.ranking
              );
               if (currentPoints > 0 && match.homeTeam.ranking && match.awayTeam.ranking && match.result.home !== match.result.away) {
                  const winnerRank = match.result.home > match.result.away ? match.homeTeam.ranking : match.awayTeam.ranking;
                  const loserRank = match.result.home > match.result.away ? match.awayTeam.ranking : match.homeTeam.ranking;
                  friendBonus = calculateUnderdogBonus(winnerRank, loserRank);
               }
          }
          return { ...friend, currentMatchPoints: currentPoints, friendBonus };
      });

      return withPoints.sort((a, b) => {
          if (b.currentMatchPoints !== a.currentMatchPoints) {
              return b.currentMatchPoints - a.currentMatchPoints;
          }
          return a.name.localeCompare(b.name);
      });
  }, [friends, match.id, match.result, isLive, isFinished, match.homeTeam.ranking, match.awayTeam.ranking]);


  const renderScoreInputs = () => {
      if (!isAdmin && (isLive || isFinished)) {
          return (
             <div className="flex items-center gap-3 text-3xl font-bold font-mono animate-fadeIn">
                 <span className={isLive ? "text-white" : "text-slate-300"}>{match.result?.home ?? 0}</span>
                 <span className="text-slate-600 text-xl">x</span>
                 <span className={isLive ? "text-white" : "text-slate-300"}>{match.result?.away ?? 0}</span>
             </div>
          );
      }
      return (
        <>
            <input 
                type="number" 
                value={homeInput}
                onChange={(e) => setHomeInput(e.target.value)}
                disabled={!isAdmin && isLocked}
                placeholder={isAdmin ? (match.result?.home?.toString() || '0') : '-'}
                className={`w-12 h-10 text-center font-bold text-lg rounded-lg outline-none focus:ring-2 transition-all ${
                    isAdmin && isLive ? 'bg-red-900/30 border-red-500 text-white' :
                    isLocked && !isAdmin 
                        ? 'bg-slate-700 text-slate-400 border-transparent' 
                        : 'bg-slate-900 border border-slate-600 focus:border-brand-green focus:ring-brand-green/20'
                }`} 
            />
            <span className="text-slate-500 font-bold">x</span>
            <input 
                type="number" 
                value={awayInput}
                onChange={(e) => setAwayInput(e.target.value)}
                disabled={!isAdmin && isLocked}
                placeholder={isAdmin ? (match.result?.away?.toString() || '0') : '-'}
                className={`w-12 h-10 text-center font-bold text-lg rounded-lg outline-none focus:ring-2 transition-all ${
                    isAdmin && isLive ? 'bg-red-900/30 border-red-500 text-white' :
                    isLocked && !isAdmin
                        ? 'bg-slate-700 text-slate-400 border-transparent' 
                        : 'bg-slate-900 border border-slate-600 focus:border-brand-green focus:ring-brand-green/20'
                }`} 
            />
        </>
      );
  };

  return (
    <div className={`bg-slate-800 rounded-xl shadow-lg border overflow-hidden relative transition-colors ${isLive ? 'border-red-500/40 shadow-red-900/20' : 'border-slate-700'}`}>
      
      <div className={`px-4 py-2 flex justify-between items-center border-b ${isLive ? 'bg-red-900/20 border-red-500/30' : 'bg-slate-900/50 border-slate-700'}`}>
        <div className="flex items-center gap-2 text-xs">
           {isLive ? (
               <div className="flex items-center gap-2 text-red-400 font-bold animate-pulse">
                   <div className="w-2 h-2 rounded-full bg-red-500"></div>
                   AO VIVO
               </div>
           ) : (
               <div className="flex items-center gap-2 text-slate-400">
                    <Clock size={12} />
                    <span>{matchDate.toLocaleDateString('pt-BR')} • {matchDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
               </div>
           )}
           <span className="hidden sm:inline text-slate-500">• {match.group}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
            <MapPin size={12} />
            <span className="truncate max-w-[100px]">{match.location}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex-1 flex flex-col items-center gap-2">
                <img src={match.homeTeam.flag} alt={match.homeTeam.name} className="w-12 h-8 object-cover rounded shadow-md" />
                <span className="text-xs font-bold text-center leading-tight">{match.homeTeam.name}</span>
            </div>

            <div className="flex items-center gap-3">
                 {renderScoreInputs()}
            </div>

             <div className="flex-1 flex flex-col items-center gap-2">
                <img src={match.awayTeam.flag} alt={match.awayTeam.name} className="w-12 h-8 object-cover rounded shadow-md" />
                <span className="text-xs font-bold text-center leading-tight">{match.awayTeam.name}</span>
            </div>
        </div>
        
        <div className="flex flex-wrap justify-between items-center mt-2 gap-2">
            
            <div className="flex gap-2">
                 {(!isLocked || isAdmin) && (
                     <button 
                        onClick={handleAIPredict}
                        disabled={isPredictingAI}
                        className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 transition-colors border border-indigo-500/30"
                        title="Perguntar à IA"
                     >
                         {isPredictingAI ? <Zap size={18} className="animate-pulse" /> : <Bot size={18} />}
                     </button>
                 )}
                 <button 
                    onClick={() => setShowFriends(!showFriends)}
                    className={`p-2 rounded-lg transition-colors border ${showFriends ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    title="Ver palpites da galera"
                 >
                     <Users size={18} />
                 </button>
            </div>

            <div className="flex items-center justify-end gap-2 flex-1">
                 
                 {isAdmin ? (
                     <div className="flex items-center gap-2">
                         {!isLive && !isFinished && (
                            <button 
                                onClick={handleAdminStart}
                                className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                                <Play size={12} fill="currentColor" /> Iniciar
                            </button>
                         )}

                         {isLive && (
                             <button 
                                onClick={handleAdminUpdateLive}
                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-blue-400 animate-pulse"
                            >
                                <Zap size={12} fill="currentColor" /> Atualizar
                            </button>
                         )}

                         {(isLive || isFinished) && (
                             <button 
                                onClick={handleAdminFinish}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isFinished ? 'bg-slate-700 text-slate-400' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                            >
                                <CheckCircle size={12} /> {isFinished ? 'Reabrir / Corrigir' : 'Apito Final'}
                            </button>
                         )}
                     </div>
                 ) : (
                     <>
                        {(isFinished || (isLive && match.result)) ? (
                             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${pointsClass} transition-all`}>
                                 <Trophy size={14} />
                                 
                                 {bonusEarned > 0 ? (
                                    <span className="flex items-center gap-1">
                                        <span>{basePoints}</span>
                                        <span className="text-yellow-300 font-extrabold">+ {bonusEarned}</span>
                                    </span>
                                 ) : (
                                    <span>{pointsEarned} pts</span>
                                 )}
                                 
                                 {bonusEarned > 0 && (
                                     <span 
                                        className="flex items-center gap-0.5 text-[9px] leading-tight bg-yellow-400 text-black px-1.5 py-0.5 rounded ml-1 font-extrabold shadow-sm" 
                                        title={`Zebra! Bônus de ${bonusEarned} pontos pelo ranking`}
                                     >
                                         <Zap size={8} fill="currentColor" />
                                         ZEBRA
                                     </span>
                                 )}
                             </div>
                        ) : isLocked ? (
                             <div className="flex items-center gap-1 text-xs text-orange-400 font-bold bg-orange-900/20 px-3 py-1.5 rounded-full border border-orange-500/20">
                                 <Lock size={12} /> Palpites Encerrados
                             </div>
                        ) : (
                             <button 
                                onClick={handlePredict}
                                className="flex items-center gap-2 bg-brand-green hover:bg-emerald-400 text-slate-900 px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-brand-green/20"
                             >
                                <Save size={14} /> Salvar Palpite
                             </button>
                        )}
                     </>
                 )}
            </div>
        </div>

        {aiPrediction && (
            <div className="mt-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-3 text-sm animate-fadeIn">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-indigo-300 font-bold">
                        <Bot size={16} />
                        Sugestão do Gemini
                    </div>
                    {!isLocked && (
                        <button onClick={applyAIPrediction} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded">
                            Usar Placar
                        </button>
                    )}
                </div>
                <div className="text-center font-mono text-xl text-white font-bold mb-1">
                    {aiPrediction.homeScore} x {aiPrediction.awayScore}
                </div>
                <p className="text-indigo-200 text-xs italic">"{aiPrediction.reasoning}"</p>
            </div>
        )}

        {showFriends && (
            <div className="mt-4 pt-4 border-t border-slate-700 animate-fadeIn">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Palpites do Grupo {isLive && "(Ao Vivo)"}</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {sortedFriends.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Ninguém palpitou ainda.</p>
                    ) : (
                        sortedFriends.map(friend => {
                            const pred = friend.predictions[match.id];
                            const canSee = isLocked || isLive || isFinished || isAdmin || friend.id === 'me'; 
                            
                            const friendPointsStyle = getPointsStyle(friend.currentMatchPoints);

                            return (
                                <div key={friend.id} className="flex justify-between items-center text-sm p-2 rounded bg-slate-900/50 hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <img src={friend.avatar} alt={friend.name} className="w-6 h-6 rounded-full" />
                                            {friend.id === 'me' && <div className="absolute -bottom-1 -right-1 bg-brand-green w-2 h-2 rounded-full border border-slate-900"></div>}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-xs ${friend.id === 'me' ? 'text-brand-green font-bold' : 'text-slate-300 font-medium'}`}>
                                                {friend.name}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <div className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                            {canSee ? (
                                                `${pred.home} - ${pred.away}`
                                            ) : (
                                                <span className="flex items-center gap-1 text-slate-500 text-xs">
                                                    <EyeOff size={10} />
                                                </span>
                                            )}
                                        </div>

                                        {(isLive || isFinished) && match.result && (
                                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${friendPointsStyle} min-w-[30px] text-center flex items-center gap-1`}>
                                                {friend.currentMatchPoints}
                                                {friend.friendBonus > 0 && <span className="text-yellow-300 text-[8px]">+Z</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default MatchCard;
