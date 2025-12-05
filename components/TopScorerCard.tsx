import React, { useState, useEffect, useRef } from 'react';
import { TournamentPredictions } from '../types';
import { Trophy, Lock, Save, Medal, Award, Shield, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { 
    POINTS_TOP_SCORER_GOALS, 
    POINTS_TOP_SCORER_NAME, 
    POINTS_CHAMPION, 
    POINTS_BEST_PLAYER, 
    POINTS_BEST_GOALKEEPER,
    calculateTournamentPoints
} from '../utils/scoring';
import { TEAMS } from '../constants';

interface TopScorerCardProps {
  prediction?: TournamentPredictions;
  onPredict: (data: TournamentPredictions) => void;
  lockDate: Date;
  finalResult?: TournamentPredictions;
}

const TopScorerCard: React.FC<TopScorerCardProps> = ({
  prediction,
  onPredict,
  lockDate,
  finalResult
}) => {
  // Collapse State
  const [isExpanded, setIsExpanded] = useState(false);

  // Form State
  const [championId, setChampionId] = useState(prediction?.championTeamId || '');
  const [tsPlayer, setTsPlayer] = useState(prediction?.topScorer?.player || '');
  const [tsGoals, setTsGoals] = useState(prediction?.topScorer?.goals?.toString() || '');
  const [bestPlayer, setBestPlayer] = useState(prediction?.bestPlayer || '');
  const [bestGk, setBestGk] = useState(prediction?.bestGoalkeeper || '');

  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isLocked, setIsLocked] = useState(false);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const checkLock = () => {
      const now = new Date();
      setIsLocked(now >= lockDate);
    };
    checkLock();
    const timer = setInterval(checkLock, 60000); 
    return () => clearInterval(timer);
  }, [lockDate]);

  const handleSave = () => {
    onPredict({
        championTeamId: championId || undefined,
        topScorer: (tsPlayer || tsGoals) ? { 
            player: tsPlayer, 
            goals: tsGoals ? parseInt(tsGoals) : 0 
        } : undefined,
        bestPlayer: bestPlayer || undefined,
        bestGoalkeeper: bestGk || undefined
    });
    // Optional: collapse after save
    // setIsExpanded(false); 
  };

  // Helper to check correctness for UI Highlights
  const isChampionCorrect = finalResult?.championTeamId && championId === finalResult.championTeamId;
  const isTsNameCorrect = finalResult?.topScorer?.player && tsPlayer.toLowerCase() === finalResult.topScorer.player.toLowerCase();
  const isTsGoalsCorrect = finalResult?.topScorer?.goals && parseInt(tsGoals) === finalResult.topScorer.goals;
  const isBestPlayerCorrect = finalResult?.bestPlayer && bestPlayer.toLowerCase() === finalResult.bestPlayer.toLowerCase();
  const isBestGkCorrect = finalResult?.bestGoalkeeper && bestGk.toLowerCase() === finalResult.bestGoalkeeper.toLowerCase();

  const totalPoints = calculateTournamentPoints(
      { championTeamId: championId, topScorer: { player: tsPlayer, goals: parseInt(tsGoals) || 0 }, bestPlayer, bestGoalkeeper: bestGk },
      finalResult
  );

  const selectedTeam = championId ? TEAMS[championId] : null;

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg mb-8 border border-slate-700 relative">
      
      {/* Header - Always Visible & Clickable */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full bg-gradient-to-r from-indigo-900 to-slate-900 px-4 py-3 border-b border-indigo-500/20 flex justify-between items-center transition-colors hover:bg-slate-800 rounded-t-xl ${!isExpanded ? 'rounded-b-xl' : ''}`}
      >
        <div className="flex items-center gap-2 text-white font-bold">
            <Trophy size={20} className="text-yellow-400" />
            <div className="text-left">
                <h3 className="tracking-wide text-sm md:text-base">PALPITES ESPECIAIS</h3>
                <span className="text-[10px] text-slate-400 font-normal block">
                    {isLocked ? 'Encerrado (Início da Copa)' : `Encerra em: ${lockDate.toLocaleDateString('pt-BR')} às ${lockDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`}
                </span>
            </div>
        </div>
        <div className="flex items-center gap-3">
            {isLocked && (
                 <div className="flex items-center gap-1 text-xs font-bold text-orange-400 bg-orange-950/50 px-2 py-1 rounded border border-orange-500/30">
                    <Lock size={12} /> FECHADO
                </div>
            )}
            {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </div>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
          <div className="p-4 space-y-4 animate-fadeIn">
            
            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Champion (Custom Dropdown) */}
                <div className={`bg-slate-900/50 p-3 rounded-lg border ${isChampionCorrect ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-2 text-yellow-500">
                        <Trophy size={16} />
                        <label className="text-xs font-bold uppercase">Seleção Campeã</label>
                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">100 pts</span>
                    </div>
                    
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => !isLocked && setIsDropdownOpen(!isDropdownOpen)}
                            disabled={isLocked}
                            className={`w-full bg-slate-800 border ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'} border-slate-600 rounded px-3 py-2 text-sm text-white flex items-center justify-between focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all`}
                        >
                            {selectedTeam ? (
                                <div className="flex items-center gap-2">
                                    <img src={selectedTeam.flag} alt={selectedTeam.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />
                                    <span>{selectedTeam.name}</span>
                                </div>
                            ) : (
                                <span className="text-slate-400">Selecione...</span>
                            )}
                            {!isLocked && <ChevronDown size={14} className="text-slate-400" />}
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && !isLocked && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                                {Object.values(TEAMS).map((team) => (
                                    <button
                                        key={team.id}
                                        onClick={() => {
                                            setChampionId(team.id);
                                            setIsDropdownOpen(false);
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-0"
                                    >
                                        <img src={team.flag} alt={team.name} className="w-6 h-4 object-cover rounded shadow-sm" />
                                        <span>{team.name}</span>
                                        {championId === team.id && <Check size={14} className="ml-auto text-brand-green" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {isChampionCorrect && <div className="text-yellow-400 text-xs font-bold mt-1 text-right">✓ Acertou!</div>}
                </div>

                {/* 2. Top Scorer */}
                <div className={`bg-slate-900/50 p-3 rounded-lg border ${(isTsNameCorrect || isTsGoalsCorrect) ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                        <Medal size={16} />
                        <label className="text-xs font-bold uppercase">Artilheiro</label>
                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">100+100 pts</span>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <input 
                                type="text" 
                                placeholder="Nome"
                                value={tsPlayer}
                                onChange={(e) => setTsPlayer(e.target.value)}
                                disabled={isLocked}
                                className={`w-full bg-slate-800 border ${isTsNameCorrect ? 'border-brand-green' : 'border-slate-600'} rounded px-3 py-2 text-sm text-white focus:border-amber-500 outline-none placeholder:text-slate-600`} 
                            />
                        </div>
                        <div className="w-16">
                            <input 
                                type="number" 
                                placeholder="Gols"
                                value={tsGoals}
                                onChange={(e) => setTsGoals(e.target.value)}
                                disabled={isLocked}
                                className={`w-full bg-slate-800 border ${isTsGoalsCorrect ? 'border-brand-green' : 'border-slate-600'} rounded px-2 py-2 text-sm text-white focus:border-amber-500 outline-none text-center`} 
                            />
                        </div>
                    </div>
                    {(isTsNameCorrect || isTsGoalsCorrect) && <div className="text-amber-400 text-xs font-bold mt-1 text-right">✓ Pontuou!</div>}
                </div>

                {/* 3. Best Player */}
                <div className={`bg-slate-900/50 p-3 rounded-lg border ${isBestPlayerCorrect ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-2 text-blue-400">
                        <Award size={16} />
                        <label className="text-xs font-bold uppercase">Melhor Jogador</label>
                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">100 pts</span>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Bola de Ouro da Copa"
                        value={bestPlayer}
                        onChange={(e) => setBestPlayer(e.target.value)}
                        disabled={isLocked}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none placeholder:text-slate-600" 
                    />
                    {isBestPlayerCorrect && <div className="text-blue-400 text-xs font-bold mt-1 text-right">✓ Acertou!</div>}
                </div>

                {/* 4. Best GK */}
                <div className={`bg-slate-900/50 p-3 rounded-lg border ${isBestGkCorrect ? 'border-teal-500/50 bg-teal-500/10' : 'border-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-2 text-teal-400">
                        <Shield size={16} />
                        <label className="text-xs font-bold uppercase">Melhor Goleiro</label>
                        <span className="ml-auto text-[10px] bg-slate-800 px-1.5 rounded text-slate-400">100 pts</span>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Luva de Ouro"
                        value={bestGk}
                        onChange={(e) => setBestGk(e.target.value)}
                        disabled={isLocked}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-teal-500 outline-none placeholder:text-slate-600" 
                    />
                    {isBestGkCorrect && <div className="text-teal-400 text-xs font-bold mt-1 text-right">✓ Acertou!</div>}
                </div>

            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2">
                
                {finalResult && totalPoints > 0 ? (
                    <div className="flex items-center gap-2 text-brand-green font-bold text-sm bg-brand-green/10 px-3 py-1.5 rounded-full border border-brand-green/30 w-full justify-center">
                        <Trophy size={14} />
                        Você ganhou {totalPoints} pontos nestes palpites!
                    </div>
                ) : (
                    !isLocked && (
                        <button 
                            onClick={handleSave}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors shadow-lg shadow-indigo-900/20"
                        >
                            <Save size={16} />
                            Salvar Palpites Especiais
                        </button>
                    )
                )}
            </div>

          </div>
      )}
    </div>
  );
};

export default TopScorerCard;