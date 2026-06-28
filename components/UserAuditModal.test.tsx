import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchStatus, User, Match, Group, PredictionDB } from "../types";

let fakeDb: any;

vi.mock("../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

import UserAuditModal from "./UserAuditModal";

const makeTeam = (over: any = {}) => ({
  id: "t1",
  name: "Brasil",
  code: "BRA",
  flag: "bra.png",
  ranking: 1,
  ...over,
});

const makeMatch = (over: any = {}) => ({
  id: "m1",
  externalMatchId: "x",
  homeTeamId: "t1",
  awayTeamId: "t2",
  date: "2030-06-10T18:00:00Z",
  group: "Grupo A",
  competitionCode: "WC",
  status: MatchStatus.SCHEDULED,
  stage: "GROUP_STAGE",
  ...over,
});

const makeUser = (over: any = {}): User => ({
  id: "u1",
  name: "Eu",
  email: "eu@test.com",
  avatar: "",
  role: "USER",
  status: "ACTIVE",
  groupIds: ["g1"],
  activeGroupId: "g1",
  predictions: {},
  totalPoints: 0,
  ...over,
});

const makeGroup = (over: any = {}): Group => ({
  id: "g1",
  name: "Grupo Teste",
  code: "GRP1",
  adminId: "u1",
  createdAt: "2025-01-01T00:00:00Z",
  competitionCode: "WC",
  ruleset: "regulamento_2",
  ...over,
});

const baseDb = () => ({
  matches: [] as any[],
  teams: [
    makeTeam({ id: "t1", name: "Brasil", code: "BRA" }),
    makeTeam({ id: "t2", name: "Argentina", code: "ARG" }),
    makeTeam({ id: "t3", name: "França", code: "FRA" }),
    makeTeam({ id: "t4", name: "Espanha", code: "ESP" }),
  ],
  extraPhasePredictions: [] as any[],
  competitions: [{ code: "WC", biggestGoalDiffMatchIds: {} }],
  players: [] as any[],
  users: [] as any[],
  refetchMatches: vi.fn().mockResolvedValue(undefined),
  refetchPredictions: vi.fn().mockResolvedValue(undefined),
  refetchUserGroups: vi.fn().mockResolvedValue(undefined),
});

const renderAuditModal = (props: any = {}) => {
  const matches: Match[] = props.matches ?? [];
  const groups: Group[] = props.groups ?? [makeGroup()];
  const allUsers: User[] = props.allUsers ?? [makeUser()];
  const user = props.user ?? makeUser();
  const tournamentResults = props.tournamentResults ?? null;
  const currentUserId = props.currentUserId ?? "u1";
  const rawPredictions: PredictionDB[] = props.rawPredictions ?? [];
  const viewingGroupId = props.viewingGroupId ?? "g1";
  const lockDate = props.lockDate ?? "2000-01-01T00:00:00Z";

  return render(
    <UserAuditModal
      user={user}
      allUsers={allUsers}
      matches={matches}
      groups={groups}
      tournamentResults={tournamentResults}
      currentUserId={currentUserId}
      rawPredictions={rawPredictions}
      viewingGroupId={viewingGroupId}
      lockDate={lockDate}
      onClose={vi.fn()}
    />
  );
};

beforeEach(() => {
  fakeDb = baseDb();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("UserAuditModal - Regulamento 2 extra phase predictions", () => {
  it("does not show '16 Avos de Final' biggest-goal-diff row before the phase starts", async () => {
    // Groups started, but round_of_32 first match is still in the future.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2030-06-15T12:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    fakeDb.matches = [
      makeMatch({ id: "m_group", date: "2030-06-10T18:00:00Z", stage: "GROUP_STAGE", group: "Grupo A" }),
      makeMatch({ id: "m_16avos", date: "2030-06-20T18:00:00Z", stage: "ROUND_OF_32", group: "16 Avos" }),
    ];
    fakeDb.extraPhasePredictions = [
      { userId: "u1", groupId: "g1", phase: "round_of_32", matchId: "m_16avos" },
    ];

    renderAuditModal();

    // Switch to specials tab
    const specialsTab = screen.getByText(/Palpites Especiais/);
    await user.click(specialsTab);

    expect(screen.queryByText(/Maior diferença de gols/)).not.toBeInTheDocument();
  });

  it("shows '16 Avos de Final' biggest-goal-diff row once the phase has started", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2030-06-25T12:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    fakeDb.matches = [
      makeMatch({ id: "m_group", date: "2030-06-10T18:00:00Z", stage: "GROUP_STAGE", group: "Grupo A" }),
      makeMatch({ id: "m_16avos", date: "2030-06-20T18:00:00Z", stage: "ROUND_OF_32", group: "16 Avos" }),
    ];
    fakeDb.extraPhasePredictions = [
      { userId: "u1", groupId: "g1", phase: "round_of_32", matchId: "m_16avos" },
    ];

    renderAuditModal();

    const specialsTab = screen.getByText(/Palpites Especiais/);
    await user.click(specialsTab);

    expect(screen.getByText(/Maior diferença de gols/)).toBeInTheDocument();
  });
});
