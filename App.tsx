import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Tab, MatchStatus } from "./types";
import { getMatchPhase } from "./utils/scoring";

// Custom Hooks
import { useUserSystem } from "./hooks/useUserSystem";
import { useMatchSystem } from "./hooks/useMatchSystem";
import { useGroupSystem } from "./hooks/useGroupSystem";
import { useLeaderboard } from "./hooks/useLeaderboard";
import { usePasswordRecovery } from "./hooks/usePasswordRecovery";
import { usePollingRefresh } from "./hooks/usePollingRefresh";
import { useDatabase } from "./contexts/DatabaseContext";

// Layout Components
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import SplashScreen from "./components/ui/SplashScreen";
import { SyncToastContainer, useSyncToast } from "./components/ui/SyncToast";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import PullToRefreshIndicator from "./components/ui/PullToRefreshIndicator";

// Auth
import Login from "./components/Login";
import GroupSwitcher from "./components/GroupSwitcher";
import DeactivatedUserModal from "./components/DeactivatedUserModal";

// Pages
import MatchesPage from "./components/pages/MatchesPage";
import LeaderboardPage from "./components/pages/LeaderboardPage";
import StatsPage from "./components/pages/StatsPage";
import TournamentPage from "./components/pages/TournamentPage";
import AdminPage from "./components/pages/AdminPage";
import SpecialsPage from "./components/pages/SpecialsPage";

import { DEFAULT_COMPETITION_CODE, getCompetitionByCode } from "./data/competitions";
import { CURRENT_VERSION } from "./data/releases";
import WhatsNewModal from "./components/ui/WhatsNewModal";
import {
  ChevronsUpDown,
  PlusCircle,
} from "lucide-react";
import RegulamentoModal from "./components/RegulamentoModal";
import PendingPredictionsBanner from "./components/PendingPredictionsBanner";


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
    updateProfile,
    adminActions,
  } = useUserSystem();

  const { isPasswordRecoveryFlow, finishPasswordRecoveryFlow } = usePasswordRecovery(currentUser);

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

  // --- Toast de sincronização ---
  const { toasts, dismiss, showSyncing, showResult, showWarning, showInfo } = useSyncToast();

  const handleSetActiveTab = (tab: Tab) => {
    if (tab === "leaderboard") {
      db.refetchUserGroups();
      db.refetchPredictions();
    }
    setActiveTab(tab);
  };

  const handleBgSyncStart = useCallback((code: string) => {
    const name = db.competitions.find(c => c.code.toUpperCase() === code)?.name;
    showSyncing(code, name);
  }, [db.competitions, showSyncing]);

  const handleBgSyncEnd = useCallback((code: string, success: boolean, message: string) => {
    const name = db.competitions.find(c => c.code.toUpperCase() === code)?.name;
    const isWaiting = !success && (
      message.toLowerCase().includes('aguardando') ||
      message.toLowerCase().includes('já em andamento')
    );
    if (isWaiting) {
      showWarning(code, message, name);
    } else {
      showResult(code, success, message, name);
    }
  }, [db.competitions, showResult, showWarning]);

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
  } = useMatchSystem(activeCompetitionCode, canWriteCompetitionData, handleBgSyncStart, handleBgSyncEnd);

  const {
    groups,
    createGroup,
    deleteGroup,
    getGroupByCode,
    getGroupById,
    getGroupsByIds,
  } = useGroupSystem();

  // Polling automático: verifica a cada 15s se o placar mudou no banco
  // e dispara refetch de predictions + user_groups para atualizar o ranking
  usePollingRefresh({
    matches,
    refetchMatches: db.refetchMatches,
    refetchPredictions: db.refetchPredictions,
    refetchUserGroups: db.refetchUserGroups,
    enabled: !!currentUser && authReady,
  });

  const resolvedActiveGroupId =
    currentUser?.activeGroupId || currentUser?.groupIds?.[0];

  const currentGroup = resolvedActiveGroupId
    ? getGroupById(resolvedActiveGroupId)
    : undefined;

  const eligibleGroups = useMemo(() => {
    if (!currentUser || !currentGroup) return [];

    return db.groups.filter((g) => {
      // O usuário precisa pertencer a esse grupo
      const isMember = currentUser.groupIds.includes(g.id);
      // Não pode ser o grupo ativo atual
      const isNotCurrent = g.id !== currentGroup.id;
      // Deve ter o mesmo competitionCode (ignoring case)
      const isSameCompetition =
        (g.competitionCode || "").toUpperCase() ===
        (currentGroup.competitionCode || "").toUpperCase();
      // Deve ter o mesmo regulamento
      const isSameRuleset = g.ruleset === currentGroup.ruleset;

      return isMember && isNotCurrent && isSameCompetition && isSameRuleset;
    });
  }, [currentUser, currentGroup, db.groups]);

  const currentGroupTeamIds = useMemo(() => {
    const ids = new Set<string>();
    matches.forEach((match) => {
      if (match.homeTeam?.id) ids.add(match.homeTeam.id);
      if (match.awayTeam?.id) ids.add(match.awayTeam.id);
    });
    return Array.from(ids);
  }, [matches]);

  const phaseLockSet = useMemo(() => {
    if (currentGroup?.ruleset !== "regulamento_2") return new Set<string>();
    const locked = new Set<string>();
    const now = new Date();
    matches.forEach((m) => {
      const started = m.status !== MatchStatus.SCHEDULED || now > new Date(m.date);
      if (started) {
        locked.add(getMatchPhase(m.stage, m.group));
      }
    });
    return locked;
  }, [matches, currentGroup?.ruleset]);

  const [activeTab, setActiveTab] = useState<Tab>("matches");
  const [groupError, setGroupError] = useState<string | null>(null);
  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false);
  const [isRegulamentoOpen, setIsRegulamentoOpen] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("bolao_last_seen_version");
    if (seen !== CURRENT_VERSION) setShowWhatsNew(true);
  }, []);


  const handleWhatsNewClose = () => {
    localStorage.setItem("bolao_last_seen_version", CURRENT_VERSION);
    setShowWhatsNew(false);
  };
  const handleAdminSyncCompetition = async (competitionCode: string) => {
    if (!canWriteCompetitionData) return;

    const name = db.competitions.find(c => c.code.toUpperCase() === competitionCode.toUpperCase())?.name;
    showSyncing(competitionCode, name);
    const result = await syncMatchesAndStandings(competitionCode, true);
    await Promise.all([db.refetchMatches(), db.refetchTeamStandings()]);
    showResult(competitionCode, result.success, result.message, name);
  };

  const handleRefreshData = async () => {
    await Promise.all([
      db.refetchMatches(), 
      db.refetchPredictions(), 
      db.refetchTeamStandings(),
      db.refetchUserGroups()
    ]);
  };

  const handleManualMatchesSync = async () => {
    const name = db.competitions.find(c => c.code.toUpperCase() === activeCompetitionCode.toUpperCase())?.name;

    if (!canWriteCompetitionData) {
      showResult(activeCompetitionCode, false, "Somente administradores podem sincronizar dados no banco.", name);
      return;
    }

    showSyncing(activeCompetitionCode, name);
    const result = await syncWithExternalApi(activeCompetitionCode);
    await Promise.all([db.refetchMatches(), db.refetchTeamStandings()]);
    showResult(activeCompetitionCode, result.success, result.message, name);
  };

  const handleAdminSaveMatch = async (
    matchId: string,
    status: "started" | "live" | "ended",
    home: number,
    away: number,
  ) => {
    try {
      if (status === "started") {
        // Zerar completamente o jogo: volta para SCHEDULED sem placar
        await db.updateMatch(matchId, {
          status: MatchStatus.SCHEDULED,
          resultHome: null,
          resultAway: null,
          minute: null,
        });
      } else if (status === "ended") {
        await adminControls.finishMatch(matchId, home, away);
      } else {
        // live
        await adminControls.updateLiveScore(matchId, home, away);
      }
    } catch (error) {
      alert(`Erro ao salvar partida: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleAdminToggleSyncLock = async (matchId: string, locked: boolean) => {
    try {
      await db.updateMatch(matchId, { syncLocked: locked });
      console.log(`[ADMIN] Jogo ${matchId} sync ${locked ? "bloqueado" : "desbloqueado"}`);
    } catch (error) {
      alert(`Erro ao alterar lock: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const {
    usersWithCalculatedPoints,
    leaderboardData,
    leaderboardSections,
  } = useLeaderboard(
    users,
    matches,
    currentUser,
    tournamentResults,
    db,
    groups
  );



  // O background sync (via useBackgroundSync dentro de useMatchSystem)
  // já cuida de manter os dados atualizados para todos os usuários.
  // Não é necessário disparar sync manual aqui ao entrar/trocar de grupo.

  const currentUserRank = useMemo(() => {
    if (!currentUser || !leaderboardSections.length) return 0;
    const activeGroupId = currentUser.activeGroupId || currentUser.groupIds?.[0];
    const section = leaderboardSections.find(s => s.groupId === activeGroupId);
    if (!section?.users.length) return 0;
    const sorted = [...section.users].sort((a, b) => b.totalPoints - a.totalPoints);
    const myPoints = sorted.find(u => u.id === currentUser.id)?.totalPoints;
    if (myPoints === undefined) return 0;
    return sorted.filter(u => u.totalPoints > myPoints).length + 1;
  }, [currentUser, leaderboardSections]);

  const currentUserPoints = useMemo(() => {
    if (!currentUser || !leaderboardSections.length) return 0;
    const activeGroupId = currentUser.activeGroupId || currentUser.groupIds?.[0];
    const section = leaderboardSections.find(s => s.groupId === activeGroupId);
    return section?.users.find(u => u.id === currentUser.id)?.totalPoints || 0;
  }, [currentUser, leaderboardSections]);

  // Notificação toast quando os pontos do usuário aumentam via Realtime (ex: admin finalizou jogo)
  const prevUserPointsRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevUserPointsRef.current;
    prevUserPointsRef.current = currentUserPoints;

    // Só notificar se já tínhamos um valor anterior e os pontos aumentaram
    if (prev !== null && currentUserPoints > prev && currentUser) {
      const diff = currentUserPoints - prev;
      const groupName = currentGroup?.name || "Bolão";
      showInfo(
        activeCompetitionCode,
        `+${diff} pts! Seu ranking em "${groupName}" foi atualizado.`,
        activeCompetitionCode
      );
    }
  }, [currentUserPoints, currentUser, currentGroup, activeCompetitionCode, showInfo]);

  const { containerRef: mainRef, pullDistance, isRefreshing, handlers: pullHandlers } = usePullToRefresh({
    onRefresh: handleRefreshData,
    disabled: isSyncing,
  });

  // --- Render Auth Screen ---
  if (!authReady) {
    return <SplashScreen />;
  }

  if (!currentUser || isPasswordRecoveryFlow) {
    return (
      <Login
        onLogin={(user) => {
          finishPasswordRecoveryFlow();
          login(user);
          handleSetActiveTab(user.role === "ADMIN" ? "admin" : "matches");
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

  // --- Deactivated User Block ---
  if (currentUser.role === "DEACTIVATED") {
    return (
      <div className="min-h-screen bg-brand-dark">
        <DeactivatedUserModal onLogout={logout} />
      </div>
    );
  }

  // --- Helpers for Group Switching ---
  const createGroupWithCompetitionBootstrap = async (
    name: string,
    competitionCode: string,
    options: { joinCreator: boolean },
    ruleset: "regulamento_1" | "regulamento_2" = "regulamento_1",
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
      ruleset,
    );

    if (options.joinCreator) {
      joinGroup(currentUser.id, newGroup.id);
    }

    if (!competitionAlreadyRegistered) {
      showSyncing(normalizedCompetitionCode, normalizedCompetitionCode);
      const bootstrapResult = await syncMatchesAndStandings(
        normalizedCompetitionCode,
      );
      const bootstrapMsg = bootstrapResult.success
        ? `Competição ${normalizedCompetitionCode} inicializada. ${bootstrapResult.message}`
        : `Competição criada, mas carga inicial falhou. ${bootstrapResult.message}`;
      showResult(normalizedCompetitionCode, bootstrapResult.success, bootstrapMsg, normalizedCompetitionCode);
    }

    return newGroup;
  };

  const handleCreateGroup = (
    name: string,
    competitionCode: string,
    ruleset: "regulamento_1" | "regulamento_2" = "regulamento_1",
  ) => {
    void createGroupWithCompetitionBootstrap(name, competitionCode, {
      joinCreator: true,
    }, ruleset);
    setGroupError(null);
    setIsGroupSwitcherOpen(false);
  };

  const handleJoinGroup = async (code: string) => {
    const group = getGroupByCode(code);
    if (group) {
      if (currentUser.groupIds.includes(group.id)) {
        await switchGroup(currentUser.id, group.id);
      } else {
        joinGroup(currentUser.id, group.id);
      }
      if (canWriteCompetitionData) {
        void syncMatchesAndStandings(
          (group.competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase(),
        );
      }
      // Forçar recarregamento dos palpites para o novo grupo
      db.refetchPredictions();
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
        onUpdateProfile={updateProfile}
        userPoints={currentUserPoints}
        userRank={currentUserRank}
        syncInfo={syncStatusByCompetition[activeCompetitionCode]}
        competitionLastSync={
          db.competitions.find(c => c.code.toUpperCase() === activeCompetitionCode)?.lastSync
        }
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
                      {currentGroup.ruleset === "regulamento_2" ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setIsRegulamentoOpen(true); }}
                          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/40 hover:text-indigo-200 transition-colors cursor-pointer"
                          title="Ver Regulamento"
                        >
                          R2
                        </button>
                      ) : (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          R1
                        </span>
                      )}
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

          {db.isInitialFetchComplete && (
            <PendingPredictionsBanner
              matches={matches}
              predictions={myPredictionsMap}
              ruleset={currentGroup?.ruleset}
              phaseLockSet={phaseLockSet}
              isAdmin={currentUser.role === "ADMIN"}
              tournamentPredictions={currentUser.tournamentPredictions}
              extraPhasePredictions={db.extraPhasePredictions}
              lockDate={lockDate}
              groupId={currentUser.activeGroupId}
              userId={currentUser.id}
            />
          )}
        </div>
      )}

      {/* Group Switcher Modal */}
      {isGroupSwitcherOpen && (
        <GroupSwitcher
          myGroups={myGroupsList}
          activeGroupId={currentUser.activeGroupId}
          onSwitch={async (id) => {
            await switchGroup(currentUser.id, id);
            const nextGroup = getGroupById(id);
            if (canWriteCompetitionData) {
              void syncMatchesAndStandings(
                (
                  nextGroup?.competitionCode || DEFAULT_COMPETITION_CODE
                ).toUpperCase(),
              );
            }
            // Forçar recarregamento dos palpites para o novo grupo
            db.refetchPredictions();
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

      <main ref={mainRef} className="max-w-2xl mx-auto p-4" {...pullHandlers}>
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
        {/* Matches Tab */}
        {activeTab === "matches" && (
          <MatchesPage
            matches={resolvedActiveGroupId || currentUser.role === "ADMIN" ? matches : []}
            userHasGroup={!!(resolvedActiveGroupId || currentUser.role === "ADMIN")}
            userPredictions={myPredictionsMap}
            leaderboardData={leaderboardData}
            currentUser={currentUser}
            isSyncing={isSyncing}
            canWriteCompetitionData={canWriteCompetitionData}
            onManualSync={() => void handleManualMatchesSync()}
            onPredict={predictMatch}
            onAdminSaveMatch={handleAdminSaveMatch}
            onAdminToggleSyncLock={handleAdminToggleSyncLock}
            onOpenGroupSwitcher={() => setIsGroupSwitcherOpen(true)}
            minRankDiff={currentGroup?.underdog_min_rank_diff ?? db.systemConfig.underdog_min_rank_diff ?? 10}
            ruleset={currentGroup?.ruleset}
            eligibleGroups={eligibleGroups}
          />
        )}

        {/* Specials Tab */}
        {activeTab === "specials" && currentUser.role !== "ADMIN" && (
          <SpecialsPage
            matches={matches}
            currentUser={currentUser}
            tournamentResults={tournamentResults}
            lockDate={lockDate}
            onPredictTournament={predictTournament}
            allowedChampionTeamIds={currentGroupTeamIds}
            ruleset={currentGroup?.ruleset}
            competitionCode={activeCompetitionCode}
          />
        )}

        {/* Tournament Standings Tab */}
        {activeTab === "tournament" && (
          <TournamentPage
            matches={resolvedActiveGroupId || currentUser.role === "ADMIN" ? matches : []}
            userHasGroup={!!(resolvedActiveGroupId || currentUser.role === "ADMIN")}
            competitionCode={activeCompetitionCode}
            canPersistToDatabase={canWriteCompetitionData}
          />
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && currentUser.role !== "ADMIN" && (
          <LeaderboardPage
            sections={leaderboardSections.filter(
              (s) => s.groupId === resolvedActiveGroupId
            )}
            allUsers={users}
            matches={matches}
            groups={groups}
            tournamentResults={tournamentResults}
            currentUserId={currentUser.id}
            rawPredictions={db.predictions}
            lockDate={lockDate}
          />
        )}

        {/* User Stats Tab */}
        {activeTab === "stats" && currentUser.role !== "ADMIN" && (
          <StatsPage user={currentUser} matches={matches} ruleset={currentGroup?.ruleset} />
        )}

        {/* Admin Tab */}
        {activeTab === "admin" && currentUser.role === "ADMIN" && (
          <AdminPage
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

      {/* What's New Modal */}
      {showWhatsNew && <WhatsNewModal onClose={handleWhatsNewClose} />}

      {/* Regulamento Modal */}
      {isRegulamentoOpen && <RegulamentoModal onClose={() => setIsRegulamentoOpen(false)} />}

      {/* Sync Toast Notifications */}
      <SyncToastContainer toasts={toasts} onDismiss={dismiss} />

      <BottomNav
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        userRole={currentUser.role}
      />

    </div>
  );
};

export default App;
