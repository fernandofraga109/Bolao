
import { useState, useMemo } from 'react';
import { User, UserRole, TournamentPredictions, Group } from '../types';
import { useDatabase } from '../contexts/DatabaseContext';

export const useUserSystem = () => {
  const db = useDatabase();
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
      return localStorage.getItem('bolao_current_user_id');
  });

  // --- HYDRATION: Convert DB Normalized Data to UI User Objects ---
  // This performs the "SQL JOIN" logic
  const hydratedUsers: User[] = useMemo(() => {
      return db.users.map(user => {
          // Join UserGroups
          const myGroups = db.userGroups.filter(ug => ug.userId === user.id).map(ug => ug.groupId);
          
          // Join Predictions
          const myPredictionsMap: Record<string, { home: number; away: number }> = {};
          db.predictions.filter(p => p.userId === user.id).forEach(p => {
              myPredictionsMap[p.matchId] = { home: p.homeScore, away: p.awayScore };
          });

          // Join Tournament Predictions
          const tpDb = db.tournamentPredictions.find(tp => tp.userId === user.id);
          const tp: TournamentPredictions | undefined = tpDb ? {
              championTeamId: tpDb.championTeamId,
              topScorer: (tpDb.topScorerPlayer || tpDb.topScorerGoals) ? {
                  player: tpDb.topScorerPlayer || '',
                  goals: tpDb.topScorerGoals || 0
              } : undefined,
              bestPlayer: tpDb.bestPlayer,
              bestGoalkeeper: tpDb.bestGoalkeeper
          } : undefined;

          return {
              ...user,
              groupIds: myGroups,
              predictions: myPredictionsMap,
              tournamentPredictions: tp
          };
      });
  }, [db.users, db.userGroups, db.predictions, db.tournamentPredictions]);

  const currentUser = useMemo(() => {
      if (!currentUserId) return null;
      return hydratedUsers.find(u => u.id === currentUserId) || null;
  }, [currentUserId, hydratedUsers]);

  // --- ACTIONS ---

  const login = (user: User) => {
    setCurrentUserId(user.id);
    localStorage.setItem('bolao_current_user_id', user.id);
  };

  const loginWithCredentials = (email: string, password: string) => {
      const user = hydratedUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user) return { success: false, message: 'Usuário não encontrado.' };
      if (user.password !== password) return { success: false, message: 'Senha incorreta.' };
      login(user);
      return { success: true, user };
  };

  const register = (name: string, email: string, password: string, groupCode: string, groupsList: Group[]) => {
      if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
          return { success: false, message: 'E-mail já cadastrado.' };
      }
      const group = groupsList.find(g => g.code.toUpperCase() === groupCode.toUpperCase());
      if (!group) return { success: false, message: 'Código de grupo inválido.' };

      const newId = `u_${Date.now()}`;
      
      // 1. Insert into User Table
      db.addUser({
          id: newId,
          name,
          email,
          password,
          avatar: `https://ui-avatars.com/api/?name=${name.replace(' ', '+')}&background=random`,
          role: 'USER',
          status: 'ACTIVE',
          activeGroupId: group.id,
          totalPoints: 0
      });

      // 2. Insert into UserGroup Table
      db.addUserToGroup({
          userId: newId,
          groupId: group.id,
          joinedAt: new Date().toISOString()
      });

      // Login will happen via effect when hydratedUsers updates, but we set ID now
      setCurrentUserId(newId);
      localStorage.setItem('bolao_current_user_id', newId);
      
      return { success: true };
  };

  const logout = () => {
    setCurrentUserId(null);
    localStorage.removeItem('bolao_current_user_id');
  };

  const joinGroup = (userId: string, groupId: string) => {
      db.addUserToGroup({
          userId,
          groupId,
          joinedAt: new Date().toISOString()
      });
      // Switch active group automatically
      db.updateUser(userId, { activeGroupId: groupId });
  };

  const switchGroup = (userId: string, groupId: string) => {
      db.updateUser(userId, { activeGroupId: groupId });
  };

  const predictMatch = (matchId: string, home: number, away: number) => {
    if (!currentUser) return;
    db.upsertPrediction({
        userId: currentUser.id,
        matchId,
        homeScore: home,
        awayScore: away,
        timestamp: new Date().toISOString()
    });
  };

  const predictTournament = (data: TournamentPredictions) => {
    if (!currentUser) return;
    db.upsertTournamentPrediction({
        userId: currentUser.id,
        championTeamId: data.championTeamId,
        topScorerPlayer: data.topScorer?.player,
        topScorerGoals: data.topScorer?.goals,
        bestPlayer: data.bestPlayer,
        bestGoalkeeper: data.bestGoalkeeper
    });
  };

  // --- Admin Actions ---
  const inviteUser = (email: string) => console.log("Inviting", email);
  const updateUserRole = (userId: string, newRole: UserRole) => db.updateUser(userId, { role: newRole });
  
  const removeUser = async (userId: string) => {
      console.log(`🗑️ useUserSystem: Solicitando exclusão do usuário ${userId}`);
      await db.deleteUser(userId);
  };
  
  // Fix: made adminAddUserToGroup async to match db operations and expected return type in AdminDashboard
  const adminAddUserToGroup = async (userId: string, groupId: string) => {
      await db.addUserToGroup({ userId, groupId, joinedAt: new Date().toISOString() });
  };

  // Fix: made adminRemoveUserFromGroup async and added awaits to ensure proper execution of db operations
  const adminRemoveUserFromGroup = async (userId: string, groupId: string) => {
      await db.removeUserFromGroup(userId, groupId);
      // If user was viewing this group, reset their active group preference
      const user = hydratedUsers.find(u => u.id === userId);
      if (user && user.activeGroupId === groupId) {
          // Find another group they are in
          const otherGroup = user.groupIds.find(gid => gid !== groupId);
          await db.updateUser(userId, { activeGroupId: otherGroup });
      }
  };

  return {
    users: hydratedUsers,
    currentUser,
    login,
    loginWithCredentials,
    register,
    logout,
    joinGroup,
    switchGroup,
    predictMatch,
    predictTournament,
    adminActions: {
        inviteUser,
        updateUserRole,
        removeUser,
        adminAddUserToGroup,
        adminRemoveUserFromGroup
    }
  };
};
