import React, { useState, useEffect } from 'react';
import { Match, MatchStatus, Prediction, Friend, AIPredictionResult } from '../types';
import { calculatePoints, calculateUnderdogBonus, POINTS_EXACT, POINTS_GOAL_DIFF, POINTS_OUTCOME } from '../utils/scoring';
import { Users, Bot, ChevronDown, ChevronUp, Save, Trophy, Lock, Clock, Settings, CheckCircle, Zap, EyeOff, MapPin } from 'lucide-react';
import { getAIPrediction } from '../services/geminiService';

interface MatchCardProps {
  match: Match;
  userPrediction?: Prediction;
  friends: Friend[];
  onPredict: (matchId: string, home: number, away: number) => void;
  isAdmin?: boolean;
  onUpdateScore?: (matchId: string, home: number, away: number) => void;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  userPrediction,
  friends,
  onPredict,
  isAdmin = false,
  onUpdateScore
}) => {
  const [showFriends, setShowFriends] = useState(false);
  const [homeInput, setHomeInput] = useState<string>(userPrediction?.homeScore.toString() || '');
  const [awayInput, setAwayInput] = useState<string>(userPrediction?.awayScore.toString() || '');
  const [isPredictingAI, setIsPredictingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AIPredictionResult | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Admin State
  const [adminHome, setAdminHome] = useState<string>(match.result?.home.toString() || '');
  const [adminAway, setAdminAway] = useState<string>(match.result?.away.toString() || '');

  const isFinished = match.status === MatchStatus.FINISHED;
  const hasUserPredicted = userPrediction !== undefined;

  // Sync admin state with props
  useEffect(() => {
    if (match.result) {
        setAdminHome(match.result.home.toString());
        setAdminAway(match.result.away.toString());
    }
  }, [match.result]);

  // Check for lock condition (5 minutes before match)
  useEffect(() => {
    const checkLock = () => {
      const matchDate = new Date(match.date);
      const now = new Date();
      // Lock if match status is not scheduled OR current time is past (match time - 5 minutes)
      const lockTime = new Date(matchDate.getTime() - 5 * 60000); // 5 minutes in ms
      
      const locked = match.status !== MatchStatus.SCHEDULED || now >= lockTime;
      setIsLocked(locked);
    };

    checkLock();
    // Re-check every minute
    const timer = setInterval(checkLock, 60000);
    return () => clearInterval(timer);
  }, [match.date, match.status]);

  // Logic: Can view other people's predictions?
  // Only if Admin OR Match is Locked/Live/Finished
  const canViewOthers = isAdmin || isLocked || isFinished || match.status === MatchStatus.LIVE;

  // Calculate points for user if match is finished
  const userPoints = (isFinished && hasUserPredicted && match.result && !isAdmin)
    ? calculatePoints(
        userPrediction.homeScore, 
        userPrediction.awayScore, 
        match.result.home, 
        match.result.away,
        match.homeTeam.ranking,
        match.awayTeam.ranking
      )
    : null;

  // Calculate Potential Bonus (for display while predicting)
  const potentialBonus = (() => {
      if (isFinished || isAdmin || homeInput === '' || awayInput === '') return 0;
      const h = parseInt(homeInput);
      const a = parseInt(awayInput);
      if (isNaN(h) || isNaN(a) || h === a) return 0; // No bonus for draws usually

      const predictedWinnerRank = h > a ? match.homeTeam.ranking : match.awayTeam.ranking;
      const predictedLoserRank = h > a ? match.awayTeam.ranking : match.homeTeam.ranking;

      return calculateUnderdogBonus(predictedWinnerRank, predictedLoserRank);
  })();

  const handleSave = () => {
    if (homeInput === '' || awayInput === '') return;
    onPredict(match.id, parseInt(homeInput), parseInt(awayInput));
    if (!showFriends) setShowFriends(true);
  };

  const handleAdminSave = () => {
      if (adminHome === '' || adminAway === '') return;
      if (onUpdateScore) {
          onUpdateScore(match.id, parseInt(adminHome), parseInt(adminAway));
      }
  };

  const handleAIHelp = async () => {
    setIsPredictingAI(true);
    const result = await getAIPrediction(match.homeTeam.name, match.awayTeam.name);
    if (result) {
        setAiResult(result);
        setHomeInput(result.homeScore.toString());
        setAwayInput(result.awayScore.toString());
    }
    setIsPredictingAI(false);
  };

  const getPointsBadgeColor = (pts: number) => {
    // Logic needs adjustment because points can now be weird numbers (e.g. 13)
    if (pts >= POINTS_EXACT) return 'bg-yellow-500 text-black border border-yellow-600'; // Exact + potentially bonus
    if (pts >= POINTS_GOAL_DIFF) return 'bg-teal-600 text-white border border-teal-400';
    if (pts >= POINTS_OUTCOME) return 'bg-blue-600 text-white border border-blue-400';
    return 'bg-red-500/80 text-white';
  };

  const getPointsLabel = (pts: number) => {
    // We check against the base constants to guess what happened
    // This is approximate for display purposes
    const isBonusLikely = (pts % 1 !== 0) || (pts > POINTS_EXACT && pts !== POINTS_EXACT) || (pts > POINTS_GOAL_DIFF && pts < POINTS_EXACT);

    let baseLabel = '';
    if (pts >= POINTS_EXACT) baseLabel = 'Cravou';
    else if (pts >= POINTS_GOAL_DIFF) baseLabel = 'Saldo';
    else if (pts >= POINTS_OUTCOME) baseLabel = 'Vencedor';
    
    return baseLabel ? ` (${baseLabel}${isBonusLikely ? ' + Zebra!' : '!'})` : '';
  };

  const inputsDisabled = isFinished || isLocked;

  // Filter out friends without predictions for this specific match to keep UI clean
  // SORT by totalPoints (descending) so leaders appear first
  const visibleFriends = friends
    .filter(f => f.predictions[match.id])
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 mb-6 relative group/card">
      
      {/* Header: Date & Status & Group Name */}
      <div className="bg-slate-900/50 px-4 py-2 flex justify-between items-center text-xs text-slate-400 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <span>{new Date(match.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {!isAdmin && isLocked && !isFinished && (
            <span className="flex items-center gap-1 text-orange-400 font-bold ml-2">
              <Lock size={10} /> Palpites Encerrados
            </span>
          )}
          {isAdmin && isFinished && (
            <span className="flex items-center gap-1 text-green-400 font-bold ml-2">
               Finalizado
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
            <span className="uppercase tracking-wider font-semibold">{match.group}</span>
        </div>
      </div>
      
      {/* Stadium/Location Sub-header */}
      {match.location && (
        <div className="bg-slate-900/30 px-4 py-1.5 flex items-center justify-center text-[10px] text-slate-500 gap-1 border-b border-slate-700/30">
            <MapPin size={10} />
            <span className="uppercase tracking-wide">{match.location}</span>
        </div>
      )}

      {/* Teams & Score Input */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          
          {/* Home Team */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div className="relative">
                <img 
                    src={match.homeTeam.flag} 
                    alt={match.homeTeam.name} 
                    className="w-14 h-9 object-cover rounded shadow-md mb-2" 
                />
                <span className="absolute -top-2 -left-2 bg-slate-700 text-slate-300 text-[9px] w-5 h-5 flex items-center justify-center rounded-full border border-slate-600" title={`Ranking FIFA: ${match.homeTeam.ranking}`}>
                    {match.homeTeam.ranking}
                </span>
            </div>
            <span className="font-bold text-center text-sm md:text-base text-white truncate w-full px-1">{match.homeTeam.name}</span>
          </div>

          {/* Score Board / Inputs */}
          <div className="flex flex-col items-center shrink-0 min-w-[100px] px-1">
            
            <div className="text-xs text-slate-400 mb-1 uppercase tracking-widest flex items-center gap-1 justify-center whitespace-nowrap">
                {isAdmin ? (
                    <span className="text-red-400 font-bold">Placar Oficial</span>
                ) : (
                    (isFinished && match.result) ? 'Placar Final' : (isLocked ? <><Lock size={10} /> Palpite</> : 'Palpite')
                )}
            </div>

            <div className="flex items-center justify-center gap-2">
              {isAdmin ? (
                  // ADMIN VIEW: Always Editable Official Score
                  <>
                    <input 
                        type="number" 
                        min="0"
                        value={adminHome}
                        onChange={(e) => setAdminHome(e.target.value)}
                        className="w-12 h-10 text-center rounded bg-slate-900 border border-red-500/50 text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-red-500 font-bold">x</span>
                    <input 
                        type="number" 
                        min="0"
                        value={adminAway}
                        onChange={(e) => setAdminAway(e.target.value)}
                        className="w-12 h-10 text-center rounded bg-slate-900 border border-red-500/50 text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </>
              ) : (
                  // USER VIEW: Prediction Inputs OR Static Result
                  (isFinished && match.result) ? (
                    <div className="text-2xl md:text-3xl font-mono font-bold text-white tracking-widest mb-2 whitespace-nowrap">
                      {match.result.home} - {match.result.away}
                    </div>
                  ) : (
                    <>
                        <input 
                            type="number" 
                            min="0"
                            value={homeInput}
                            onChange={(e) => setHomeInput(e.target.value)}
                            disabled={inputsDisabled}
                            className={`w-12 h-10 text-center rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-brand-green 
                            ${inputsDisabled ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-slate-700 text-white'}`}
                        />
                        <span className="text-slate-500">x</span>
                        <input 
                            type="number" 
                            min="0"
                            value={awayInput}
                            onChange={(e) => setAwayInput(e.target.value)}
                            disabled={inputsDisabled}
                            className={`w-12 h-10 text-center rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-brand-green 
                            ${inputsDisabled ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed' : 'bg-slate-700 text-white'}`}
                        />
                    </>
                  )
              )}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center flex-1 min-w-0">
            <div className="relative">
                <img 
                    src={match.awayTeam.flag} 
                    alt={match.awayTeam.name} 
                    className="w-14 h-9 object-cover rounded shadow-md mb-2" 
                />
                <span className="absolute -top-2 -right-2 bg-slate-700 text-slate-300 text-[9px] w-5 h-5 flex items-center justify-center rounded-full border border-slate-600" title={`Ranking FIFA: ${match.awayTeam.ranking}`}>
                    {match.awayTeam.ranking}
                </span>
            </div>
            <span className="font-bold text-center text-sm md:text-base text-white truncate w-full px-1">{match.awayTeam.name}</span>
          </div>
        </div>

        {/* Potential Bonus Indicator */}
        {!isFinished && potentialBonus > 0 && !isAdmin && (
            <div className="flex justify-center mt-2 animate-pulse">
                <div className="text-[10px] font-bold text-amber-400 flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/30">
                    <Zap size={10} fill="currentColor" />
                    Bônus Zebra Ativo: +{potentialBonus} pts se acertar
                </div>
            </div>
        )}

        {/* User Points Badge (Hide for Admin) */}
        {!isAdmin && userPoints !== null && (
            <div className="flex justify-center mt-3">
                <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${getPointsBadgeColor(userPoints)}`}>
                    <Trophy size={12} />
                    {userPoints} Pontos
                    {getPointsLabel(userPoints)}
                </div>
            </div>
        )}

        {/* Actions */}
        {isAdmin ? (
            <div className="flex justify-center mt-4">
                 <button 
                    onClick={handleAdminSave}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors shadow-lg shadow-red-900/20"
                 >
                    <CheckCircle size={16} />
                    {isFinished ? 'Atualizar Placar' : 'Finalizar Jogo'}
                 </button>
            </div>
        ) : (
            !isFinished && !isLocked && (
                <div className="flex justify-center gap-3 mt-4">
                    <button 
                        onClick={handleAIHelp}
                        disabled={isPredictingAI}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                    >
                        <Bot size={14} />
                        {isPredictingAI ? 'Pensando...' : 'Pedir ao Gemini'}
                    </button>
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-green hover:bg-emerald-400 text-slate-900 text-xs font-bold transition-colors"
                    >
                        <Save size={14} />
                        Salvar Palpite
                    </button>
                </div>
            )
        )}

        {/* Locked State Message (Hide for Admin) */}
        {!isAdmin && isLocked && !isFinished && (
             <div className="flex justify-center mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-400 text-xs font-medium">
                    <Clock size={14} />
                    Palpites encerrados (menos de 5 min)
                </div>
             </div>
        )}

        {/* AI Reasoning Text (Hide for Admin) */}
        {!isAdmin && aiResult && !isFinished && (
            <div className="mt-3 p-2 bg-indigo-900/30 border border-indigo-500/30 rounded text-xs text-indigo-200 text-center italic">
                "{aiResult.reasoning}"
            </div>
        )}
      </div>

      {/* Footer: Friends Accordion */}
      {friends.length > 0 && (
          <div className="border-t border-slate-700">
            <button 
            onClick={() => setShowFriends(!showFriends)}
            className="w-full flex items-center justify-between px-4 py-3 text-slate-400 hover:bg-slate-700/50 transition-colors text-sm"
            >
            <div className="flex items-center gap-2">
                <Users size={16} />
                <span>Palpites da Galera ({friends.length})</span>
            </div>
            {showFriends ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showFriends && (
            <div className="px-4 pb-4 space-y-2 bg-slate-900/30">
                {!canViewOthers ? (
                    <div className="flex flex-col items-center justify-center py-4 text-slate-500 gap-2 text-center animate-fadeIn">
                        <EyeOff size={24} className="opacity-50" />
                        <div>
                            <p className="text-sm font-semibold text-slate-400">Palpites Ocultos</p>
                            <p className="text-xs max-w-[250px] mx-auto opacity-70">
                                Para garantir a emoção, os palpites dos outros participantes só serão revelados quando o jogo começar.
                            </p>
                        </div>
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded-full mt-1 border border-slate-700">
                            {visibleFriends.length} pessoas já palpitaram
                        </span>
                    </div>
                ) : (
                    visibleFriends.length === 0 ? (
                        <div className="text-center text-xs text-slate-500 py-2">Ninguém palpitou ainda.</div>
                    ) : (
                        visibleFriends.map(friend => {
                            const isMe = friend.id === 'me';
                            const friendPred = friend.predictions[match.id];
                            const friendPoints = (match.result && friendPred) 
                                ? calculatePoints(
                                    friendPred.home, 
                                    friendPred.away, 
                                    match.result.home, 
                                    match.result.away,
                                    match.homeTeam.ranking,
                                    match.awayTeam.ranking
                                )
                                : null;

                            return (
                                <div key={friend.id} className={`flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0 ${isMe ? 'bg-indigo-500/10 -mx-4 px-4 border-indigo-500/30' : ''}`}>
                                    <div className="flex items-center gap-2">
                                    <img src={friend.avatar} alt={friend.name} className={`w-6 h-6 rounded-full ${isMe ? 'ring-1 ring-brand-green' : ''}`} />
                                    <div className="flex flex-col">
                                        <span className={`text-sm leading-none ${isMe ? 'text-brand-green font-semibold' : 'text-slate-300'}`}>
                                            {friend.name} {isMe && '(Você)'}
                                        </span>
                                        <span className="text-[10px] text-slate-500 mt-0.5">{friend.totalPoints} pts no ranking</span>
                                    </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`font-mono font-bold ${isMe ? 'text-white' : 'text-slate-200'}`}>
                                            {friendPred ? `${friendPred.home} - ${friendPred.away}` : '-'}
                                        </span>
                                        {friendPoints !== null && isFinished && (
                                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getPointsBadgeColor(friendPoints)}`}>
                                                {friendPoints}pts
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </div>
            )}
        </div>
      )}
    </div>
  );
};

export default MatchCard;