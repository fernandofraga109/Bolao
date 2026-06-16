import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// AdminDashboard reads many db.* tables at render time and calls external
// services only on user actions. This is a SMOKE test: it only verifies the
// dashboard mounts without crashing given a broad fake db + the required props.
const fakeDb: any = {
  teams: [],
  teamStandings: [],
  matches: [],
  competitions: [],
  users: [],
  groups: [],
  players: [],
  isSyncingPlayers: false,
  systemConfig: {
    id: "cfg",
    is_auto_sync_enabled: false,
    sync_interval_ms: 60000,
    underdog_min_rank_diff: 10,
  },
  upsertCompetitions: vi.fn(),
  updateCompetitionAwards: vi.fn(),
  updateCompetitionAutoSync: vi.fn(),
  updateSystemConfig: vi.fn(),
  updateGroup: vi.fn(),
  syncSquads: vi.fn(),
};

vi.mock("../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

import AdminDashboard from "./AdminDashboard";

const currentUser: any = {
  id: "u1",
  name: "Admin",
  email: "a@a.com",
  avatar: "",
  role: "ADMIN",
  status: "ACTIVE",
  groupIds: [],
  predictions: {},
  totalPoints: 0,
};

const baseProps: any = {
  users: [],
  groups: [],
  currentUser,
  onInvite: vi.fn(),
  onUpdateRole: vi.fn(),
  onRemoveUser: vi.fn(),
  onCreateGroup: vi.fn(),
  onDeleteGroup: vi.fn().mockResolvedValue(undefined),
  onAddUserToGroup: vi.fn().mockResolvedValue(undefined),
  onRemoveUserFromGroup: vi.fn().mockResolvedValue(undefined),
  isSyncing: false,
  isAutoSyncEnabled: false,
  toggleAutoSync: vi.fn(),
  syncStatusByCompetition: {},
  onManualSync: vi.fn().mockResolvedValue(undefined),
};

describe("AdminDashboard (smoke)", () => {
  it("mounts without crashing given a mocked db", () => {
    const { container } = render(<AdminDashboard {...baseProps} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
