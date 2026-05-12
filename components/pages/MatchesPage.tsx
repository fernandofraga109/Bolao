import React, { useState, useMemo } from "react";
import { Match, User, TournamentPredictions } from "../../types";
import MatchCard from "../MatchCard";
import RulesSection from "../RulesSection";
import TopScorerCard from "../TopScorerCard";
import { CalendarDays, History, ChevronDown, ChevronUp, Zap, Users } from "lucide-react";

// --- Helper: Date Group Accordion ---
interface MatchGroupProps {
  title: string;
  matches: Match[];
  isOpenDefault?: boolean;
  icon?: React.ReactNode;
  userPredictions: Record<string, any>;
  leaderboardData: any[];
  onPredict: (id: string, h: number, a: number) => Promise<void>;
  isAdmin: boolean;
  onFinishMatch: (id: string, h: number, a: number) => void;
  isToday?: boolean;
  minRankDiff?: number;
}

const MatchGroup: React.FC<MatchGroupProps> = ({
  title,
  matches,
  isOpenDefault = false,
  icon,
  userPredictions,
  leaderboardData,
  onPredict,
  isAdmin,
  onFinishMatch,
  isToday,
  minRankDiff,
}) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  if (matches.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
          isToday
            ? "bg-brand-green/10 border-brand-green/30 text-white mb-3 shadow-lg shadow-brand-green/5"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80"
        }`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <h3 className={`font-bold ${isToday ? "text-lg" : "text-sm"}`}>
              {title}
            </h3>
            {!isOpen && (
              <span className="text-[10px] opacity-70">
                {matches.length} jogos
              </span>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp size={isToday ? 20 : 16} />
        ) : (
          <ChevronDown size={isToday ? 20 : 16} />
        )}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-6 animate-fadeIn">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              userPrediction={
                userPredictions[match.id]
                  ? {
                      matchId: match.id,
                      homeScore: userPredictions[match.id].home,
                      awayScore: userPredictions[match.id].away,
                    }
                  : undefined
              }
              friends={leaderboardData}
              onPredict={onPredict}
              isAdmin={isAdmin}
              onFinishMatch={onFinishMatch}
              minRankDiff={minRankDiff}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Page ---
interface MatchesPageProps {
  matches: Match[];
  userHasGroup: boolean;
  userPredictions: Record<string, { home: number; away: number; points?: number }>;
  leaderboardData: any[];
  currentUser: User;
  isSyncing: boolean;
  canWriteCompetitionData: boolean;
  tournamentResults?: any;
  lockDate: string | null;
  onManualSync: () => void;
  onPredict: (id: string, h: number, a: number) => Promise<void>;
  onFinishMatch: (id: string, h: number, a: number) => void;
  onPredictTournament: (predictions: TournamentPredictions) => void;
  onOpenGroupSwitcher?: () => void;
  minRankDiff?: number;
}

const MatchesPage: React.FC<MatchesPageProps> = ({
  matches,
  userHasGroup,
  userPredictions,
  leaderboardData,
  currentUser,
  isSyncing,
  canWriteCompetitionData,
  tournamentResults,
  lockDate,
  onManualSync,
  onPredict,
  onFinishMatch,
  onPredictTournament,
  onOpenGroupSwitcher,
  minRankDiff,
}) => {
  const [isPastMatchesOpen, setIsPastMatchesOpen] = useState(false);

  const { pastGroups, todayMatches, futureGroups } = useMemo(() => {
    const now = new Date();

    const getDayString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const todayStr = getDayString(now);
    const past: Record<string, Match[]> = {};
    const today: Match[] = [];
    const future: Record<string, Match[]> = {};

    matches.forEach((match) => {
      const mDate = new Date(match.date);
      const mDateStr = getDayString(mDate);

      if (mDateStr < todayStr) {
        let key = "Anteriores";
        if (match.stage === "REGULAR_SEASON" && match.matchday) {
          key = `Rodada ${match.matchday}`;
        } else if (match.group) {
          key = match.group;
        }
        if (!past[key]) past[key] = [];
        past[key].push(match);
      } else if (mDateStr === todayStr) {
        today.push(match);
      } else {
        if (!future[mDateStr]) future[mDateStr] = [];
        future[mDateStr].push(match);
      }
    });

    today.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return { pastGroups: past, todayMatches: today, futureGroups: future };
  }, [matches]);

  const currentGroupTeamIds = useMemo(() => {
    const ids = new Set<string>();
    matches.forEach((match) => {
      if (match.homeTeam?.id) ids.add(match.homeTeam.id);
      if (match.awayTeam?.id) ids.add(match.awayTeam.id);
    });
    return Array.from(ids);
  }, [matches]);

  const formatDateTitle = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const isAdmin = currentUser.role === "ADMIN";

  return (
    <div className="space-y-6">
      {matches.length === 0 && !userHasGroup && (
        <div className="text-center py-10 border border-slate-700 rounded-xl bg-slate-800/50 border-dashed space-y-3">
          <Users className="mx-auto text-slate-500" size={32} />
          <p className="text-slate-300 text-sm font-semibold">
            Você ainda não está em um grupo
          </p>
          <p className="text-slate-500 text-xs">
            Entre em um grupo para começar a palpitar.
          </p>
          {onOpenGroupSwitcher && (
            <button
              onClick={() => onOpenGroupSwitcher()}
              className="mt-2 bg-brand-green text-brand-dark rounded-xl font-black uppercase tracking-widest px-5 py-2 text-xs hover:bg-emerald-400 transition-colors"
            >
              Entrar em um grupo
            </button>
          )}
        </div>
      )}

      {matches.length === 0 && userHasGroup && (
        <div className="text-center py-8 border border-slate-700 rounded-xl bg-slate-800/50 border-dashed">
          <p className="text-slate-300 text-sm mb-3">
            Nenhum jogo encontrado.
          </p>
          <button
            onClick={onManualSync}
            disabled={isSyncing || !canWriteCompetitionData}
            className="bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {!canWriteCompetitionData
              ? "Apenas admin sincroniza"
              : isSyncing
              ? "Sincronizando..."
              : "Sincronizar jogos"}
          </button>
        </div>
      )}

      {!isAdmin && <RulesSection minRankDiff={minRankDiff} />}

      {!isAdmin && (
        <TopScorerCard
          prediction={currentUser.tournamentPredictions}
          onPredict={onPredictTournament}
          lockDate={lockDate ? new Date(lockDate) : new Date(0)}
          finalResult={tournamentResults}
          allowedChampionTeamIds={currentGroupTeamIds}
        />
      )}

      {/* Past Matches */}
      {Object.keys(pastGroups).length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setIsPastMatchesOpen(!isPastMatchesOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:bg-slate-800 transition-all"
          >
            <div className="flex items-center gap-3">
              <History size={18} />
              <span className="font-bold text-sm">Ver Jogos Anteriores</span>
            </div>
            {isPastMatchesOpen ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>

          {isPastMatchesOpen && (
            <div className="mt-4 space-y-4 pl-2 border-l-2 border-slate-800 ml-4 animate-fadeIn">
              {Object.entries(pastGroups)
                .sort(([a], [b]) => {
                  const numA = parseInt(a.replace(/\D/g, ""));
                  const numB = parseInt(b.replace(/\D/g, ""));
                  if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
                  return b.localeCompare(a);
                })
                .map(([title, groupMatches]) => (
                  <MatchGroup
                    key={title}
                    title={title}
                    matches={groupMatches}
                    isOpenDefault={false}
                    icon={<History size={14} className="text-slate-500" />}
                    userPredictions={userPredictions}
                    leaderboardData={leaderboardData}
                    onPredict={onPredict}
                    isAdmin={isAdmin}
                    onFinishMatch={onFinishMatch}
                    minRankDiff={minRankDiff}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Today's Matches Hero */}
      {todayMatches.length > 0 && (
        <div className="bg-gradient-to-br from-brand-green/15 via-brand-green/8 to-transparent border border-brand-green/20 rounded-2xl p-5 relative overflow-hidden animate-fadeIn">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/10 blur-2xl rounded-full -mr-8 -mt-8 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-brand-green fill-brand-green" />
                <span className="text-[10px] font-black text-brand-green uppercase tracking-[0.2em]">Hoje</span>
              </div>
              <p className="text-white font-black text-lg tracking-tight leading-none">
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-3xl font-black text-brand-green leading-none">{todayMatches.length}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {todayMatches.length === 1 ? "jogo" : "jogos"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Today's Matches */}
      <MatchGroup
        title="Jogos do Dia"
        matches={todayMatches}
        isOpenDefault={true}
        isToday={true}
        icon={<CalendarDays size={20} className="text-brand-green" />}
        userPredictions={userPredictions}
        leaderboardData={leaderboardData}
        onPredict={onPredict}
        isAdmin={isAdmin}
        onFinishMatch={onFinishMatch}
        minRankDiff={minRankDiff}
      />

      {todayMatches.length === 0 &&
        Object.keys(pastGroups).length > 0 &&
        Object.keys(futureGroups).length > 0 && (
          <div className="text-center py-8 border border-slate-700 rounded-xl bg-slate-800/50 border-dashed">
            <p className="text-slate-400 text-sm">
              Nenhum jogo agendado para hoje.
            </p>
          </div>
        )}

      {/* Future Matches */}
      {Object.entries(futureGroups)
        .sort()
        .map(([dateStr, groupMatches]) => (
          <MatchGroup
            key={dateStr}
            title={formatDateTitle(dateStr)}
            matches={groupMatches}
            isOpenDefault={false}
            icon={<CalendarDays size={18} className="text-slate-500" />}
            userPredictions={userPredictions}
            leaderboardData={leaderboardData}
            onPredict={onPredict}
            isAdmin={isAdmin}
            onFinishMatch={onFinishMatch}
            minRankDiff={minRankDiff}
          />
        ))}
    </div>
  );
};

export default MatchesPage;
