import React, { useState, useMemo } from "react";
import { Match, MatchStatus, User, GroupDB } from "../../types";
import { MatchCard } from "../MatchCard.tsx";
import AdminMatchCard from "../AdminMatchCard";
import { getMatchPhase } from "../../utils/scoring";
import { translateGroupName } from "../../utils/translations";
import RulesSection from "../RulesSection";
import { CalendarDays, History, ChevronDown, ChevronUp, Zap, Users } from "lucide-react";

// --- Helper: Date Group Accordion ---
interface MatchGroupProps {
  title: string;
  matches: Match[];
  isOpenDefault?: boolean;
  icon?: React.ReactNode;
  userPredictions: Record<string, any>;
  leaderboardData: any[];
  currentUserId: string;
  onPredict: (id: string, h: number, a: number, targetGroupIds?: string[], whoClassifiesTeamId?: string | null) => Promise<void>;
  isAdmin: boolean;
  onAdminSaveMatch: (id: string, status: "started" | "live" | "ended", h: number, a: number) => void;
  onAdminToggleSyncLock?: (matchId: string, locked: boolean) => void;
  isToday?: boolean;
  minRankDiff?: number;
  ruleset?: "regulamento_1" | "regulamento_2";
  eligibleGroups?: GroupDB[];
  phaseLockSet?: Set<string>;
}

const MatchGroup: React.FC<MatchGroupProps> = ({
  title,
  matches,
  isOpenDefault = false,
  icon,
  userPredictions,
  leaderboardData,
  currentUserId,
  onPredict,
  isAdmin,
  onAdminSaveMatch,
  onAdminToggleSyncLock,
  isToday,
  minRankDiff,
  ruleset,
  eligibleGroups = [],
  phaseLockSet,
}) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  if (matches.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isToday
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
          {matches.map((match) =>
            isAdmin ? (
              <AdminMatchCard
                key={match.id}
                match={match}
                onAdminSaveMatch={onAdminSaveMatch}
                onAdminToggleSyncLock={onAdminToggleSyncLock}
              />
            ) : (
              <MatchCard
                key={match.id}
                match={match}
                userPrediction={
                  userPredictions[match.id]
                    ? {
                      matchId: match.id,
                      homeScore: userPredictions[match.id].home,
                      awayScore: userPredictions[match.id].away,
                      whoClassifiesTeamId: userPredictions[match.id].whoClassifiesTeamId,
                    }
                    : undefined
                }
                friends={leaderboardData}
                currentUserId={currentUserId}
                onPredict={onPredict}
                minRankDiff={minRankDiff}
                ruleset={ruleset}
                eligibleGroups={eligibleGroups}
                phaseLockSet={phaseLockSet}
              />
            )
          )}
        </div>
      )}
    </div>
  );
};

// --- Main Page ---
interface MatchesPageProps {
  matches: Match[];
  userHasGroup: boolean;
  userPredictions: Record<string, { home: number; away: number; points?: number; whoClassifiesTeamId?: string }>;
  leaderboardData: any[];
  currentUser: User;
  isSyncing: boolean;
  canWriteCompetitionData: boolean;
  onManualSync: () => void;
  onPredict: (id: string, h: number, a: number, targetGroupIds?: string[], whoClassifiesTeamId?: string | null) => Promise<void>;
  onAdminSaveMatch: (id: string, status: "started" | "live" | "ended", h: number, a: number) => void;
  onAdminToggleSyncLock?: (matchId: string, locked: boolean) => void;
  onOpenGroupSwitcher?: () => void;
  minRankDiff?: number;
  ruleset?: "regulamento_1" | "regulamento_2";
  eligibleGroups?: GroupDB[];
}

const MatchesPage: React.FC<MatchesPageProps> = ({
  matches,
  userHasGroup,
  userPredictions,
  leaderboardData,
  currentUser,
  isSyncing,
  canWriteCompetitionData,
  onManualSync,
  onPredict,
  onAdminSaveMatch,
  onAdminToggleSyncLock,
  onOpenGroupSwitcher,
  minRankDiff,
  ruleset = "regulamento_1",
  eligibleGroups = [],
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
          key = translateGroupName(match.group);
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


  const formatDateTitle = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const phaseLockSet = useMemo(() => {
    if (ruleset !== "regulamento_2") return new Set<string>();
    const locked = new Set<string>();
    const now = new Date();
    matches.forEach((m) => {
      const started = m.status !== MatchStatus.SCHEDULED || now > new Date(m.date);
      if (started) {
        locked.add(getMatchPhase(m.stage, m.group));
      }
    });
    return locked;
  }, [matches, ruleset]);

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

      {!isAdmin && <RulesSection minRankDiff={minRankDiff} ruleset={ruleset} />}


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
                .sort(([, matchesA], [, matchesB]) => {
                  // Ordena pelo último jogo de cada fase (mais recente primeiro)
                  const lastDateA = Math.max(
                    ...matchesA.map((m) => new Date(m.date).getTime()),
                  );
                  const lastDateB = Math.max(
                    ...matchesB.map((m) => new Date(m.date).getTime()),
                  );
                  // Ordem descendente: mais recente primeiro
                  if (lastDateB !== lastDateA) return lastDateB - lastDateA;

                  // Fallback: Rodada X (descendente)
                  const [titleA] = matchesA;
                  const [titleB] = matchesB;
                  const numA = parseInt(
                    titleA?.group?.replace(/\D/g, "") || "",
                  );
                  const numB = parseInt(
                    titleB?.group?.replace(/\D/g, "") || "",
                  );
                  if (!isNaN(numA) && !isNaN(numB)) return numB - numA;

                  return 0;
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
                    currentUserId={currentUser.id}
                    onPredict={onPredict}
                    isAdmin={isAdmin}
                    onAdminSaveMatch={onAdminSaveMatch}
                    onAdminToggleSyncLock={onAdminToggleSyncLock}
                    minRankDiff={minRankDiff}
                    ruleset={ruleset}
                    eligibleGroups={eligibleGroups}
                    phaseLockSet={phaseLockSet}
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
        currentUserId={currentUser.id}
        onPredict={onPredict}
        isAdmin={isAdmin}
        onAdminSaveMatch={onAdminSaveMatch}
        onAdminToggleSyncLock={onAdminToggleSyncLock}
        minRankDiff={minRankDiff}
        ruleset={ruleset}
        eligibleGroups={eligibleGroups}
        phaseLockSet={phaseLockSet}
      />

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
            currentUserId={currentUser.id}
            onPredict={onPredict}
            isAdmin={isAdmin}
            onAdminSaveMatch={onAdminSaveMatch}
            onAdminToggleSyncLock={onAdminToggleSyncLock}
            minRankDiff={minRankDiff}
            ruleset={ruleset}
            eligibleGroups={eligibleGroups}
            phaseLockSet={phaseLockSet}
          />
        ))}
    </div>
  );
};

export default MatchesPage;
