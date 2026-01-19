
import { UserDB } from '../../types';

export const DB_USERS: UserDB[] = [
  {
    id: 'master_admin',
    name: 'Mestre da Copa',
    email: 'admin', 
    password: 'Copa2026@LLED',
    avatar: 'https://ui-avatars.com/api/?name=Admin&background=000&color=fff',
    role: 'ADMIN',
    status: 'ACTIVE',
    activeGroupId: undefined,
    totalPoints: 0
  },
  {
    id: 'me',
    name: 'Usuário Demo',
    email: 'demo@gmail.com',
    password: '123',
    avatar: 'https://ui-avatars.com/api/?name=Demo&background=10b981&color=fff',
    role: 'USER',
    status: 'ACTIVE',
    activeGroupId: undefined,
    totalPoints: 0
  },
  {
    id: 'f1',
    name: 'Carlos Silva',
    email: 'carlos@gmail.com',
    password: '123',
    avatar: 'https://picsum.photos/seed/carlos/50/50',
    role: 'USER',
    status: 'ACTIVE',
    activeGroupId: 'g1',
    totalPoints: 0 
  },
  {
    id: 'f2',
    name: 'Ana Souza',
    email: 'ana@gmail.com',
    password: '123',
    avatar: 'https://picsum.photos/seed/ana/50/50',
    role: 'USER',
    status: 'ACTIVE',
    activeGroupId: 'g1',
    totalPoints: 0
  },
  {
    id: 'f3',
    name: 'Pedro Rocha',
    email: 'pedro@gmail.com',
    password: '123',
    avatar: 'https://picsum.photos/seed/pedro/50/50',
    role: 'USER',
    status: 'ACTIVE',
    activeGroupId: 'g1',
    totalPoints: 0
  }
];
