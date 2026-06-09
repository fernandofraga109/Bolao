import React from "react";
import { Friend } from "../types";
import {
  Trophy,
  Target,
  Zap,
  TrendingUp,
  Award,
  Medal,
} from "lucide-react";
import AvatarWithFallback from "./ui/AvatarWithFallback";
import { rankLeaderboardSections } from "../utils/leaderboardUtils";

interface LeaderboardDetailsProps {
  sections: {
    groupId: string;
    groupName: string;
    competitionCode?: string;
    users: Friend[];
  }[];
  ruleset?: "regulamento_1" | "regulamento_2";
  onUserClick?: (user: Friend) => void;
}

const StatBadge: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
}> = ({ icon, label, value, colorClass, bgClass }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${bgClass} border border-white/5`}>
    <div className={`${colorClass}`}>{icon}</div>
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className={`text-lg font-black leading-none ${colorClass}`}>
        {value}
      </span>
    </div>
  </div>
);

const LeaderboardDetails: React.FC<LeaderboardDetailsProps> = ({
  sections,
  ruleset = "regulamento_1",
  onUserClick,
}) => {
  const sectionsWithSortedUsers = rankLeaderboardSections(sections);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="text-brand-gold w-5 h-5 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" />;
      case 2:
        return <Medal className="text-slate-300 w-5 h-5" />;
      case 3:
        return <Medal className="text-amber-600 w-5 h-5" />;
      default:
        return (
          <span className="text-slate-500 font-bold w-5 text-center text-sm">
            {rank}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-8 space-y-8">
      {sectionsWithSortedUsers.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden shadow-xl border border-slate-700/50 p-12 text-center">
          <div className="bg-slate-700/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Target size={32} className="text-slate-500" />
          </div>
          <p className="text-slate-300 font-medium">
            Entre em um grupo para visualizar os detalhes.
          </p>
        </div>
      ) : (
        sectionsWithSortedUsers.map((section) => (
          <div
            key={section.groupId}
            className="bg-slate-800/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50"
          >
            <div className="px-4 py-3 bg-slate-900/40 border-b border-slate-700/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="bg-brand-blue/20 p-2 rounded-lg">
                  <Target size={16} className="text-brand-blue" />
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
              {section.users.map((user) => {
                const bd = user.scoreBreakdown;
                if (!bd) return null;

                return (
                  <div
                    key={user.id}
                    className={`group flex flex-col gap-3 px-3 py-4 sm:px-5 sm:py-5 transition-all hover:bg-slate-700/20 ${
                      onUserClick ? "cursor-pointer" : ""
                    }`}
                    onClick={() => onUserClick?.(user)}
                  >
                    {/* Row header: rank + avatar + name + total */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0">{getRankIcon(user.rank)}</div>
                        <AvatarWithFallback
                          src={user.avatar}
                          alt={user.name}
                          className={`w-9 h-9 rounded-full border-2 ${
                            user.id === "me"
                              ? "border-brand-green shadow-lg shadow-brand-green/20"
                              : "border-slate-700 shadow-lg"
                          }`}
                          fallbackClassName={
                            user.id === "me"
                              ? "bg-slate-700 text-brand-green"
                              : "bg-slate-700 text-slate-300"
                          }
                          iconSize={18}
                        />
                        <div className="min-w-0">
                          <h3
                            className={`font-bold tracking-tight truncate text-sm ${
                              user.id === "me" ? "text-brand-green" : "text-slate-100"
                            }`}
                          >
                            {user.name}
                          </h3>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                            {user.predictionsCount ?? Object.keys(user.predictions).length} palpites
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-baseline justify-end gap-1">
                          <span
                            className={`text-xl font-black leading-none ${
                              user.rank === 1 ? "text-brand-gold" : "text-white"
                            }`}
                          >
                            {user.totalPoints}
                          </span>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            pts
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stat badges grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <StatBadge
                        icon={<Target size={16} />}
                        label="Exatos"
                        value={bd.exactCount}
                        colorClass="text-brand-green"
                        bgClass="bg-brand-green/5"
                      />
                      <StatBadge
                        icon={<TrendingUp size={16} />}
                        label="Diff"
                        value={bd.diffCount}
                        colorClass="text-brand-blue"
                        bgClass="bg-brand-blue/5"
                      />
                      <StatBadge
                        icon={<Award size={16} />}
                        label="Resultado"
                        value={bd.outcomeCount}
                        colorClass="text-indigo-400"
                        bgClass="bg-indigo-500/5"
                      />
                      {ruleset === "regulamento_2" ? (
                        <StatBadge
                          icon={<Zap size={16} />}
                          label="Sozinho"
                          value={bd.aloneBonusCount ?? 0}
                          colorClass="text-yellow-400"
                          bgClass="bg-yellow-500/5"
                        />
                      ) : (
                        <StatBadge
                          icon={<Zap size={16} />}
                          label="Zebra"
                          value={bd.underdogBonusCount ?? 0}
                          colorClass="text-yellow-400"
                          bgClass="bg-yellow-500/5"
                        />
                      )}
                    </div>

                    {/* Bonus total row (only if > 0) */}
                    {ruleset === "regulamento_1" && (bd.underdogBonusTotal ?? 0) > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-yellow-400/80 uppercase tracking-wider">
                          +{bd.underdogBonusTotal} pts em bônus zebra
                        </span>
                      </div>
                    )}
                    {ruleset === "regulamento_2" && (bd.aloneBonusTotal ?? 0) > 0 && (
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-yellow-400/80 uppercase tracking-wider">
                          +{bd.aloneBonusTotal} pts em bônus sozinho
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default LeaderboardDetails;
