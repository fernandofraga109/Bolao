import React, { useMemo } from "react";
import { User, Match, MatchStatus } from "../types";
import { Target, Zap, TrendingUp, Trophy, BarChart3, Activity } from "lucide-react";

interface UserStatsProps {
  user: User;
  matches: Match[];
}

const UserStats: React.FC<UserStatsProps> = ({ user, matches }) => {
  const stats = useMemo(() => {
    const finishedMatches = matches.filter(m => m.status === MatchStatus.FINISHED);
    const predictions = user.predictions || {};
    
    let exactScores = 0;
    let correctResults = 0; // Outcome (win/draw/loss)
    let bonusZebras = 0;
    let totalPoints = 0;
    let gamesPredicted = 0;

    finishedMatches.forEach(match => {
      const pred = predictions[match.id];
      if (!pred || !match.result) return;
      
      gamesPredicted++;
      const pts = pred.points || 0;
      totalPoints += pts;

      // Exact score check
      if (pred.home === match.result.home && pred.away === match.result.away) {
        exactScores++;
      }
      
      // Outcome check
      const actualOutcome = Math.sign(match.result.home - match.result.away);
      const predictedOutcome = Math.sign(pred.home - pred.away);
      if (actualOutcome === predictedOutcome) {
        correctResults++;
      }

      // Bonus check (mock logic based on points > 15 usually includes bonus)
      if (pts > 15) bonusZebras++;
    });

    const accuracy = gamesPredicted > 0 ? (correctResults / gamesPredicted) * 100 : 0;
    const exactRate = gamesPredicted > 0 ? (exactScores / gamesPredicted) * 100 : 0;

    return {
      totalPoints,
      gamesPredicted,
      exactScores,
      correctResults,
      bonusZebras,
      accuracy: accuracy.toFixed(1),
      exactRate: exactRate.toFixed(1),
      avgPoints: gamesPredicted > 0 ? (totalPoints / gamesPredicted).toFixed(1) : "0",
    };
  }, [user.predictions, matches]);

  return (
    <div className="w-full max-w-2xl mx-auto pb-10 animate-fadeIn">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-brand-green to-emerald-800 p-8 rounded-3xl mb-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-10 -mt-10"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-brand-dark tracking-tighter mb-1 uppercase">Meu Desempenho</h2>
          <p className="text-brand-dark/70 text-xs font-bold uppercase tracking-widest">Análise detalhada de seus palpites</p>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-xl">
           <div className="bg-brand-green/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
              <Target size={20} className="text-brand-green" />
           </div>
           <div className="text-3xl font-black text-white leading-none mb-1">{stats.accuracy}%</div>
           <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Acurácia de Resultado</div>
        </div>
        
        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-xl">
           <div className="bg-brand-blue/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
              <Trophy size={20} className="text-brand-blue" />
           </div>
           <div className="text-3xl font-black text-white leading-none mb-1">{stats.exactScores}</div>
           <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Placares Exatos</div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-xl">
           <div className="bg-yellow-500/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
              <Zap size={20} className="text-yellow-400" />
           </div>
           <div className="text-3xl font-black text-white leading-none mb-1">{stats.bonusZebras}</div>
           <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bônus de Zebra</div>
        </div>

        <div className="bg-brand-blue/10 backdrop-blur-md p-6 rounded-3xl border border-brand-blue/20 shadow-xl">
           <div className="bg-white/10 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
              <TrendingUp size={20} className="text-white" />
           </div>
           <div className="text-3xl font-black text-white leading-none mb-1">{stats.avgPoints}</div>
           <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Média pts / Jogo</div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-3xl border border-white/5 shadow-xl mb-8">
         <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
           <BarChart3 size={18} className="text-brand-green" />
           Distribuição de Performance
         </h3>
         
         <div className="space-y-6">
            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-black text-slate-400 uppercase">Frequência de Placar Exato</span>
                <span className="text-xs font-black text-white">{stats.exactRate}%</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-brand-green to-emerald-400 transition-all duration-1000"
                  style={{ width: `${stats.exactRate}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-black text-slate-400 uppercase">Taxa de Acerto Geral</span>
                <span className="text-xs font-black text-white">{stats.accuracy}%</span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-brand-blue to-indigo-600 transition-all duration-1000"
                  style={{ width: `${stats.accuracy}%` }}
                ></div>
              </div>
            </div>
         </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center gap-3 p-6 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
         <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
            <Activity size={20} className="text-slate-600" />
         </div>
         <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Resumo de Atividade</p>
            <p className="text-xs font-bold text-slate-400">Você participou de <span className="text-white">{stats.gamesPredicted}</span> jogos finalizados até agora.</p>
         </div>
      </div>
    </div>
  );
};

export default UserStats;
