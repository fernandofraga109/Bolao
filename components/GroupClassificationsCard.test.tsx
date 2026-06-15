import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let fakeDb: any;

vi.mock("../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

import { GroupClassificationsCard } from "./GroupClassificationsCard";

const teams = [
  { id: "t1", name: "Brasil", code: "BRA", flag: "bra.png", ranking: 1 },
  { id: "t2", name: "Argentina", code: "ARG", flag: "arg.png", ranking: 2 },
  { id: "t3", name: "França", code: "FRA", flag: "fra.png", ranking: 3 },
  { id: "t4", name: "Espanha", code: "ESP", flag: "esp.png", ranking: 4 },
];

const baseDb = () => ({
  teams,
  teamStandings: [
    { teamId: "t1", competitionCode: "WC", group: "Group A", position: 1 },
    { teamId: "t2", competitionCode: "WC", group: "Group A", position: 2 },
    { teamId: "t3", competitionCode: "WC", group: "Group B", position: 1 },
    { teamId: "t4", competitionCode: "WC", group: "Group B", position: 2 },
  ],
  tournamentPredictions: [] as any[],
  users: [
    { id: "u1", name: "Eu" },
    { id: "u2", name: "Outro Membro" },
  ],
});

beforeEach(() => {
  fakeDb = baseDb();
});

const futureLock = new Date("2030-01-01T00:00:00Z");
const pastLock = new Date("2000-01-01T00:00:00Z");

describe("GroupClassificationsCard", () => {
  it("renders the card header and group progress badge", () => {
    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    expect(screen.getByText("Classificados dos Grupos")).toBeInTheDocument();
    // Two groups derived from standings (A and B)
    expect(screen.getByText("0/2 Grupos")).toBeInTheDocument();
  });

  it("ignores stray non-World-Cup groups from standings (e.g. Atlantic Division)", async () => {
    fakeDb.teams = [
      ...teams,
      { id: "t5", name: "Boston", code: "BOS", flag: "bos.png", ranking: 5 },
      { id: "t6", name: "Toronto", code: "TOR", flag: "tor.png", ranking: 6 },
    ];
    fakeDb.teamStandings = [
      ...fakeDb.teamStandings,
      { teamId: "t5", competitionCode: "WC", group: "Atlantic Division", position: 1 },
      { teamId: "t6", competitionCode: "WC", group: "Central Division", position: 1 },
    ];

    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );

    // Only the two real groups (A and B) should be counted
    expect(screen.getByText("0/2 Grupos")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Classificados dos Grupos"));
    expect(screen.getByText("Grupo A")).toBeInTheDocument();
    expect(screen.getByText("Grupo B")).toBeInTheDocument();
    expect(screen.queryByText("Atlantic Division")).not.toBeInTheDocument();
    expect(screen.queryByText("Central Division")).not.toBeInTheDocument();
  });

  it("includes a team present in the group's matches even if missing from standings", async () => {
    // Grupo C has no standings, only matches between two teams
    fakeDb.teams = [
      ...teams,
      { id: "t7", name: "Croácia", code: "CRO", flag: "cro.png", ranking: 7 },
      { id: "t8", name: "Marrocos", code: "MAR", flag: "mar.png", ranking: 8 },
    ];
    const matches = [
      {
        group: "Grupo C",
        homeTeam: fakeDb.teams.find((t: any) => t.id === "t7"),
        awayTeam: fakeDb.teams.find((t: any) => t.id === "t8"),
      },
    ] as any;

    render(
      <GroupClassificationsCard
        matches={matches}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );

    await userEvent.click(screen.getByText("Classificados dos Grupos"));
    expect(screen.getByText("Grupo C")).toBeInTheDocument();

    // Open Grupo C 1st-place dropdown — both match teams must be selectable
    const firstPlaceButtons = screen.getAllByText("Líder...");
    await userEvent.click(firstPlaceButtons[firstPlaceButtons.length - 1]);
    expect(screen.getByText("Croácia")).toBeInTheDocument();
    expect(screen.getByText("Marrocos")).toBeInTheDocument();
  });

  it("renders a saved pick whose stored id is stale by mapping via externalTeamId", async () => {
    // Current group team for Grupo A 1st place has id "t1" with externalTeamId 100.
    // A stale duplicate of the same team exists globally with a different id.
    fakeDb.teams = [
      { id: "t1", name: "Brasil", code: "BRA", flag: "bra.png", ranking: 1, externalTeamId: 100 },
      { id: "t2", name: "Argentina", code: "ARG", flag: "arg.png", ranking: 2, externalTeamId: 200 },
      { id: "t3", name: "França", code: "FRA", flag: "fra.png", ranking: 3, externalTeamId: 300 },
      { id: "t4", name: "Espanha", code: "ESP", flag: "esp.png", ranking: 4, externalTeamId: 400 },
      { id: "stale-bra", name: "Brasil", code: "BRA", flag: "bra.png", ranking: 1, externalTeamId: 100 },
    ];

    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={{ groupClassifications: { "Grupo A": ["stale-bra", "t2"] } } as any}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );

    await userEvent.click(screen.getByText("Classificados dos Grupos"));
    // The stale-id pick must still display the team name (mapped via externalTeamId)
    expect(screen.getAllByText("Brasil").length).toBeGreaterThan(0);
  });

  it("returns null (renders nothing) when there are no groups to predict", () => {
    fakeDb.teamStandings = [];
    const { container } = render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("expands to show the group selectors when the header is clicked", async () => {
    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    expect(screen.queryByText("Grupo A")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Classificados dos Grupos"));
    expect(screen.getByText("Grupo A")).toBeInTheDocument();
    expect(screen.getByText("Grupo B")).toBeInTheDocument();
    // The save button is shown when unlocked
    expect(
      screen.getByText("Salvar Palpites de Classificados")
    ).toBeInTheDocument();
  });

  it("shows FECHADO and hides the save button when locked", async () => {
    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={pastLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    expect(screen.getByText("FECHADO")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Classificados dos Grupos"));
    expect(
      screen.queryByText("Salvar Palpites de Classificados")
    ).not.toBeInTheDocument();
  });

  it("calls onPredict with the selected qualifiers when saving (unlocked)", async () => {
    const onPredict = vi.fn();
    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={onPredict}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados dos Grupos"));

    // Open the 1st-place dropdown of Grupo A and pick Brasil
    const firstPlaceButtons = screen.getAllByText("Líder...");
    await userEvent.click(firstPlaceButtons[0]);
    const brasilOptions = screen.getAllByText("Brasil");
    await userEvent.click(brasilOptions[brasilOptions.length - 1]);

    await userEvent.click(screen.getByText("Salvar Palpites de Classificados"));
    expect(onPredict).toHaveBeenCalledTimes(1);
    const arg = onPredict.mock.calls[0][0];
    expect(arg.groupClassifications["Grupo A"][0]).toBe("t1");
  });

  it("toggles the other-members accordion and hides picks until locked", async () => {
    fakeDb.tournamentPredictions = [
      {
        userId: "u2",
        groupId: "g1",
        groupClassifications: { "Grupo A": ["t1", "t2"] },
      },
    ];
    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados dos Grupos"));

    const trigger = screen.getByText(/Classificados do Grupo \(1\)/);
    await userEvent.click(trigger);
    expect(screen.getByText("Outro Membro")).toBeInTheDocument();
    // Unlocked -> picks are hidden
    expect(screen.getAllByText("Oculto").length).toBeGreaterThan(0);
  });

  it("reveals other members' team codes once locked", async () => {
    fakeDb.tournamentPredictions = [
      {
        userId: "u2",
        groupId: "g1",
        groupClassifications: { "Grupo A": ["t1", "t2"] },
      },
    ];
    render(
      <GroupClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={pastLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados dos Grupos"));
    await userEvent.click(screen.getByText(/Classificados do Grupo \(1\)/));

    expect(screen.getByText("BRA")).toBeInTheDocument();
    expect(screen.getByText("ARG")).toBeInTheDocument();
    expect(screen.queryByText("Oculto")).not.toBeInTheDocument();
  });
});
