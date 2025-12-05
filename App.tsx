import React, { useState, useMemo } from 'react';
import { Tab, MatchStatus } from './types';
import { calculatePoints, calculateTournamentPoints } from './utils/scoring';

// Custom Hooks
import { useUserSystem } from './hooks/useUserSystem';
import { useMatchSystem } from './hooks/useMatchSystem';
import { useGroupSystem } from './hooks/useGroupSystem';

// Layout Components
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import RulesSection from './components/RulesSection';

// Feature Components
import MatchCard from './components/MatchCard';
import Leaderboard from './components/Leaderboard';
import TopScorerCard from './components/TopScorerCard';
import Login from './components/Login';
import GroupSelection from './components/GroupSelection';
import AdminDashboard from './components/AdminDashboard';
import GroupSwitcher from './components/GroupSwitcher';
import { ChevronsUpDown } from 'lucide-react';

const App: React.FC = () => {
  // --- Custom Hooks (Modularized State) ---
  const { 
    users, 
    currentUser, 
    login, 
    logout, 
    joinGroup,
    switchGroup,
    predictMatch, 
    predictTournament, 
    adminActions 
  } = useUserSystem();

  const { 
    matches, 
    tournamentResults, 
    lockDate, 
    simulateLiveGame,
    updateMatchResult
  } = useMatchSystem();

  const {
    groups,
    createGroup,
    getGroupByCode,
    getGroupById,
    getGroupsByIds
  } = useGroupSystem();

  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [groupError, setGroupError] = useState<string | null>(null);
  const [isGroupSwitcherOpen, setIsGroupSwitcherOpen] = useState(false);

  // --- Calculations (Leaderboard) ---
  // Calculates points dynamically based on current users and current match results
  const leaderboardData = useMemo(() => {
    // Only calculate for users in the ACTIVE group of the current user
    if (!currentUser || !currentUser.activeGroupId) return [];

    // Filter out users strictly for the current group AND EXCLUDE ADMINS from leaderboard
    const groupUsers = users.filter(u => 
        u.groupIds.includes(currentUser.activeGroupId!) && 
        u.role !== 'ADMIN'
    );

    return groupUsers.map(user => {
      let total = 0;
      
      // Match Points
      matches.forEach(match => {
        if (match.status === MatchStatus.FINISHED && match.result && user.predictions[match.id]) {
          const pred = user.predictions[match.id];
          total += calculatePoints(pred.home, pred.away, match.result.home, match.result.away);
        }
      });

      // Tournament Points (Champion, Top Scorer, etc)
      if (tournamentResults) {
        total += calculateTournamentPoints(user.tournamentPredictions, tournamentResults);
      }

      return { ...user, totalPoints: total };
    });
  }, [matches, users, tournamentResults, currentUser]);

  const currentGroup = currentUser?.activeGroupId ? getGroupById(currentUser.activeGroupId) : undefined;


  // --- Render Auth Screen ---
  if (!currentUser) {
    return (
        <Login 
            onLogin={(user) => {
                login(user);
                // If admin, go straight to admin tab, else matches
                setActiveTab(user.role === 'ADMIN' ? 'admin' : 'matches'); 
            }} 
            availableUsers={users} 
        />
    );
  }

  // --- Render Initial Group Selection (If user has NO groups at all AND IS NOT ADMIN) ---
  // Admins can bypass group selection to perform maintenance
  if (currentUser.groupIds.length === 0 && currentUser.role !== 'ADMIN') {
      return (
          <GroupSelection 
              user={currentUser}
              error={groupError}
              onCreateGroup={(name) => {
                  const newGroup = createGroup(name, currentUser.id);
                  joinGroup(currentUser.id, newGroup.id);
                  setGroupError(null);
              }}
              onJoinGroup={(code) => {
                  const group = getGroupByCode(code);
                  if (group) {
                      joinGroup(currentUser.id, group.id);
                      setGroupError(null);
                  } else {
                      setGroupError('Código de grupo inválido. Tente "COPA26" para o grupo de exemplo.');
                  }
              }}
          />
      );
  }

  // --- Helpers for Group Switching ---
  const handleCreateGroup = (name: string) => {
      const newGroup = createGroup(name, currentUser.id);
      joinGroup(currentUser.id, newGroup.id);
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
          setGroupError(null);
          setIsGroupSwitcherOpen(false);
      } else {
          setGroupError('Código inválido.');
      }
  };

  const myGroupsList = getGroupsByIds(currentUser.groupIds);
  
  // Helper to get current user's predictions easily (if they are playing)
  const myPredictionsMap = currentUser.predictions || {};

  return (
    <div className="min-h-screen pb-20 bg-brand-dark text-slate-100 font-sans selection:bg-brand-green selection:text-brand-dark">
      
      <Header 
        currentUser={currentUser} 
        onLogout={logout} 
        onSimulate={simulateLiveGame} 
      />
      
      {/* Group Info Bar (Clickable) - Only show if user has a group selected */}
      {currentGroup && (
          <div className="max-w-2xl mx-auto px-4 mt-4">
            <div 
                onClick={() => setIsGroupSwitcherOpen(true)}
                className="bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 flex justify-between items-center text-xs cursor-pointer hover:bg-slate-700/80 hover:border-slate-600 transition-all group shadow-sm"
            >
                <div className="flex items-center gap-3">
                    <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">Grupo</span>
                    <div className="flex items-center gap-2">
                        <strong className="text-white text-sm">{currentGroup.name}</strong>
                        <ChevronsUpDown size={14} className="text-brand-green opacity-70 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>
                <span className="text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded text-[10px] border border-slate-700/50">
                    #{currentGroup.code}
                </span>
            </div>
          </div>
      )}

      {/* Group Switcher Modal */}
      {isGroupSwitcherOpen && (
          <GroupSwitcher 
              myGroups={myGroupsList}
              activeGroupId={currentUser.activeGroupId}
              onSwitch={(id) => {
                  switchGroup(currentUser.id, id);
                  setIsGroupSwitcherOpen(false);
              }}
              onCreate={handleCreateGroup}
              onJoin={handleJoinGroup}
              onClose={() => {
                  setIsGroupSwitcherOpen(false);
                  setGroupError(null);
              }}
              error={groupError}
          />
      )}

      <main className="max-w-2xl mx-auto p-4">
        {/* Matches Tab */}
        {activeTab === 'matches' && (
          <div className="space-y-6">
             {currentUser.role !== 'ADMIN' && <RulesSection />}

             {currentUser.role !== 'ADMIN' && (
                <TopScorerCard 
                    prediction={currentUser.tournamentPredictions}
                    onPredict={predictTournament}
                    lockDate={lockDate}
                    finalResult={tournamentResults}
                />
             )}

             {matches.map(match => (
              <MatchCard 
                key={match.id}
                match={match}
                userPrediction={myPredictionsMap[match.id] ? { matchId: match.id, homeScore: myPredictionsMap[match.id].home, awayScore: myPredictionsMap[match.id].away } : undefined}
                friends={leaderboardData} // Filtered by active group AND excludes Admin
                onPredict={predictMatch}
                isAdmin={currentUser.role === 'ADMIN'}
                onUpdateScore={updateMatchResult}
              />
            ))}
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <Leaderboard users={leaderboardData} />
        )}

        {/* Admin Tab */}
        {activeTab === 'admin' && currentUser.role === 'ADMIN' && (
            <AdminDashboard 
                users={users} 
                groups={groups}
                currentUser={currentUser}
                onInvite={adminActions.inviteUser}
                onUpdateRole={adminActions.updateUserRole}
                onRemoveUser={adminActions.removeUser}
            />
        )}
      </main>

      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={currentUser.role} 
      />
    </div>
  );
};

export default App;