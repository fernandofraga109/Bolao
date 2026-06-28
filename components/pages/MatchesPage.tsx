import React, { useState, useMemo } from "react";
import { Match, MatchStatus, User, GroupDB } from "../../types";
import { MatchCard } from "../MatchCard.tsx";
import AdminMatchCard from "../AdminMatchCard";
import { getPhaseLockKey } from "../../utils/scoring";
import { translateGroupName } from "../../utils/translations";
import RulesSection from "../RulesSection";
import { CalendarDays, History, ChevronDown, ChevronUp, Users, Radio, Layers } from "lucide-react";

// --- Helper: Date Group Accordion ---
interface MatchGroupProps {
  title: string;
  matches: Match[];
  /** Lista completa de jogos — usada para calcular a forma recente dos times. */
  allMatches: Match[];
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
  isLive?: boolean;
  subtitle?: string;
  badge?: string;
  minRankDiff?: number;
  ruleset?: "regulamento_1" | "regulamento_2";
  eligibleGroups?: GroupDB[];
  phaseLockSet?: Set<string>;
}

const MatchGroup: React.FC<MatchGroupProps> = ({
  title,
  matches,
  allMatches,
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
  isLive,
  subtitle,
  badge,
  minRankDiff,
  ruleset,
  eligibleGroups = [],
  phaseLockSet,
}) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  if (matches.length === 0) return null;

  const isHighlighted = isToday || isLive;

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${isLive
            ? "bg-brand-red/10 border-brand-red/30 text-white mb-3 shadow-lg shadow-brand-red/5"
            : isToday
              ? "bg-brand-green/10 border-brand-green/30 text-white mb-3 shadow-lg shadow-brand-green/5"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80"
          }`}
      >
        <div className="flex items-center gap-3">
          {isLive ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-red" />
            </span>
          ) : (
            icon
          )}
          <div className="text-left">
            <h3 className={`font-bold ${isHighlighted ? "text-lg" : "text-sm"}`}>
              {title}
            </h3>
            {subtitle ? (
              <span className={`text-[11px] font-semibold capitalize ${isLive ? "text-brand-red/80" : isToday ? "text-brand-green/80" : "opacity-70"}`}>
                {subtitle}
              </span>
            ) : (
              !isOpen && (
                <span className="text-[10px] opacity-70">
                  {matches.length} jogos
                </span>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {badge && (
            <span className="text-[10px] leading-tight font-black px-2 py-1 rounded-full bg-slate-700 text-slate-300 uppercase tracking-wider text-center max-w-[110px] whitespace-normal">
              {badge}
            </span>
          )}
          {isHighlighted && (
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-full ${isLive ? "bg-brand-red/20 text-brand-red" : "bg-brand-green/20 text-brand-green"
                }`}
            >
              {matches.length} {matches.length === 1 ? "jogo" : "jogos"}
            </span>
          )}
          {isOpen ? (
            <ChevronUp size={isHighlighted ? 20 : 16} />
          ) : (
            <ChevronDown size={isHighlighted ? 20 : 16} />
          )}
        </div>
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
                competitionMatches={allMatches}
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
  onAdminSaveMatch: (id: string, status: "started" | "live" | "delayed" | "ended", h: number, a: number) => void;
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
  const [pastView, setPastView] = useState<"group" | "day">("group");

  const { liveMatches, pastGroups, pastDays, todayMatches, futureGroups } = useMemo(() => {
    const now = new Date();

    const getDayString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const todayStr = getDayString(now);
    const live: Match[] = [];
    const past: Record<string, Match[]> = {};
    const pastByDay: Record<string, Match[]> = {};
    const today: Match[] = [];
    const future: Record<string, Match[]> = {};

    matches.forEach((match) => {
      // Jogos ao vivo aparecem só na seção "Ao Vivo", independente da data.
      // Resolve o caso do jogo que cruza a meia-noite e sumiria dos "Jogos do Dia".
      if (match.status === MatchStatus.LIVE || match.status === MatchStatus.DELAYED) {
        live.push(match);
        return;
      }

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

        if (!pastByDay[mDateStr]) pastByDay[mDateStr] = [];
        pastByDay[mDateStr].push(match);
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

    live.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Ordena jogos dentro de cada dia por horário
    Object.values(pastByDay).forEach((dayMatches) =>
      dayMatches.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    );

    return { liveMatches: live, pastGroups: past, pastDays: pastByDay, todayMatches: today, futureGroups: future };
  }, [matches]);


  const formatDateTitle = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const PHASE_BADGE_LABELS: Record<string, string> = {
    groups: "Fase de Grupos",
    round_of_32: "16 Avos",
    oitavas: "Oitavas",
    quartas: "Quartas",
    semis: "Semis",
    third_place: "3º Lugar",
    final: "Final",
  };

  const getPhaseBadge = (matches: Match[]): string | undefined => {
    const phases = new Set(matches.map((m) => getPhaseLockKey(m.stage, m.group)));
    const labels = Array.from(phases)
      .map((p) => PHASE_BADGE_LABELS[p])
      .filter(Boolean);
    return labels.length > 0 ? labels.join(" · ") : undefined;
  };

  const phaseLockSet = useMemo(() => {
    if (ruleset !== "regulamento_2") return new Set<string>();
    const locked = new Set<string>();
    const now = new Date();
    matches.forEach((m) => {
      const started = m.status !== MatchStatus.SCHEDULED || now > new Date(m.date);
      if (started) {
        locked.add(getPhaseLockKey(m.stage, m.group));
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

      {/* Live Matches */}
      <MatchGroup
        title="Jogos Ao Vivo"
        matches={liveMatches}
        allMatches={matches}
        isOpenDefault={true}
        isLive={true}
        icon={<Radio size={20} className="text-brand-red" />}
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
            <div className="mt-4 animate-fadeIn">
              {/* Tabs: ordenar por grupo ou por dia */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/50 mb-4">
                <button
                  onClick={() => setPastView("group")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pastView === "group"
                      ? "bg-slate-700 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                  <Layers size={14} />
                  Por grupo
                </button>
                <button
                  onClick={() => setPastView("day")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pastView === "day"
                      ? "bg-slate-700 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                  <CalendarDays size={14} />
                  Por dia
                </button>
              </div>

              <div className="space-y-4 pl-2 border-l-2 border-slate-800 ml-4">
                {pastView === "group"
                  ? Object.entries(pastGroups)
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
                        allMatches={matches}
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
                    ))
                  : Object.entries(pastDays)
                    // Mais recente primeiro
                    .sort(([dayA], [dayB]) => dayB.localeCompare(dayA))
                    .map(([dateStr, dayMatches]) => (
                      <MatchGroup
                        key={dateStr}
                        title={formatDateTitle(dateStr)}
                        badge={getPhaseBadge(dayMatches)}
                        matches={dayMatches}
                        allMatches={matches}
                        isOpenDefault={false}
                        icon={<CalendarDays size={14} className="text-slate-500" />}
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
            </div>
          )}
        </div>
      )}

      {/* Today's Matches */}
      <MatchGroup
        title="Jogos do Dia"
        matches={todayMatches}
        allMatches={matches}
        isOpenDefault={true}
        isToday={true}
        subtitle={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
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
            badge={getPhaseBadge(groupMatches)}
            matches={groupMatches}
            allMatches={matches}
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
