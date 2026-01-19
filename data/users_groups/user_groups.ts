
import { UserGroupDB } from '../../types';

export const DB_USER_GROUPS: UserGroupDB[] = [
  // Master Admin is in both groups
  { userId: 'master_admin', groupId: 'g1', joinedAt: '2025-01-01T10:00:00', role: 'ADMIN' },
  { userId: 'master_admin', groupId: 'g2', joinedAt: '2025-01-01T10:00:00', role: 'ADMIN' },

  // Carlos Silva is in both groups
  { userId: 'f1', groupId: 'g1', joinedAt: '2025-01-01T12:00:00' },
  { userId: 'f1', groupId: 'g2', joinedAt: '2025-01-02T12:00:00' },

  // Ana Souza is only in G1
  { userId: 'f2', groupId: 'g1', joinedAt: '2025-01-01T14:00:00' },

  // Pedro Rocha is only in G1
  { userId: 'f3', groupId: 'g1', joinedAt: '2025-01-01T15:00:00' },
  
  // Demo user starts with no groups (or we could add one)
];