import { UserDB } from "../../types";

/**
 * SEED DATA — used only for local/offline fallback when Supabase is not configured.
 * Passwords are placeholder values; real authentication is handled by Supabase Auth.
 * NEVER commit real credentials here.
 */
export const DB_USERS: UserDB[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Mestre da Copa",
    email: "admin",
    password: "CHANGE_ME",
    avatar: "https://ui-avatars.com/api/?name=Admin&background=000&color=fff",
    role: "ADMIN",
    status: "ACTIVE",
    activeGroupId: undefined,
    totalPoints: 0,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Usuário Demo",
    email: "demo@gmail.com",
    password: "CHANGE_ME",
    avatar: "https://ui-avatars.com/api/?name=Demo&background=10b981&color=fff",
    role: "USER",
    status: "ACTIVE",
    activeGroupId: undefined,
    totalPoints: 0,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Carlos Silva",
    email: "carlos@gmail.com",
    password: "CHANGE_ME",
    avatar: "https://picsum.photos/seed/carlos/50/50",
    role: "USER",
    status: "ACTIVE",
    activeGroupId: "g1",
    totalPoints: 0,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Ana Souza",
    email: "ana@gmail.com",
    password: "CHANGE_ME",
    avatar: "https://picsum.photos/seed/ana/50/50",
    role: "USER",
    status: "ACTIVE",
    activeGroupId: "g1",
    totalPoints: 0,
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    name: "Pedro Rocha",
    email: "pedro@gmail.com",
    password: "CHANGE_ME",
    avatar: "https://picsum.photos/seed/pedro/50/50",
    role: "USER",
    status: "ACTIVE",
    activeGroupId: "g1",
    totalPoints: 0,
  },
];
