import React, { useState } from "react";
import { Friend } from "../types";
import { Trophy, Medal, TrendingUp, TrendingDown, Minus, Search, BarChart3 } from "lucide-react";
import AvatarWithFallback from "./ui/AvatarWithFallback";
import LeaderboardDetails from "./LeaderboardDetails";

interface LeaderboardProps {
  sections: {
    groupId: string;
    groupName: string;
    competitionCode?: string;
    users: Friend[];
  }[];
  ruleset?: "regulamento_1" | "regulamento_2";
  onUserClick?: (user: Friend) => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ sections, ruleset = "regulamento_1", onUserClick }) => {
  const [activeView, setActiveView] = useState<"ranking" | "details">("ranking");
  const sectionsWithSortedUsers = sections.map((section) => {
    const sorted = [...section.users].sort((a, b) => b.totalPoints - a.totalPoints);
    let currentRank = 0;
    let lastPoints = -1;

    const usersWithRanks = sorted.map((user, index) => {
      // Standard competition ranking ("1224"): empatados dividem a mesma
      // posição e a próxima posição pula pela quantidade de empatados.
      // Ex.: 2 em 1º, próximo é 3º (não 2º).
      if (user.totalPoints !== lastPoints) {
        currentRank = index + 1;
        lastPoints = user.totalPoints;
      }
      return { ...user, rank: currentRank };
    });

    return { ...section, users: usersWithRanks };
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="text-brand-gold w-6 h-6 animate-bounce-slow drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />;
      case 2:
        return <Medal className="text-slate-300 w-6 h-6" />;
      case 3:
        return <Medal className="text-amber-600 w-6 h-6" />;
      default:
        return (
          <span className="text-slate-500 font-bold w-6 text-center">
            {rank}
          </span>
        );
    }
  };

  const getRankRowStyle = (rank: number, isMe: boolean) => {
    if (isMe) return "bg-brand-green/5";
    if (rank === 1) return "bg-brand-gold/5";
    if (rank === 2) return "bg-white/[0.02]";
    if (rank === 3) return "bg-amber-900/10";
    return "";
  };

  const getRankAccent = (rank: number) => {
    if (rank === 1) return "border-l-2 border-brand-gold/50";
    if (rank === 2) return "border-l-2 border-slate-400/25";
    if (rank === 3) return "border-l-2 border-amber-600/30";
    return "border-l-2 border-transparent";
  };

  // Mock variation based on userId to demonstrate UI
  // In a real app, this would come from a 'previous_rank' field in user_groups
  const getVariation = (userId: string, index: number) => {
    const charCodeSum = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mod = charCodeSum % 10;
    
    if (mod < 2) return { icon: <TrendingUp size={10} />, color: "text-emerald-400", text: "+1" };
    if (mod > 8) return { icon: <TrendingDown size={10} />, color: "text-red-400", text: "-1" };
    return { icon: <Minus size={10} />, color: "text-slate-600", text: "" };
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-8">
      <div className="bg-gradient-to-br from-brand-dark via-brand-dark to-brand-blue/20 p-5 sm:p-8 rounded-3xl mb-6 shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/5 blur-3xl rounded-full -mr-20 -mt-20"></div>
        <div className="relative">
          <h2 className="text-3xl font-black text-white tracking-tight mb-3">CLASSIFICAÇÃO</h2>

          {/* Toggle - linha própria para melhor visibilidade em mobile */}
          <div className="flex bg-slate-900/60 rounded-xl p-1 border border-slate-700/50 mb-3">
            <button
              onClick={() => setActiveView("ranking")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wider transition-all ${
                activeView === "ranking"
                  ? "bg-brand-green text-brand-dark shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Trophy size={16} />
              <span>Ranking</span>
            </button>
            <button
              onClick={() => setActiveView("details")}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wider transition-all ${
                activeView === "details"
                  ? "bg-brand-green text-brand-dark shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <BarChart3 size={16} />
              <span>Detalhes</span>
            </button>
          </div>

          <p className="text-slate-400 text-sm font-medium">
            {activeView === "ranking"
              ? "Acompanhe a disputa em tempo real"
              : "Detalhamento de acertos por jogador"}
          </p>
          {activeView === "ranking" && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-widest px-2 py-0.5 bg-brand-green/10 rounded-full border border-brand-green/20">
                * Barra indica % de pontos em relação ao 1º colocado
              </span>
            </div>
          )}
        </div>
      </div>

      {activeView === "details" && (
        <LeaderboardDetails
          sections={sections}
          ruleset={ruleset}
          onUserClick={onUserClick}
        />
      )}

      {activeView === "ranking" && (
      <>
      {sectionsWithSortedUsers.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden shadow-xl border border-slate-700/50 p-12 text-center">
          <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
             <Trophy size={32} className="text-slate-500" />
          </div>
          <p className="text-slate-300 font-medium">Entre em um grupo para visualizar a classificação.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sectionsWithSortedUsers.map((section) => {
            const maxPoints = section.users.length > 0 ? section.users[0].totalPoints : 0;
            
            return (
              <div
                key={section.groupId}
                className="bg-slate-800/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50"
              >
                <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-700/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-brand-blue/20 p-2 rounded-lg">
                       <Trophy size={16} className="text-brand-blue" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white tracking-tight">{section.groupName}</h3>
                      {section.competitionCode && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-green">
                          {section.competitionCode}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-900 px-2 py-1 rounded-full border border-slate-700/50 text-center">
                    {section.users.length}<br className="sm:hidden" /><span className="hidden sm:inline"> </span>PART.
                  </span>
                </div>

                <div className="divide-y divide-slate-700/30">
                  {section.users.map((user, index) => {
                    const variation = getVariation(user.id, index);
                    const progress = maxPoints > 0 ? (user.totalPoints / maxPoints) * 100 : 0;
                    
                    return (
                      <div
                        key={user.id}
                        className={`group relative flex items-center justify-between px-3 py-3 sm:p-5 gap-2 transition-all ${getRankRowStyle(user.rank, user.id === "me")} ${getRankAccent(user.rank)} ${onUserClick ? "cursor-pointer hover:bg-slate-700/30" : "hover:bg-slate-700/20"}`}
                        onClick={() => onUserClick?.(user)}
                      >
                        <div className="flex items-center gap-2 sm:gap-5 z-10 min-w-0">
                          <div className="flex flex-col items-center justify-center w-6 sm:w-8 shrink-0">
                            {getRankIcon(user.rank)}
                            <div className={`mt-1 flex items-center gap-0.5 text-[9px] font-bold ${variation.color}`}>
                               {variation.icon}
                               {variation.text}
                            </div>
                          </div>
                          
                          <div className="relative shrink-0">
                            <AvatarWithFallback
                              src={user.avatar}
                              alt={user.name}
                              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full border-2 transition-transform group-hover:scale-105 ${user.id === "me" ? "border-brand-green shadow-lg shadow-brand-green/20" : "border-slate-700 shadow-lg"}`}
                              fallbackClassName={`${user.id === "me" ? "bg-slate-700 text-brand-green" : "bg-slate-700 text-slate-300"}`}
                              iconSize={20}
                            />
                            {user.id === "me" && (
                              <div className="absolute -bottom-1 -right-1 bg-brand-green text-brand-dark text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-md border border-brand-dark">
                                EU
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col min-w-0">
                            <h3
                              className={`font-bold tracking-tight truncate ${user.id === "me" ? "text-brand-green" : "text-slate-100"}`}
                            >
                              {user.name}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                                  {user.predictionsCount ?? Object.keys(user.predictions).length} palpites
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className="w-14 sm:w-24 h-1 bg-slate-700/50 rounded-full overflow-hidden mt-0.5 shrink-0">
                                     <div 
                                       className={`h-full rounded-full transition-all duration-1000 ${user.id === "me" ? "bg-brand-green" : "bg-brand-blue"}`}
                                       style={{ width: `${progress}%` }}
                                     ></div>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-500">{Math.round(progress)}%</span>
                                </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-right z-10 flex items-center gap-1.5 shrink-0">
                          <div className="flex items-baseline justify-end gap-1">
                            <span className={`text-xl sm:text-2xl font-black leading-none ${user.rank === 1 ? "text-brand-gold" : "text-white"}`}>
                              {user.totalPoints}
                            </span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              pts
                            </span>
                          </div>
                          {onUserClick && (
                            <Search size={14} className="text-slate-600 group-hover:text-brand-green transition-colors" />
                          )}
                        </div>
                        
                        {/* Background subtle highlight for current user */}
                        {user.id === "me" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-brand-green/5 to-transparent pointer-events-none"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>)}
    </div>
  );
};

export default Leaderboard;
