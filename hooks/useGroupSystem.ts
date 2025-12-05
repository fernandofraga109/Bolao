import { useState, useEffect } from 'react';
import { Group } from '../types';
import { INITIAL_GROUPS } from '../constants';

export const useGroupSystem = () => {
  const [groups, setGroups] = useState<Group[]>(() => {
    const saved = localStorage.getItem('bolao_groups');
    return saved ? JSON.parse(saved) : INITIAL_GROUPS;
  });

  useEffect(() => {
    localStorage.setItem('bolao_groups', JSON.stringify(groups));
  }, [groups]);

  const createGroup = (name: string, adminId: string): Group => {
    // Simple code generation: 4 random chars + Year. Ex: A7X926
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${randomPart}26`;

    const newGroup: Group = {
      id: `g_${Date.now()}`,
      name,
      code,
      adminId,
      createdAt: new Date().toISOString()
    };

    setGroups(prev => [...prev, newGroup]);
    return newGroup;
  };

  const getGroupByCode = (code: string): Group | undefined => {
    return groups.find(g => g.code.toUpperCase() === code.toUpperCase());
  };

  const getGroupById = (id: string): Group | undefined => {
    return groups.find(g => g.id === id);
  };

  const getGroupsByIds = (ids: string[]): Group[] => {
      return groups.filter(g => ids.includes(g.id));
  };

  return {
    groups,
    createGroup,
    getGroupByCode,
    getGroupById,
    getGroupsByIds
  };
};