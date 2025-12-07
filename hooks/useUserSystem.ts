import { useState, useEffect } from 'react';
import { User, UserRole, TournamentPredictions } from '../types';
import { INITIAL_USERS } from '../constants';

export const useUserSystem = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Initialize users from localStorage or constants
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('bolao_users');
    // Migration: ensure old users have the new array structure if loaded from localstorage
    if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((u: any) => ({
            ...u,
            groupIds: u.groupIds || (u.groupId ? [u.groupId] : []),
            activeGroupId: u.activeGroupId || u.groupId
        }));
    }
    return INITIAL_USERS;
  });

  // Persist Users whenever they change
  useEffect(() => {
    localStorage.setItem('bolao_users', JSON.stringify(users));
  }, [users]);

  const login = (user: User) => {
    // Check if user exists
    const existingUser = users.find(u => u.email === user.email);
    
    if (existingUser) {
        setCurrentUser(existingUser);
    } else {
        // New User from Google: Register them
        const newUser = { ...user }; // Ensure we are not mutating the passed object
        setUsers(prev => [...prev, newUser]);
        setCurrentUser(newUser);
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const joinGroup = (userId: string, groupId: string) => {
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        // Add to groupIds if not present
        const newGroupIds = u.groupIds.includes(groupId) ? u.groupIds : [...u.groupIds, groupId];
        return { 
            ...u, 
            groupIds: newGroupIds,
            activeGroupId: groupId // Automatically switch to the new group
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    if (currentUser && currentUser.id === userId) {
        const updated = updatedUsers.find(u => u.id === userId);
        if (updated) setCurrentUser(updated);
    }
  };

  const switchGroup = (userId: string, groupId: string) => {
    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        if (!u.groupIds.includes(groupId)) return u; // Security check
        return { 
            ...u, 
            activeGroupId: groupId
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    if (currentUser && currentUser.id === userId) {
        const updated = updatedUsers.find(u => u.id === userId);
        if (updated) setCurrentUser(updated);
    }
  };

  const predictMatch = (matchId: string, home: number, away: number) => {
    if (!currentUser) return;

    const updatedUsers = users.map(u => {
      if (u.id === currentUser.id) {
        return {
          ...u,
          predictions: {
            ...u.predictions,
            [matchId]: { home, away }
          }
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    // Update local current user ref immediately
    setCurrentUser(updatedUsers.find(u => u.id === currentUser.id) || null);
  };

  const predictTournament = (data: TournamentPredictions) => {
    if (!currentUser) return;

    const updatedUsers = users.map(u => {
      if (u.id === currentUser.id) {
        return {
          ...u,
          tournamentPredictions: data
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    setCurrentUser(updatedUsers.find(u => u.id === currentUser.id) || null);
  };

  // --- Admin Actions ---

  const inviteUser = (email: string) => {
     const newUser: User = {
         id: `u_${Date.now()}`,
         name: email.split('@')[0],
         email: email,
         avatar: `https://ui-avatars.com/api/?name=${email.split('@')[0]}&background=random`,
         role: 'USER',
         status: 'INVITED',
         groupIds: [],
         predictions: {},
         totalPoints: 0
     };
     setUsers(prev => [...prev, newUser]);
  };

  const updateUserRole = (userId: string, newRole: UserRole) => {
     setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const removeUser = (userId: string) => {
     setUsers(users.filter(u => u.id !== userId));
  };

  return {
    users,
    currentUser,
    login,
    logout,
    joinGroup,
    switchGroup,
    predictMatch,
    predictTournament,
    adminActions: {
        inviteUser,
        updateUserRole,
        removeUser
    }
  };
};