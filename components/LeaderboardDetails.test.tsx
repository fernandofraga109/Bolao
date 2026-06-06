import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LeaderboardDetails from "./LeaderboardDetails";

const makeUser = (over: any = {}): any => ({
  id: "u1",
  name: "Jogador Um",
  email: "e@e.com",
  avatar: "",
  role: "USER",
  status: "ACTIVE",
  groupIds: ["g1"],
  predictions: { m1: { home: 1, away: 0 } },
  totalPoints: 42,
  predictionsCount: 1,
  scoreBreakdown: {
    exactCount: 3,
    diffCount: 2,
    outcomeCount: 1,
    wrongCount: 0,
    underdogBonusCount: 4,
    underdogBonusTotal: 0,
  },
  ...over,
});

describe("LeaderboardDetails", () => {
  it("renders the empty state when there are no sections", () => {
    render(<LeaderboardDetails sections={[]} />);
    expect(
      screen.getByText("Entre em um grupo para visualizar os detalhes.")
    ).toBeInTheDocument();
  });

  it("renders the user's name and total points for a section", () => {
    render(
      <LeaderboardDetails
        sections={[
          {
            groupId: "g1",
            groupName: "Meu Grupo",
            users: [makeUser()],
          },
        ]}
      />
    );
    expect(screen.getByText("Meu Grupo")).toBeInTheDocument();
    expect(screen.getByText("Jogador Um")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders StatBadge labels and values from the score breakdown (regulamento_1)", () => {
    render(
      <LeaderboardDetails
        ruleset="regulamento_1"
        sections={[
          { groupId: "g1", groupName: "Meu Grupo", users: [makeUser()] },
        ]}
      />
    );
    // Labels
    expect(screen.getByText("Exatos")).toBeInTheDocument();
    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(screen.getByText("Resultado")).toBeInTheDocument();
    expect(screen.getByText("Zebra")).toBeInTheDocument();
    // Values
    expect(screen.getByText("3")).toBeInTheDocument(); // exactCount
    expect(screen.getByText("4")).toBeInTheDocument(); // underdogBonusCount
  });

  it("shows the 'Sozinho' badge instead of 'Zebra' under regulamento_2", () => {
    render(
      <LeaderboardDetails
        ruleset="regulamento_2"
        sections={[
          {
            groupId: "g1",
            groupName: "Meu Grupo",
            users: [makeUser({ scoreBreakdown: {
              exactCount: 1,
              diffCount: 0,
              outcomeCount: 0,
              wrongCount: 0,
              aloneBonusCount: 7,
            } })],
          },
        ]}
      />
    );
    expect(screen.getByText("Sozinho")).toBeInTheDocument();
    expect(screen.queryByText("Zebra")).not.toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
