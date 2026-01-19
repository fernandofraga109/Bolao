
import { useDatabase } from '../contexts/DatabaseContext';
import { Group } from '../types';

export const useGroupSystem = () => {
  const db = useDatabase();

  const generateGroupCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let codeLetters = '';
    for (let i = 0; i < 5; i++) codeLetters += letters.charAt(Math.floor(Math.random() * letters.length));
    let codeNumbers = '';
    for (let i = 0; i < 5; i++) codeNumbers += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return codeLetters + codeNumbers;
  };

  const createGroup = (name: string, adminId: string): Group => {
    let code = generateGroupCode();
    // Ensure uniqueness
    while (db.groups.some(g => g.code === code)) {
        code = generateGroupCode();
    }

    const newGroup: Group = {
      id: `g_${Date.now()}`,
      name,
      code,
      adminId,
      createdAt: new Date().toISOString()
    };

    db.addGroup(newGroup);
    return newGroup;
  };

  const deleteGroup = async (groupId: string) => {
    console.log(`🗑️ useGroupSystem: Solicitando exclusão do grupo ${groupId}`);
    await db.deleteGroup(groupId);
  };

  const getGroupByCode = (code: string): Group | undefined => {
    return db.groups.find(g => g.code.toUpperCase() === code.toUpperCase());
  };

  const getGroupById = (id: string): Group | undefined => {
    return db.groups.find(g => g.id === id);
  };

  const getGroupsByIds = (ids: string[]): Group[] => {
      return db.groups.filter(g => ids.includes(g.id));
  };

  return {
    groups: db.groups,
    createGroup,
    deleteGroup,
    getGroupByCode,
    getGroupById,
    getGroupsByIds
  };
};
