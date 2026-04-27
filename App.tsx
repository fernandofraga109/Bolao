import React, { useState, useMemo, useEffect } from "react";
import { Tab, MatchStatus, Match } from "./types";
import { calculatePoints, calculateTournamentPoints } from "./utils/scoring";

// Custom Hooks
import { useUserSystem } from "./hooks/useUserSystem";
import { useMatchSystem } from "./hooks/useMatchSystem";
import { useGroupSystem } from "./hooks/useGroupSystem";
import { useDatabase } from "./contexts/DatabaseContext";

// Layout Components
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import RulesSection from "./components/RulesSection";

// Feature Components
import MatchCard from "./components/MatchCard";
import Leaderboard from "./components/Leaderboard";
import TopScorerCard from "./components/TopScorerCard";
import Login from "./components/Login";
import AdminDashboard from "./components/AdminDashboard";
import GroupSwitcher from "./components/GroupSwitcher";
import TournamentStandings from "./components/TournamentStandings";
import ModalShell from "./components/ui/ModalShell";
import { DEFAULT_COMPETITION_CODE, COMPETITION_OPTIONS, getCompetitionByCode } from "./data/competitions";
import {
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  History,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// --- Helper Component for Date Groups ---
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const db = useDatabase();

  // --- Custom Hooks (Modularized State) ---
  const {
    users,
    currentUser,
    authReady,
    login,
    loginWithCredentials,
    register,
    logout,
    joinGroup,
    switchGroup,
    predictMatch,
    predictTournament,
    requestPasswordReset,
    updatePassword,
    updateAvatar,
    adminActions,
  } = useUserSystem();

  const isRecoveryLink = () => {
    if (typeof window === "undefined") return false;

    const url = new URL(window.location.href);

    // Verificar URL params para modo de recovery explícito (fallback)
    if (url.searchParams.get("mode") === "recovery") {
      return true;
    }

    // Verificar hash params (do redirect do Supabase)
    const hashParams = new URLSearchParams(
      window.location.hash.replace("#", ""),
    );
    const hashType = (hashParams.get("type") || "").toLowerCase();
    const hasAccessToken = !!hashParams.get("access_token");

    // Se hash tem type=recovery E access_token, é uma sessão válida de recovery
    return hashType === "recovery" && hasAccessToken;
  };

  const [isPasswordRecoveryFlow, setIsPasswordRecoveryFlow] = useState<boolean>(
    () => isRecoveryLink(),
  );

  useEffect(() => {
    const checkRecovery = () => {
      const isRecovery = isRecoveryLink();
      console.log(
        "[Recovery Flow] Detectado:",
        isRecovery,
        "Hash:",
        window.location.hash,
      );
      setIsPasswordRecoveryFlow(isRecovery);
    };

    checkRecovery();

    window.addEventListener("hashchange", checkRecovery);
    window.addEventListener("popstate", checkRecovery);

    // Verificar novamente após delay para capturar redirects assincronos
    const timeout = setTimeout(checkRecovery, 500);

    return () => {
      window.removeEventListener("hashchange", checkRecovery);
      window.removeEventListener("popstate", checkRecovery);
      clearTimeout(timeout);
    };
  }, []);

  const finishPasswordRecoveryFlow = () => {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.delete("mode");
    window.history.replaceState(
      {},
      document.title,
      `${url.pathname}${url.search}`,
    );
    setIsPasswordRecoveryFlow(false);
  };

  useEffect(() => {
    if (currentUser && isPasswordRecoveryFlow) {
      finishPasswordRecoveryFlow();
    }
  }, [currentUser, isPasswordRecoveryFlow]);

  const activeGroupIdForContext =
    currentUser?.activeGroupId || currentUser?.groupIds?.[0];

  const adminActiveCompetitions = useMemo(() => {
    const codes = Array.from(
      new Set(
        db.groups.map((g) =>
          (g.competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase()
        )
      )
    );
    return codes.length > 0 ? codes : [DEFAULT_COMPETITION_CODE];
  }, [db.groups]);

  const [adminActiveCompetitionCode, setAdminActiveCompetitionCode] = useState<string>(adminActiveCompetitions[0]);

  useEffect(() => {
    if (!adminActiveCompetitions.includes(adminActiveCompetitionCode) && adminActiveCompetitions.length > 0) {
      setAdminActiveCompetitionCode(adminActiveCompetitions[0]);
    }
  }, [adminActiveCompetitions, adminActiveCompetitionCode]);

  const activeCompetitionCode = (
    currentUser?.role === "ADMIN"
    ? adminActiveCompetitionCode
    : (db.groups.find((g) => g.id === activeGroupIdForContext)?.competitionCode ||
    DEFAULT_COMPETITION_CODE)
  ).toUpperCase();

  const canWriteCompetitionData = currentUser?.role === "ADMIN";

  const {
    matches,
    tournamentResults,
    lockDate,
    syncWithExternalApi,
    syncMatchesAndStandings,
    syncStatusByCompetition,
    isSyncing,
    isAutoSyncEnabled,
    toggleAutoSync,
    adminControls,
  } = useMatchSystem(activeCompetitionCode, canWriteCompetitionData);

  const {
    groups,
    createGroup,
    deleteGroup,
    getGroupByCode,
    getGroupById,
    getGroupsByIds,
  } = useGroupSystem();

  const [activeTab, setActiveTab] = useState<Tab>("matches");
  const [groupError, setGroupError] = useState<string | null>(null);
  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false);
  const [isPastMatchesOpen, setIsPastMatchesOpen] = useState(false);
  const [isAdminSyncingAll, setIsAdminSyncingAll] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isError: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    isError: false,
  });

  const handleAdminSyncCompetition = async (competitionCode: string) => {
    if (!canWriteCompetitionData) return;
    if (isAdminSyncingAll) return;

    setIsAdminSyncingAll(true);
    try {
      const result = await syncMatchesAndStandings(competitionCode);
      setSyncFeedback({
        isOpen: true,
        title: result.success
          ? "Sincronização concluída"
          : "Falha na sincronização",
        message: result.message,
        isError: !result.success,
      });
    } finally {
      setIsAdminSyncingAll(false);
    }
  };

  const handleManualMatchesSync = async () => {
    if (!canWriteCompetitionData) {
      setSyncFeedback({
        isOpen: true,
        title: "Ação bloqueada",
        message: "Somente administradores podem sincronizar dados no banco.",
        isError: true,
      });
      return;
    }

    const result = await syncWithExternalApi(activeCompetitionCode);
    setSyncFeedback({
      isOpen: true,
      title: result.success
        ? "Sincronização de jogos concluída"
        : "Falha ao sincronizar jogos",
      message: result.message,
      isError: !result.success,
    });
  };

  // --- Calculations (Leaderboard) ---
  const usersWithCalculatedPoints = useMemo(() => {
    return users
      .filter((user) => user.role !== "ADMIN")
      .map((user) => {
        let total = 0;
        matches.forEach((match) => {
          const pred = user.predictions[match.id];
          if (
            match.status === MatchStatus.FINISHED &&
            match.result &&
            pred
          ) {
            // Priority: Persisted points in DB
            if (typeof pred.points === "number") {
              total += pred.points;
            } else {
              // Fallback: On-the-fly calculation if not yet synced to DB
              total += calculatePoints(
                pred.home,
                pred.away,
                match.result.home,
                match.result.away,
                match.homeTeam.ranking,
                match.awayTeam.ranking,
              );
            }
          }
        });

        if (tournamentResults) {
          total += calculateTournamentPoints(
            user.tournamentPredictions,
            tournamentResults,
          );
        }

        return { ...user, totalPoints: total };
      });
  }, [matches, users, tournamentResults]);

  const leaderboardData = useMemo(() => {
    if (!currentUser) return [];

    const activeGroupId =
      currentUser.activeGroupId || currentUser.groupIds[0] || undefined;
    if (!activeGroupId) return [];

    return usersWithCalculatedPoints.filter((u) =>
      u.groupIds.includes(activeGroupId),
    );
  }, [currentUser, usersWithCalculatedPoints]);

  const leaderboardSections = useMemo(() => {
    if (!currentUser) return [];

    const groupPointsMap = new Map<string, number>();
    db.userGroups.forEach((relation) => {
      if (typeof relation.points === "number") {
        groupPointsMap.set(
          `${relation.userId}:${relation.groupId}`,
          relation.points,
        );
      }
    });

    const groupNameMap = new Map<string, string>();
    const groupCompetitionMap = new Map<string, string>();
    groups.forEach((group) => {
      groupNameMap.set(group.id, group.name);
      groupCompetitionMap.set(
        group.id,
        (group.competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase(),
      );
    });

    return currentUser.groupIds
      .map((groupId) => {
        const groupUsers = usersWithCalculatedPoints
          .filter((u) => u.groupIds.includes(groupId))
          .map((user) => {
            const key = `${user.id}:${groupId}`;
            const groupPoints = groupPointsMap.get(key);

            return {
              ...user,
              totalPoints:
                typeof groupPoints === "number"
                  ? groupPoints
                  : user.totalPoints,
              predictionsCount: db.predictions.filter(
                (p) => p.userId === user.id && p.groupId === groupId,
              ).length,
            };
          });

        const fallbackGroupName =
          currentUser.groupIds.length === 1
            ? "Meu Grupo"
            : `Grupo ${currentUser.groupIds.indexOf(groupId) + 1}`;

        return {
          groupId,
          groupName: groupNameMap.get(groupId) || fallbackGroupName,
          competitionCode:
            groupCompetitionMap.get(groupId) || DEFAULT_COMPETITION_CODE,
          users: groupUsers,
        };
      })
      .filter((section) => section.users.length > 0);
  }, [
    currentUser,
    usersWithCalculatedPoints,
    db.userGroups,
    groups,
    db.predictions,
  ]);

  const resolvedActiveGroupId =
    currentUser?.activeGroupId || currentUser?.groupIds?.[0];

  const currentGroup = resolvedActiveGroupId
    ? getGroupById(resolvedActiveGroupId)
    : undefined;

  useEffect(() => {
    if (!currentUser || !currentUser.groupIds.length) return;
    
    // Only auto-sync for regular users when they enter/switch.
    // Admins have manual control and auto-sync settings.
    if (currentUser.role === "ADMIN") return;

    void syncMatchesAndStandings(activeCompetitionCode);
  }, [
    currentUser?.id,
    currentUser?.activeGroupId,
    activeCompetitionCode,
    syncMatchesAndStandings,
    currentUser?.role
  ]);

  // --- Date Grouping Logic ---
  const { pastGroups, todayMatches, futureGroups } = useMemo(() => {
    // 1. Determine "Today" (Reference Date)
    const now = new Date();
    
    // Normalize dates to YYYY-MM-DD for comparison
    const getDayString = (d: Date) => {
      // Use local date (YYYY-MM-DD) instead of UTC to avoid timezone shifts
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

    // Sort today matches by time
    today.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return { pastGroups: past, todayMatches: today, futureGroups: future };
  }, [matches, activeCompetitionCode]);

  const formatDateTitle = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00"); // Force midday to avoid timezone shifts on just date display
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  // --- Render Auth Screen ---
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark text-white">
        Carregando autenticação...
      </div>
    );
  }

  if (!currentUser || isPasswordRecoveryFlow) {
    return (
      <Login
        onLogin={(user) => {
          finishPasswordRecoveryFlow();
          login(user);
          setActiveTab(user.role === "ADMIN" ? "admin" : "matches");
        }}
        onRegister={(name, email, pass, code) =>
          register(name, email, pass, code, groups)
        }
        onAuth={loginWithCredentials}
        onRequestPasswordReset={requestPasswordReset}
        onUpdatePassword={updatePassword}
        initialMode={
          isPasswordRecoveryFlow ? "RESET_PASSWORD_CONFIRM" : "LOGIN"
        }
        onPasswordResetComplete={finishPasswordRecoveryFlow}
        availableUsers={users}
      />
    );
  }

  // --- Helpers for Group Switching ---
  const createGroupWithCompetitionBootstrap = async (
    name: string,
    competitionCode: string,
    options: { joinCreator: boolean },
  ) => {
    const normalizedCompetitionCode = (
      competitionCode || DEFAULT_COMPETITION_CODE
    ).toUpperCase();

    const competitionAlreadyRegistered = groups.some(
      (group) =>
        (group.competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase() ===
        normalizedCompetitionCode,
    );

    const newGroup = createGroup(
      name,
      currentUser.id,
      normalizedCompetitionCode,
    );

    if (options.joinCreator) {
      joinGroup(currentUser.id, newGroup.id);
    }

    if (!competitionAlreadyRegistered) {
      const bootstrapResult = await syncMatchesAndStandings(
        normalizedCompetitionCode,
      );
      setSyncFeedback({
        isOpen: true,
        title: bootstrapResult.success
          ? "Competicao inicializada"
          : "Competicao criada com alerta",
        message: bootstrapResult.success
          ? `Nova competicao ${normalizedCompetitionCode} cadastrada e sincronizada. ${bootstrapResult.message}`
          : `A competicao ${normalizedCompetitionCode} foi criada, mas a carga inicial falhou. ${bootstrapResult.message}`,
        isError: !bootstrapResult.success,
      });
    }

    return newGroup;
  };

  const handleCreateGroup = (name: string, competitionCode: string) => {
    void createGroupWithCompetitionBootstrap(name, competitionCode, {
      joinCreator: true,
    });
    setGroupError(null);
    setIsGroupSwitcherOpen(false);
  };

  const handleJoinGroup = (code: string) => {
    const group = getGroupByCode(code);
    if (group) {
      if (currentUser.groupIds.includes(group.id)) {
        switchGroup(currentUser.id, group.id);
      } else {
        joinGroup(currentUser.id, group.id);
      }
      if (canWriteCompetitionData) {
        void syncMatchesAndStandings(
          (group.competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase(),
        );
      }
      setGroupError(null);
      setIsGroupSwitcherOpen(false);
    } else {
      setGroupError("Código inválido.");
    }
  };

  const myGroupsList = getGroupsByIds(currentUser.groupIds);
  const myPredictionsMap = currentUser.predictions || {};

  return (
    <div className="min-h-screen pb-20 bg-brand-dark text-slate-100 font-sans selection:bg-brand-green selection:text-brand-dark">
      <Header
        currentUser={currentUser}
        onLogout={logout}
        onUpdateAvatar={updateAvatar}
      />

      {/* Group Info Bar OR Call to Action */}
      {activeTab !== "admin" && (
        <div className="max-w-2xl mx-auto px-4 mt-4">
          {currentUser.role === "ADMIN" ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 flex justify-between items-center text-xs shadow-sm relative">
              <div className="flex items-center gap-3 w-full">
                <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                  Competição
                </span>
                <div className="flex items-center gap-2 flex-1">
                  <select
                    value={adminActiveCompetitionCode}
                    onChange={(e) => setAdminActiveCompetitionCode(e.target.value)}
                    className="bg-transparent text-white text-sm font-bold focus:outline-none focus:ring-0 appearance-none cursor-pointer flex-1"
                    style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  >
                    {adminActiveCompetitions.map(code => {
                      const dbComp = db.competitions.find(c => c.code.toUpperCase() === code.toUpperCase());
                      const name = dbComp?.name || getCompetitionByCode(code).name;
                      return <option key={code} value={code} className="bg-slate-900">{name}</option>
                    })}
                  </select>
                  <ChevronsUpDown size={14} className="text-brand-green opacity-70 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-slate-700/50">
                <span className="text-brand-green font-mono bg-brand-green/10 px-2 py-1 rounded text-[10px] border border-brand-green/30 pointer-events-none">
                  {adminActiveCompetitionCode}
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsGroupSwitcherOpen(true)}
              className="bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 flex justify-between items-center text-xs cursor-pointer hover:bg-slate-700/80 hover:border-slate-600 transition-all group shadow-sm"
            >
              {currentGroup ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                      Grupo
                    </span>
                    <div className="flex items-center gap-2">
                      <strong className="text-white text-sm">
                        {currentGroup.name}
                      </strong>
                      <ChevronsUpDown
                        size={14}
                        className="text-brand-green opacity-70 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded text-[10px] border border-slate-700/50">
                      #{currentGroup.code}
                    </span>
                    <span className="text-brand-green font-mono bg-brand-green/10 px-2 py-1 rounded text-[10px] border border-brand-green/30">
                      {(
                        currentGroup.competitionCode || DEFAULT_COMPETITION_CODE
                      ).toUpperCase()}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 w-full justify-center text-brand-green py-1">
                  <PlusCircle size={16} />
                  <span className="font-bold">Entrar em um Grupo</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Group Switcher Modal */}
      {isGroupSwitcherOpen && (
        <GroupSwitcher
          myGroups={myGroupsList}
          activeGroupId={currentUser.activeGroupId}
          onSwitch={(id) => {
            switchGroup(currentUser.id, id);
            const nextGroup = getGroupById(id);
            if (canWriteCompetitionData) {
              void syncMatchesAndStandings(
                (
                  nextGroup?.competitionCode || DEFAULT_COMPETITION_CODE
                ).toUpperCase(),
              );
            }
            setIsGroupSwitcherOpen(false);
          }}
          onCreate={handleCreateGroup}
          onJoin={handleJoinGroup}
          onClose={() => {
            setIsGroupSwitcherOpen(false);
            setGroupError(null);
          }}
          error={groupError}
          userRole={currentUser.role}
        />
      )}

      <main className="max-w-2xl mx-auto p-4">
        {/* Matches Tab */}
        {activeTab === "matches" && (
          <div className="space-y-6">
            {matches.length === 0 && (
              <div className="text-center py-8 border border-slate-700 rounded-xl bg-slate-800/50 border-dashed">
                <p className="text-slate-300 text-sm mb-3">
                  Nenhum jogo encontrado.
                </p>
                <button
                  onClick={() => void handleManualMatchesSync()}
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

            {currentUser.role !== "ADMIN" && <RulesSection />}

            {currentUser.role !== "ADMIN" && (
              <TopScorerCard
                prediction={currentUser.tournamentPredictions}
                onPredict={predictTournament}
                lockDate={lockDate}
                finalResult={tournamentResults}
              />
            )}

            {/* 1. Past Matches Grouped by Matchday/Phase (Wrapped in one main container) */}
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
                  {isPastMatchesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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
                          userPredictions={myPredictionsMap}
                          leaderboardData={leaderboardData}
                          onPredict={predictMatch}
                          isAdmin={currentUser.role === "ADMIN"}
                          onFinishMatch={adminControls.finishMatch}
                        />
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Today's Matches Group (Highlighted) */}
            <MatchGroup
              title="Jogos do Dia"
              matches={todayMatches}
              isOpenDefault={true}
              isToday={true}
              icon={<CalendarDays size={20} className="text-brand-green" />}
              userPredictions={myPredictionsMap}
              leaderboardData={leaderboardData}
              onPredict={predictMatch}
              isAdmin={currentUser.role === "ADMIN"}
              onFinishMatch={adminControls.finishMatch}
            />

            {/* Fallback if todayMatches is empty (e.g. rest day) */}
            {todayMatches.length === 0 &&
              Object.keys(pastGroups).length > 0 &&
              Object.keys(futureGroups).length > 0 && (
                <div className="text-center py-8 border border-slate-700 rounded-xl bg-slate-800/50 border-dashed">
                  <p className="text-slate-400 text-sm">
                    Nenhum jogo agendado para hoje.
                  </p>
                </div>
              )}

            {/* 3. Future Matches Groups (Accordion by Date) */}
            {Object.entries(futureGroups)
              .sort()
              .map(([dateStr, groupMatches]) => (
                <MatchGroup
                  key={dateStr}
                  title={formatDateTitle(dateStr)}
                  matches={groupMatches}
                  isOpenDefault={false}
                  icon={<CalendarDays size={18} className="text-slate-500" />}
                  userPredictions={myPredictionsMap}
                  leaderboardData={leaderboardData}
                  onPredict={predictMatch}
                  isAdmin={currentUser.role === "ADMIN"}
                  onFinishMatch={adminControls.finishMatch}
                />
              ))}
          </div>
        )}

        {/* Tournament Standings Tab */}
        {activeTab === "tournament" && (
          <TournamentStandings
            matches={matches}
            competitionCode={activeCompetitionCode}
            canPersistToDatabase={canWriteCompetitionData}
          />
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <Leaderboard sections={leaderboardSections} />
        )}

        {/* Admin Tab */}
        {activeTab === "admin" && currentUser.role === "ADMIN" && (
          <AdminDashboard
            users={users}
            groups={groups}
            currentUser={currentUser}
            onInvite={adminActions.inviteUser}
            onUpdateRole={adminActions.updateUserRole}
            onRemoveUser={adminActions.removeUser}
            onCreateGroup={(name: string, competitionCode: string) =>
              createGroupWithCompetitionBootstrap(name, competitionCode, {
                joinCreator: false,
              }).then(() => undefined)
            }
            onDeleteGroup={deleteGroup}
            onAddUserToGroup={adminActions.adminAddUserToGroup}
            onRemoveUserFromGroup={adminActions.adminRemoveUserFromGroup}
            isSyncing={isSyncing}
            isAutoSyncEnabled={isAutoSyncEnabled}
            toggleAutoSync={toggleAutoSync}
            syncStatusByCompetition={syncStatusByCompetition}
            onManualSync={handleAdminSyncCompetition}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={currentUser.role}
      />

      {syncFeedback.isOpen && (
        <ModalShell
          title={
            <span className="inline-flex items-center gap-2">
              {syncFeedback.isError ? (
                <AlertTriangle size={18} className="text-amber-400" />
              ) : (
                <CheckCircle2 size={18} className="text-brand-green" />
              )}
              {syncFeedback.title}
            </span>
          }
          onClose={() =>
            setSyncFeedback((prev) => ({
              ...prev,
              isOpen: false,
            }))
          }
          maxWidthClassName="max-w-lg"
          panelClassName="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl"
          contentClassName="p-5"
          footerClassName="px-5 pb-5"
          footer={
            <button
              onClick={() =>
                setSyncFeedback((prev) => ({
                  ...prev,
                  isOpen: false,
                }))
              }
              className="w-full py-2.5 rounded-lg bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold text-sm transition-colors"
            >
              OK
            </button>
          }
        >
          <p className="text-sm text-slate-200 leading-relaxed">
            {syncFeedback.message}
          </p>
        </ModalShell>
      )}
    </div>
  );
};

export default App;
