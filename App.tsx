import React, { useState, useMemo, useEffect } from "react";
import { Tab } from "./types";

// Custom Hooks
import { useUserSystem } from "./hooks/useUserSystem";
import { useMatchSystem } from "./hooks/useMatchSystem";
import { useGroupSystem } from "./hooks/useGroupSystem";
import { useLeaderboard } from "./hooks/useLeaderboard";
import { usePasswordRecovery } from "./hooks/usePasswordRecovery";
import { useDatabase } from "./contexts/DatabaseContext";

// Layout Components
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import SplashScreen from "./components/ui/SplashScreen";
import ModalShell from "./components/ui/ModalShell";

// Auth
import Login from "./components/Login";
import GroupSwitcher from "./components/GroupSwitcher";

// Pages
import MatchesPage from "./components/pages/MatchesPage";
import LeaderboardPage from "./components/pages/LeaderboardPage";
import StatsPage from "./components/pages/StatsPage";
import TournamentPage from "./components/pages/TournamentPage";
import AdminPage from "./components/pages/AdminPage";

import { DEFAULT_COMPETITION_CODE, getCompetitionByCode } from "./data/competitions";
import {
  ChevronsUpDown,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";


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
      const result = await syncMatchesAndStandings(competitionCode, true);
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

  const currentUserRank = useMemo(() => {
    if (!currentUser || !leaderboardData.length) return 0;
    const sorted = [...leaderboardData].sort((a, b) => b.totalPoints - a.totalPoints);
    const myPoints = leaderboardData.find(u => u.id === currentUser.id)?.totalPoints;
    if (myPoints === undefined) return 0;
    // Rank is number of people with MORE points than me + 1
    return sorted.filter(u => u.totalPoints > myPoints).length + 1;
  }, [currentUser, leaderboardData]);

  const currentUserPoints = useMemo(() => {
    if (!currentUser || !leaderboardData.length) return 0;
    return leaderboardData.find(u => u.id === currentUser.id)?.totalPoints || 0;
  }, [currentUser, leaderboardData]);

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
        userPoints={currentUserPoints}
        userRank={currentUserRank}
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
          <MatchesPage
            matches={matches}
            userPredictions={myPredictionsMap}
            leaderboardData={leaderboardData}
            currentUser={currentUser}
            isSyncing={isSyncing}
            canWriteCompetitionData={canWriteCompetitionData}
            tournamentResults={tournamentResults}
            lockDate={lockDate}
            onManualSync={() => void handleManualMatchesSync()}
            onPredict={predictMatch}
            onFinishMatch={adminControls.finishMatch}
            onPredictTournament={predictTournament}
          />
        )}

        {/* Tournament Standings Tab */}
        {activeTab === "tournament" && (
          <TournamentPage
            matches={matches}
            competitionCode={activeCompetitionCode}
            canPersistToDatabase={canWriteCompetitionData}
          />
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && currentUser.role !== "ADMIN" && (
          <LeaderboardPage sections={leaderboardSections} />
        )}

        {/* User Stats Tab */}
        {activeTab === "stats" && currentUser.role !== "ADMIN" && (
          <StatsPage user={currentUser} matches={matches} />
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
