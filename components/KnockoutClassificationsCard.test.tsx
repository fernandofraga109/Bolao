import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchStatus } from "../types";

let fakeDb: any;

vi.mock("../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

import { KnockoutClassificationsCard } from "./KnockoutClassificationsCard";

const teams = [
  { id: "t1", name: "Brasil", code: "BRA", flag: "bra.png", ranking: 1 },
  { id: "t2", name: "Argentina", code: "ARG", flag: "arg.png", ranking: 2 },
  { id: "t3", name: "França", code: "FRA", flag: "fra.png", ranking: 3 },
];

// Hydrated Match (UI model) used by the card's `matches` prop
const makeMatch = (over: any = {}) => ({
  id: "ko1",
  homeTeam: teams[0],
  awayTeam: teams[1],
  date: "2030-07-01T18:00:00Z",
  group: "Oitavas",
  competitionCode: "WC",
  status: MatchStatus.SCHEDULED,
  stage: "ROUND_OF_16",
  ...over,
});

const baseDb = () => ({
  teams,
  teamStandings: [
    { teamId: "t1", competitionCode: "WC" },
    { teamId: "t2", competitionCode: "WC" },
    { teamId: "t3", competitionCode: "WC" },
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

describe("KnockoutClassificationsCard", () => {
  it("renders the card header without crashing", () => {
    render(
      <KnockoutClassificationsCard
        matches={[]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    expect(screen.getByText("Classificados 2º Fase")).toBeInTheDocument();
  });

  it("expands to show the three phase tabs and the team selection grid", async () => {
    render(
      <KnockoutClassificationsCard
        matches={[makeMatch()]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    expect(screen.queryByText("Oitavas de Final")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Classificados 2º Fase"));
    expect(screen.getByText("Oitavas de Final")).toBeInTheDocument();
    expect(screen.getByText("Quartas de Final")).toBeInTheDocument();
    expect(screen.getByText("Semifinais")).toBeInTheDocument();
    // Active phase = Oitavas by default; team grid shows the teams
    expect(screen.getByText("Brasil")).toBeInTheDocument();
  });

  it("hides the 16 Avos de Final tab when there are no round-of-32 matches", async () => {
    render(
      <KnockoutClassificationsCard
        matches={[makeMatch()]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados 2º Fase"));

    // Only Oitavas-onward matches exist, so the round-of-32 tab stays hidden.
    expect(screen.queryByText("16 Avos de Final")).not.toBeInTheDocument();
    expect(screen.getByText("Oitavas de Final")).toBeInTheDocument();
  });

  it("shows the 16 Avos de Final tab when a round-of-32 (LAST_32) match exists", async () => {
    render(
      <KnockoutClassificationsCard
        matches={[
          makeMatch({
            id: "r32-1",
            stage: "LAST_32",
            group: "16 Avos de Final",
          }),
          makeMatch(),
        ]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados 2º Fase"));

    expect(screen.getByText("16 Avos de Final")).toBeInTheDocument();
    // Default active phase is still Oitavas.
    expect(screen.getByText("Oitavas de Final")).toBeInTheDocument();
  });

  it("renders the search box and filters teams by name when unlocked", async () => {
    render(
      <KnockoutClassificationsCard
        matches={[makeMatch()]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados 2º Fase"));

    const search = screen.getByPlaceholderText("Buscar seleção...");
    await userEvent.type(search, "argent");
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.queryByText("Brasil")).not.toBeInTheDocument();
    expect(screen.queryByText("França")).not.toBeInTheDocument();
  });

  it("shows the Bloqueado state and hides the search box when the phase is locked", async () => {
    // The phase lock is driven by the phase's first match date, not the
    // lockDate prop. A match in the past locks the Oitavas phase.
    render(
      <KnockoutClassificationsCard
        matches={[makeMatch({ date: "2000-07-01T18:00:00Z" })]}
        prediction={undefined}
        lockDate={pastLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados 2º Fase"));

    expect(screen.getByText("Bloqueado")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Buscar seleção...")
    ).not.toBeInTheDocument();
    // No save button when locked
    expect(screen.queryByText("Salvar Fase")).not.toBeInTheDocument();
  });

  it("toggles a team selection and reflects the count in the active tab", async () => {
    render(
      <KnockoutClassificationsCard
        matches={[makeMatch()]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados 2º Fase"));

    // count badge starts at 0/16 for Oitavas
    expect(screen.getByText("0/16")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Brasil"));
    expect(screen.getByText("1/16")).toBeInTheDocument();
  });

  it("toggles the all-phases accordion and hides picks until globally locked", async () => {
    fakeDb.tournamentPredictions = [
      {
        userId: "u2",
        groupId: "g1",
        groupClassifications: { Oitavas: ["t1", "t2"] },
      },
    ];
    render(
      <KnockoutClassificationsCard
        matches={[makeMatch()]}
        prediction={undefined}
        lockDate={futureLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados 2º Fase"));

    const trigger = screen.getByText(/Palpites do Grupo - Todas as Fases \(1\)/);
    await userEvent.click(trigger);
    expect(screen.getByText("Outro Membro")).toBeInTheDocument();
    expect(screen.getAllByText("Oculto").length).toBeGreaterThan(0);
  });

  it("reveals other members' team codes in the all-phases table once globally locked", async () => {
    fakeDb.tournamentPredictions = [
      {
        userId: "u2",
        groupId: "g1",
        groupClassifications: { Oitavas: ["t1", "t2"] },
      },
    ];
    render(
      <KnockoutClassificationsCard
        matches={[makeMatch()]}
        prediction={undefined}
        lockDate={pastLock}
        onPredict={vi.fn()}
        currentUserId="u1"
        currentGroupId="g1"
      />
    );
    await userEvent.click(screen.getByText("Classificados 2º Fase"));
    await userEvent.click(
      screen.getByText(/Palpites do Grupo - Todas as Fases \(1\)/)
    );

    expect(screen.getByText("BRA")).toBeInTheDocument();
    expect(screen.getByText("ARG")).toBeInTheDocument();
  });
});
