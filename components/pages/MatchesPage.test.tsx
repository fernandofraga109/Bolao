import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchStatus } from "../../types";
import MatchesPage from "./MatchesPage";

const team = (id: string, name: string) => ({
  id,
  name,
  code: name.slice(0, 3).toUpperCase(),
  flag: `${id}.png`,
  ranking: 1,
});

// Use a far-future date so the match lands in the "future" group (a MatchGroup
// that is collapsed by default). The group title is the formatted date.
const futureMatch = {
  id: "m-future",
  homeTeam: team("t1", "Brasil"),
  awayTeam: team("t2", "Argentina"),
  date: "2030-07-15T18:00:00Z",
  group: "Grupo A",
  competitionCode: "WC",
  status: MatchStatus.SCHEDULED,
};

const currentUser: any = {
  id: "u1",
  name: "Eu",
  email: "e@e.com",
  avatar: "",
  role: "USER",
  status: "ACTIVE",
  groupIds: ["g1"],
  predictions: {},
  totalPoints: 0,
};

const baseProps = (over: any = {}) => ({
  matches: [futureMatch],
  userHasGroup: true,
  userPredictions: {},
  leaderboardData: [],
  currentUser,
  isSyncing: false,
  canWriteCompetitionData: false,
  onManualSync: vi.fn(),
  onPredict: vi.fn().mockResolvedValue(undefined),
  onAdminSaveMatch: vi.fn(),
  ...over,
});

describe("MatchesPage", () => {
  it("renders the empty state when the user has no group and no matches", () => {
    render(
      <MatchesPage
        {...(baseProps({ matches: [], userHasGroup: false }) as any)}
      />
    );
    expect(
      screen.getByText("Você ainda não está em um grupo")
    ).toBeInTheDocument();
  });

  it("renders a collapsed future match group showing the match count", () => {
    render(<MatchesPage {...(baseProps() as any)} />);
    // Collapsed groups display "<n> jogos"
    expect(screen.getByText("1 jogos")).toBeInTheDocument();
    // Match content (team name) not yet rendered while collapsed
    expect(screen.queryByText("Brasil")).not.toBeInTheDocument();
  });

  it("expands a match group and renders its matches when the header is clicked", async () => {
    render(<MatchesPage {...(baseProps() as any)} />);

    // The future group header title is a formatted date; click it via the count's
    // parent button. We locate the toggle by the "1 jogos" label.
    const countLabel = screen.getByText("1 jogos");
    await userEvent.click(countLabel);

    expect(screen.getByText("Brasil")).toBeInTheDocument();
    expect(screen.getByText("Argentina")).toBeInTheDocument();
  });
});
