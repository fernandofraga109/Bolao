import React from "react";
import { Friend } from "../types";
import { Trophy, Medal } from "lucide-react";
import AvatarWithFallback from "./ui/AvatarWithFallback";

interface LeaderboardProps {
  sections: {
    groupId: string;
    groupName: string;
    users: Friend[];
  }[];
}

const Leaderboard: React.FC<LeaderboardProps> = ({ sections }) => {
  const sectionsWithSortedUsers = sections.map((section) => ({
    ...section,
    users: [...section.users].sort((a, b) => b.totalPoints - a.totalPoints),
  }));

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="text-yellow-400 w-6 h-6" />;
      case 1:
        return <Medal className="text-gray-300 w-6 h-6" />;
      case 2:
        return <Medal className="text-amber-600 w-6 h-6" />;
      default:
        return (
          <span className="text-slate-500 font-bold w-6 text-center">
            {index + 1}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-gradient-to-r from-brand-green to-brand-blue p-6 rounded-2xl mb-6 shadow-lg text-center text-white">
        <h2 className="text-2xl font-bold mb-1">Classificação Geral</h2>
        <p className="opacity-90 text-sm">Veja a classificação por grupo</p>
      </div>

      {sectionsWithSortedUsers.length === 0 ? (
        <div className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700 p-6 text-center text-slate-400 text-sm">
          Entre em um grupo para visualizar a classificação.
        </div>
      ) : (
        <div className="space-y-5">
          {sectionsWithSortedUsers.map((section) => (
            <div
              key={section.groupId}
              className="bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700"
            >
              <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-bold text-white">{section.groupName}</h3>
                <span className="text-[10px] uppercase tracking-wider text-slate-400">
                  {section.users.length} participantes
                </span>
              </div>

              {section.users.map((user, index) => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-4 border-b border-slate-700 last:border-0 hover:bg-slate-700/30 transition-colors ${user.id === "me" ? "bg-indigo-900/20" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center w-8">
                      {getRankIcon(index)}
                    </div>
                    <div className="relative">
                      <AvatarWithFallback
                        src={user.avatar}
                        alt={user.name}
                        className={`w-10 h-10 rounded-full border-2 ${user.id === "me" ? "border-brand-green" : "border-transparent"}`}
                        fallbackClassName={`${user.id === "me" ? "bg-slate-700 text-brand-green" : "bg-slate-700 text-slate-300"}`}
                        iconSize={16}
                      />
                      {user.id === "me" && (
                        <div className="absolute -bottom-1 -right-1 bg-brand-green text-slate-900 text-[10px] font-bold px-1 rounded">
                          EU
                        </div>
                      )}
                    </div>
                    <div>
                      <h3
                        className={`font-semibold ${user.id === "me" ? "text-brand-green" : "text-slate-200"}`}
                      >
                        {user.name}
                      </h3>
                      <span className="text-xs text-slate-400">
                        Palpites feitos: {Object.keys(user.predictions).length}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="block text-xl font-bold text-white">
                      {user.totalPoints}
                    </span>
                    <span className="text-[10px] uppercase text-slate-500 tracking-wider">
                      Pontos
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
