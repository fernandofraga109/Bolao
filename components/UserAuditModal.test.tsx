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

describe("UserAuditModal - Regulamento 2 special predictions accordion", () => {
  it("renders groups closed by default with totals visible on root", async () => {
    const user = userEvent.setup();

    fakeDb.matches = [
      makeMatch({ id: "m_ga", date: "2025-06-10T18:00:00Z", stage: "GROUP_STAGE", group: "Grupo A", resultHome: 2, resultAway: 1, status: MatchStatus.FINISHED }),
      makeMatch({ id: "m_oitavas", date: "2025-06-22T18:00:00Z", stage: "ROUND_OF_16", group: "Oitavas", resultHome: 1, resultAway: 0, status: MatchStatus.FINISHED }),
    ];

    const auditUser = makeUser({
      tournamentPredictions: {
        championTeamId: "t1",
        topScorer: { player: "Neymar" },
        topScorerPlayerId: "p1",
        groupClassifications: {
          "Grupo A": ["t1", "t2"],
          Oitavas: ["t1", "t3"],
        },
      },
    });

    const allUsers = [auditUser];

    const tournamentResults = {
      championTeamId: "t1",
      topScorerPlayerIds: ["p1"],
      groupClassifications: {
        "Grupo A": ["t1", "t2"],
        Oitavas: ["t1", "t4"],
      },
    };

    renderAuditModal({ user: auditUser, allUsers, tournamentResults });

    const specialsTab = screen.getByText(/Palpites Especiais/);
    await user.click(specialsTab);

    // Root groups are visible
    expect(screen.getByText("Campeão")).toBeInTheDocument();
    expect(screen.getByText("Artilheiro")).toBeInTheDocument();
    expect(screen.getByText("Classificados Grupo")).toBeInTheDocument();
    expect(screen.getByText("Classificados Oitavas")).toBeInTheDocument();

    // Totals on root (closed by default)
    expect(screen.getByText("+100")).toBeInTheDocument(); // Campeão
    expect(screen.getByText("+60")).toBeInTheDocument(); // Artilheiro
    expect(screen.getByText("+20")).toBeInTheDocument(); // Classificados Grupo (2 x 10)
    expect(screen.getByText("+5")).toBeInTheDocument(); // Classificados Oitavas (t1 hit)

    // Child details are hidden while closed
    expect(screen.queryByText("Classificado")).not.toBeInTheDocument();
    expect(screen.queryByText("Não classificado")).not.toBeInTheDocument();
  });

  it("expands a group and shows child items when clicked", async () => {
    const user = userEvent.setup();

    fakeDb.matches = [
      makeMatch({ id: "m_16avos", date: "2025-06-20T18:00:00Z", stage: "ROUND_OF_32", group: "16 Avos", resultHome: 1, resultAway: 0, status: MatchStatus.FINISHED }),
      makeMatch({ id: "m_oitavas", date: "2025-06-22T18:00:00Z", stage: "ROUND_OF_16", group: "Oitavas", resultHome: 1, resultAway: 0, status: MatchStatus.FINISHED }),
    ];

    const auditUser = makeUser({
      tournamentPredictions: {
        groupClassifications: {
          Oitavas: ["t1", "t3"],
        },
      },
    });

    const allUsers = [auditUser];

    const tournamentResults = {
      groupClassifications: {
        Oitavas: ["t1", "t4"],
      },
    };

    renderAuditModal({ user: auditUser, allUsers, tournamentResults });

    const specialsTab = screen.getByText(/Palpites Especiais/);
    await user.click(specialsTab);

    const groupButton = screen.getByTestId("special-group-classifications-Oitavas");
    await user.click(groupButton);

    // Child items visible after expand
    expect(screen.getByText("Brasil")).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Classificado/)).toBeInTheDocument();
    expect(screen.getByText("França")).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Não classificado/)).toBeInTheDocument();
  });

  it("shows only correct Final qualifiers while semifinals are still in progress", async () => {
    const user = userEvent.setup();

    fakeDb.matches = [
      makeMatch({ id: "m_semi_1", homeTeamId: "t1", awayTeamId: "t2", date: "2025-07-08T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", resultHome: 2, resultAway: 0, status: MatchStatus.FINISHED }),
      makeMatch({ id: "m_semi_2", homeTeamId: "t3", awayTeamId: "t4", date: "2025-07-09T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", status: MatchStatus.SCHEDULED }),
    ];

    const auditUser = makeUser({
      tournamentPredictions: {
        groupClassifications: {
          Final: ["t1", "t3"],
        },
      },
    });
    const tournamentResults = {
      groupClassifications: {
        Final: ["t1", "t4"],
      },
    };

    renderAuditModal({ user: auditUser, allUsers: [auditUser], tournamentResults });

    await user.click(screen.getByText(/Palpites Especiais/));

    expect(screen.getByText("Classificados Final")).toBeInTheDocument();
    expect(screen.getAllByText("+5").length).toBeGreaterThan(0);

    await user.click(screen.getByTestId("special-group-classifications-Final"));

    expect(screen.getByText("Brasil")).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Classificado/)).toBeInTheDocument();
    expect(screen.queryByText("França")).not.toBeInTheDocument();
  });

  it("shows all Final qualifiers after semifinals finish", async () => {
    const user = userEvent.setup();

    fakeDb.matches = [
      makeMatch({ id: "m_semi_1", homeTeamId: "t1", awayTeamId: "t2", date: "2025-07-08T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", resultHome: 2, resultAway: 0, status: MatchStatus.FINISHED }),
      makeMatch({ id: "m_semi_2", homeTeamId: "t3", awayTeamId: "t4", date: "2025-07-09T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", resultHome: 0, resultAway: 1, status: MatchStatus.FINISHED }),
    ];

    const auditUser = makeUser({
      tournamentPredictions: {
        groupClassifications: {
          Final: ["t1", "t3"],
        },
      },
    });
    const tournamentResults = {
      groupClassifications: {
        Final: ["t1", "t4"],
      },
    };

    renderAuditModal({ user: auditUser, allUsers: [auditUser], tournamentResults });

    await user.click(screen.getByText(/Palpites Especiais/));
    await user.click(screen.getByTestId("special-group-classifications-Final"));

    expect(screen.getByText("Brasil")).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Classificado/)).toBeInTheDocument();
    expect(screen.getByText("França")).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Não classificado/)).toBeInTheDocument();
    expect(screen.getAllByText("+5").length).toBeGreaterThan(0);
  });

  it("ignores unfinished semifinals from another competition when revealing Final qualifiers", async () => {
    const user = userEvent.setup();

    fakeDb.matches = [
      makeMatch({ id: "m_semi_1", homeTeamId: "t1", awayTeamId: "t2", date: "2025-07-08T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", resultHome: 2, resultAway: 0, status: MatchStatus.FINISHED }),
      makeMatch({ id: "m_semi_2", homeTeamId: "t3", awayTeamId: "t4", date: "2025-07-09T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", resultHome: 0, resultAway: 1, status: MatchStatus.FINISHED }),
      makeMatch({ id: "m_other_comp_semi", homeTeamId: "t1", awayTeamId: "t2", date: "2025-07-10T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", competitionCode: "EC", status: MatchStatus.SCHEDULED }),
    ];

    const auditUser = makeUser({
      tournamentPredictions: {
        groupClassifications: {
          Final: ["t1", "t3"],
        },
      },
    });
    const tournamentResults = {
      groupClassifications: {
        Final: ["t1", "t4"],
      },
    };

    renderAuditModal({ user: auditUser, allUsers: [auditUser], tournamentResults });

    await user.click(screen.getByText(/Palpites Especiais/));
    await user.click(screen.getByTestId("special-group-classifications-Final"));

    expect(screen.getByText("França")).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Não classificado/)).toBeInTheDocument();
  });

  it("ignores stale scheduled duplicates of finished semifinals when revealing Final qualifiers", async () => {
    const user = userEvent.setup();

    fakeDb.matches = [
      makeMatch({ id: "m_semi_1_stale", externalMatchId: undefined, homeTeamId: "t1", awayTeamId: "t2", date: "2025-07-08T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", status: MatchStatus.SCHEDULED }),
      makeMatch({ id: "m_semi_1", externalMatchId: "semi-1", homeTeamId: "t1", awayTeamId: "t2", date: "2025-07-08T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", resultHome: 2, resultAway: 0, status: MatchStatus.FINISHED }),
      makeMatch({ id: "m_semi_2", externalMatchId: "semi-2", homeTeamId: "t3", awayTeamId: "t4", date: "2025-07-09T18:00:00Z", stage: "SEMI_FINAL", group: "Semis", resultHome: 0, resultAway: 1, status: MatchStatus.FINISHED }),
    ];

    const auditUser = makeUser({
      tournamentPredictions: {
        groupClassifications: {
          Final: ["t1", "t3"],
        },
      },
    });
    const tournamentResults = {
      groupClassifications: {
        Final: ["t1", "t4"],
      },
    };

    renderAuditModal({ user: auditUser, allUsers: [auditUser], tournamentResults });

    await user.click(screen.getByText(/Palpites Especiais/));
    await user.click(screen.getByTestId("special-group-classifications-Final"));

    expect(screen.getByText("França")).toBeInTheDocument();
    expect(screen.getByText(/Resultado: Não classificado/)).toBeInTheDocument();
  });

  it("keeps total in footer consistent with sum of group totals", async () => {
    const user = userEvent.setup();

    fakeDb.matches = [
      makeMatch({ id: "m_ga", date: "2025-06-10T18:00:00Z", stage: "GROUP_STAGE", group: "Grupo A", resultHome: 2, resultAway: 1, status: MatchStatus.FINISHED }),
    ];

    const auditUser = makeUser({
      tournamentPredictions: {
        championTeamId: "t1",
        groupClassifications: {
          "Grupo A": ["t1", "t2"],
        },
      },
    });

    const allUsers = [auditUser];

    const tournamentResults = {
      championTeamId: "t1",
      groupClassifications: {
        "Grupo A": ["t1", "t2"],
      },
    };

    renderAuditModal({ user: auditUser, allUsers, tournamentResults });

    const specialsTab = screen.getByText(/Palpites Especiais/);
    await user.click(specialsTab);

    // 100 (champion) + 20 (group) = 120
    // Total appears in both header and footer, verify it's displayed
    expect(screen.getAllByText("120").length).toBeGreaterThan(0);
    expect(screen.getByText(/Especiais:/)).toBeInTheDocument();
  });
});
