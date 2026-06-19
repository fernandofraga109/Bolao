import { describe, it, expect } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchStatus } from "../../types";
import StatsPage from "./StatsPage";

const team = (id: string, name: string) => ({
  id,
  name,
  code: name.slice(0, 3).toUpperCase(),
  flag: `${id}.png`,
  ranking: 1,
});

const makeMatch = (over: any = {}) => ({
  id: "m1",
  homeTeam: team("t1", "Brasil"),
  awayTeam: team("t2", "Argentina"),
  date: "2026-06-10T18:00:00Z",
  group: "Grupo A",
  competitionCode: "WC",
  status: MatchStatus.FINISHED,
  result: { home: 2, away: 1 },
  ...over,
});

const makeUser = (predictions: any, overrides: any = {}): any => ({
  id: "u1",
  name: "Eu",
  email: "e@e.com",
  avatar: "",
  role: "USER",
  status: "ACTIVE",
  groupIds: ["g1"],
  predictions,
  totalPoints: 0,
  ...overrides,
});

describe("StatsPage", () => {
  it("renders the performance header without crashing", () => {
    render(<StatsPage user={makeUser({})} matches={[]} />);
    expect(screen.getByText("Meu Desempenho")).toBeInTheDocument();
  });

  it("shows the empty-state message when there are no finished predictions", () => {
    render(<StatsPage user={makeUser({})} matches={[makeMatch()]} />);
    expect(
      screen.getByText("Nenhum palpite em partidas finalizadas ainda.")
    ).toBeInTheDocument();
  });

  it("renders a scored prediction card showing the earned points", () => {
    const user = makeUser({ m1: { home: 1, away: 0, points: 5 } });
    render(<StatsPage user={user} matches={[makeMatch()]} />);

    // Pontuados section is rendered with count 1
    expect(screen.getByText("Pontuados")).toBeInTheDocument();
    // Points badge shows +5 pts
    expect(screen.getByText("+5 pts")).toBeInTheDocument();
  });

  it("marks an exact-score prediction with the 'Placar Exato!' badge", () => {
    const user = makeUser({ m1: { home: 2, away: 1, points: 10 } });
    render(<StatsPage user={user} matches={[makeMatch()]} />);
    expect(screen.getByText("Placar Exato!")).toBeInTheDocument();
  });

  it("does not show the exact badge for a non-exact scoring prediction", () => {
    const user = makeUser({ m1: { home: 3, away: 2, points: 5 } });
    render(<StatsPage user={user} matches={[makeMatch()]} />);
    expect(screen.queryByText("Placar Exato!")).not.toBeInTheDocument();
  });

  it("places zero-point predictions in the 'Não Pontuados' collapsible (closed by default)", async () => {
    const user = makeUser({ m1: { home: 0, away: 3, points: 0 } });
    render(<StatsPage user={user} matches={[makeMatch()]} />);

    const section = screen.getByText("Não Pontuados");
    expect(section).toBeInTheDocument();
    // defaultOpen=false -> card content hidden initially
    expect(screen.queryByText("0 pts")).not.toBeInTheDocument();

    // Expanding the section reveals the card
    await userEvent.click(section);
    expect(screen.getByText("0 pts")).toBeInTheDocument();
  });

  it("collapses an open section when its header is clicked", async () => {
    const user = makeUser({ m1: { home: 1, away: 0, points: 5 } });
    render(<StatsPage user={user} matches={[makeMatch()]} />);

    // Pontuados is open by default -> the points badge is visible
    expect(screen.getByText("+5 pts")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Pontuados"));
    expect(screen.queryByText("+5 pts")).not.toBeInTheDocument();
  });

  it("includes extra phase points in the average for regulamento_2", () => {
    const user = makeUser({ m1: { home: 2, away: 1, points: 10 } });
    const extraPhasePredictions = [
      { userId: "u1", groupId: "g1", phase: "groups", matchId: "m1" },
    ];
    const competitions = [
      { code: "WC", name: "Copa", biggestGoalDiffMatchIds: { groups: ["m1"] } },
    ];
    render(
      <StatsPage
        user={user}
        matches={[makeMatch()]}
        ruleset="regulamento_2"
        groupId="g1"
        extraPhasePredictions={extraPhasePredictions}
        competitions={competitions}
      />
    );

    // Total points = 10 (match) + 20 (extra phase) = 30; avg = 30 / 1 game
    expect(screen.getByText("30.0")).toBeInTheDocument();
  });

  it("keeps the logged-in user as the default title when multiple members are provided", () => {
    const me = makeUser({ m1: { home: 2, away: 1, points: 10 } });
    const other = makeUser({}, { id: "u2", name: "Maria", groupIds: ["g1"] });
    render(<StatsPage user={me} users={[me, other]} groupId="g1" matches={[makeMatch()]} />);

    expect(screen.getByText("Meu Desempenho")).toBeInTheDocument();
  });

  it("switches the title and stats when selecting another member from the dropdown", async () => {
    const me = makeUser({ m1: { home: 2, away: 1, points: 10 } });
    const other = makeUser(
      { m1: { home: 0, away: 0, points: 0 } },
      { id: "u2", name: "Maria", groupIds: ["g1"] }
    );
    render(<StatsPage user={me} users={[me, other]} groupId="g1" matches={[makeMatch()]} />);

    // Open the dropdown
    await userEvent.click(screen.getByText("Você"));
    // Select the other member (second option)
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(2);
    fireEvent.click(options[1]);

    await waitFor(() => {
      expect(screen.getByText("Desempenho de Maria")).toBeInTheDocument();
    });
    // Maria's missed prediction should appear in the "Não Pontuados" section
    expect(screen.getByText("Não Pontuados")).toBeInTheDocument();
  });
});
