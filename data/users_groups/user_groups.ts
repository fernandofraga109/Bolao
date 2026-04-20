import { UserGroupDB } from "../../types";

export const DB_USER_GROUPS: UserGroupDB[] = [
  // Master Admin is in both groups
  {
    userId: "11111111-1111-4111-8111-111111111111",
    groupId: "g1",
    joinedAt: "2025-01-01T10:00:00",
    role: "ADMIN",
  },
  {
    userId: "11111111-1111-4111-8111-111111111111",
    groupId: "g2",
    joinedAt: "2025-01-01T10:00:00",
    role: "ADMIN",
  },

  // Carlos Silva is in both groups
  {
    userId: "33333333-3333-4333-8333-333333333333",
    groupId: "g1",
    joinedAt: "2025-01-01T12:00:00",
  },
  {
    userId: "33333333-3333-4333-8333-333333333333",
    groupId: "g2",
    joinedAt: "2025-01-02T12:00:00",
  },

  // Ana Souza is only in G1
  {
    userId: "44444444-4444-4444-8444-444444444444",
    groupId: "g1",
    joinedAt: "2025-01-01T14:00:00",
  },

  // Pedro Rocha is only in G1
  {
    userId: "55555555-5555-4555-8555-555555555555",
    groupId: "g1",
    joinedAt: "2025-01-01T15:00:00",
  },

  // Demo user starts with no groups (or we could add one)
];
