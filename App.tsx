import React, { useState, useMemo } from 'react';
import { Tab, MatchStatus, Match } from './types';
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
import TournamentStandings from './components/TournamentStandings';
import { ChevronsUpDown, ChevronDown, ChevronUp, CalendarDays, History } from 'lucide-react';

// --- Helper Component for Date Groups ---
interface MatchGroupProps {
  title: string;
  matches: Match[];
  isOpenDefault?: boolean;
  icon?: React.ReactNode;
  userPredictions: Record<string, any>;
  leaderboardData: any[];
  onPredict: (id: string, h: number, a: number) => void;
  isAdmin: boolean;
  onUpdateScore: (id: string, h: number, a: number) => void;
  isToday?: boolean;
}

const MatchGroup: React.FC<MatchGroupProps> = ({ 
  title, matches, isOpenDefault = false, icon, userPredictions, leaderboardData, onPredict, isAdmin, onUpdateScore, isToday 
}) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  if (matches.length === 0) return null;

  return (
    <div className="mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
          isToday 
            ? 'bg-brand-green/10 border-brand-green/30 text-white mb-3 shadow-lg shadow-brand-green/5' 
            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/80'
        }`}
      >
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-left">
            <h3 className={`font-bold ${isToday ? 'text-lg' : 'text-sm'}`}>{title}</h3>
            {!isOpen && <span className="text-[10px] opacity-70">{matches.length} jogos</span>}
          </div>
        </div>
        {isOpen ? <ChevronUp size={isToday ? 20 : 16} /> : <ChevronDown size={isToday ? 20 : 16} />}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-6 animate-fadeIn">
          {matches.map(match => (
            <MatchCard 
              key={match.id}
              match={match}
              userPrediction={userPredictions[match.id] ? { matchId: match.id, homeScore: userPredictions[match.id].home, awayScore: userPredictions[match.id].away } : undefined}
              friends={leaderboardData}
              onPredict={onPredict}
              isAdmin={isAdmin}
              onUpdateScore={onUpdateScore}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
  const leaderboardData = useMemo(() => {
    if (!currentUser || !currentUser.activeGroupId) return [];

    const groupUsers = users.filter(u => 
        u.groupIds.includes(currentUser.activeGroupId!) && 
        u.role !== 'ADMIN'
    );

    return groupUsers.map(user => {
      let total = 0;
      matches.forEach(match => {
        if (match.status === MatchStatus.FINISHED && match.result && user.predictions[match.id]) {
          const pred = user.predictions[match.id];
          total += calculatePoints(
              pred.home, 
              pred.away, 
              match.result.home, 
              match.result.away,
              match.homeTeam.ranking,
              match.awayTeam.ranking
          );
        }
      });

      if (tournamentResults) {
        total += calculateTournamentPoints(user.tournamentPredictions, tournamentResults);
      }

      return { ...user, totalPoints: total };
    });
  }, [matches, users, tournamentResults, currentUser]);

  const currentGroup = currentUser?.activeGroupId ? getGroupById(currentUser.activeGroupId) : undefined;

  // --- Date Grouping Logic ---
  const { pastMatches, todayMatches, futureGroups } = useMemo(() => {
    // 1. Determine "Today" (Reference Date)
    // If real date is before the first match (June 11, 2026), simulate that today IS June 11.
    const now = new Date();
    const firstMatchDate = new Date('2026-06-11T00:00:00'); // Use fixed string to compare just date part logic
    
    // Check if we are really before the cup
    const isPreCup = now < firstMatchDate;
    
    // Normalize dates to YYYY-MM-DD for comparison
    const getDayString = (d: Date) => d.toISOString().split('T')[0];
    const todayStr = getDayString(isPreCup ? firstMatchDate : now);

    const past: Match[] = [];
    const today: Match[] = [];
    const future: Record<string, Match[]> = {};

    matches.forEach(match => {
        const mDate = new Date(match.date);
        const mDateStr = getDayString(mDate);

        if (mDateStr < todayStr) {
            past.push(match);
        } else if (mDateStr === todayStr) {
            today.push(match);
        } else {
            if (!future[mDateStr]) future[mDateStr] = [];
            future[mDateStr].push(match);
        }
    });

    // Sort past matches (newest first usually better for history, or oldest first? let's do oldest first for schedule)
    past.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Sort today matches by time
    today.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return { pastMatches: past, todayMatches: today, futureGroups: future };
  }, [matches]);

  const formatDateTitle = (dateStr: string) => {
      const date = new Date(dateStr + 'T12:00:00'); // Force midday to avoid timezone shifts on just date display
      return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  };


  // --- Render Auth Screen ---
  if (!currentUser) {
    return (
        <Login 
            onLogin={(user) => {
                login(user);
                setActiveTab(user.role === 'ADMIN' ? 'admin' : 'matches'); 
            }} 
            availableUsers={users} 
        />
    );
  }

  // --- Render Initial Group Selection ---
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
  const myPredictionsMap = currentUser.predictions || {};

  return (
    <div className="min-h-screen pb-20 bg-brand-dark text-slate-100 font-sans selection:bg-brand-green selection:text-brand-dark">
      
      <Header 
        currentUser={currentUser} 
        onLogout={logout} 
        onSimulate={simulateLiveGame} 
      />
      
      {/* Group Info Bar */}
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

             {/* 1. Past Matches Group */}
             {pastMatches.length > 0 && (
                <MatchGroup 
                    title="Jogos Anteriores"
                    matches={pastMatches}
                    isOpenDefault={false}
                    icon={<History size={18} className="text-slate-400" />}
                    userPredictions={myPredictionsMap}
                    leaderboardData={leaderboardData}
                    onPredict={predictMatch}
                    isAdmin={currentUser.role === 'ADMIN'}
                    onUpdateScore={updateMatchResult}
                />
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
                isAdmin={currentUser.role === 'ADMIN'}
                onUpdateScore={updateMatchResult}
             />
             
             {/* Fallback if todayMatches is empty (e.g. rest day) */}
             {todayMatches.length === 0 && pastMatches.length > 0 && Object.keys(futureGroups).length > 0 && (
                 <div className="text-center py-8 border border-slate-700 rounded-xl bg-slate-800/50 border-dashed">
                     <p className="text-slate-400 text-sm">Nenhum jogo agendado para hoje.</p>
                 </div>
             )}

             {/* 3. Future Matches Groups (Accordion by Date) */}
             {Object.entries(futureGroups).sort().map(([dateStr, groupMatches]) => (
                 <MatchGroup 
                    key={dateStr}
                    title={formatDateTitle(dateStr)}
                    matches={groupMatches}
                    isOpenDefault={false}
                    icon={<CalendarDays size={18} className="text-slate-500" />}
                    userPredictions={myPredictionsMap}
                    leaderboardData={leaderboardData}
                    onPredict={predictMatch}
                    isAdmin={currentUser.role === 'ADMIN'}
                    onUpdateScore={updateMatchResult}
                 />
             ))}
          </div>
        )}

        {/* Tournament Standings Tab */}
        {activeTab === 'tournament' && (
          <TournamentStandings matches={matches} />
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