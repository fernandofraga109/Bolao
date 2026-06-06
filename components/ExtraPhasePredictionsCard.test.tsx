import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchStatus } from "../types";

// ─── Fake database (mutable, reset per test) ──────────────────────────────────
let fakeDb: any;

vi.mock("../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

import { ExtraPhasePredictionsCard } from "./ExtraPhasePredictionsCard";

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

const baseDb = () => ({
  extraPhasePredictions: [] as any[],
  teams: [
    { id: "t1", name: "Brasil", code: "BRA", flag: "bra.png", ranking: 1 },
    { id: "t2", name: "Argentina", code: "ARG", flag: "arg.png", ranking: 2 },
    { id: "t3", name: "França", code: "FRA", flag: "fra.png", ranking: 3 },
    { id: "t4", name: "Espanha", code: "ESP", flag: "esp.png", ranking: 4 },
  ],
  users: [
    { id: "u1", name: "Eu" },
    { id: "u2", name: "Outro Membro" },
  ],
  groups: [{ id: "g1", competitionCode: "WC" }],
  competitions: [{ code: "WC", biggestGoalDiffMatches: {} }],
  upsertExtraPhasePrediction: vi.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  fakeDb = baseDb();
});

const futureLock = new Date("2030-01-01T00:00:00Z");
const pastLock = new Date("2000-01-01T00:00:00Z");

describe("ExtraPhasePredictionsCard", () => {
  it("renders the card header without crashing", () => {
    render(
      <ExtraPhasePredictionsCard
        groupId="g1"
        userId="u1"
        matches={[]}
        lockDate={futureLock}
      />
    );
    expect(
      screen.getByText("Maior Diferença de Gols por Fase")
    ).toBeInTheDocument();
  });

  it("keeps the phase list collapsed until the header accordion is opened", async () => {
    render(
      <ExtraPhasePredictionsCard
        groupId="g1"
        userId="u1"
        matches={[makeMatch()]}
        lockDate={futureLock}
      />
    );
    // Phase labels are hidden while card collapsed
    expect(screen.queryByText("Fase de Grupos")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Maior Diferença de Gols por Fase"));
    expect(screen.getByText("Fase de Grupos")).toBeInTheDocument();
    expect(screen.getByText("Oitavas de Final")).toBeInTheDocument();
  });

  it("shows 'Aberto' badge when the groups phase is unlocked and lets the user open the match dropdown", async () => {
    render(
      <ExtraPhasePredictionsCard
        groupId="g1"
        userId="u1"
        matches={[
          makeMatch({ id: "m1", homeTeamId: "t1", awayTeamId: "t2" }),
          makeMatch({ id: "m2", homeTeamId: "t3", awayTeamId: "t4" }),
        ]}
        lockDate={futureLock}
      />
    );
    await userEvent.click(screen.getByText("Maior Diferença de Gols por Fase"));

    // groups phase is expanded by default (expandedPhase = "groups")
    // (all unlocked phases render an "Aberto" badge)
    expect(screen.getAllByText("Aberto").length).toBeGreaterThan(0);
    // Save button is present when unlocked
    expect(screen.getByText("Salvar")).toBeInTheDocument();

    // Open the team dropdown -> matches listed
    await userEvent.click(screen.getByText("Selecione o jogo..."));
    // Both teams from at least one match should appear in the dropdown
    expect(screen.getAllByText("Brasil").length).toBeGreaterThan(0);
    expect(screen.getAllByText("França").length).toBeGreaterThan(0);
  });

  it("locks the groups phase when lockDate is in the past (no Salvar button, shows Em Andamento)", async () => {
    render(
      <ExtraPhasePredictionsCard
        groupId="g1"
        userId="u1"
        matches={[makeMatch()]}
        lockDate={pastLock}
      />
    );
    await userEvent.click(screen.getByText("Maior Diferença de Gols por Fase"));

    expect(screen.getAllByText("Em Andamento").length).toBeGreaterThan(0);
    expect(screen.queryByText("Salvar")).not.toBeInTheDocument();
  });

  it("toggles the 'Palpites do Grupo' accordion and hides other members' picks until locked", async () => {
    fakeDb.extraPhasePredictions = [
      { userId: "u2", groupId: "g1", phase: "groups", matchId: "m1" },
    ];
    render(
      <ExtraPhasePredictionsCard
        groupId="g1"
        userId="u1"
        matches={[makeMatch({ id: "m1" })]}
        lockDate={futureLock}
      />
    );
    await userEvent.click(screen.getByText("Maior Diferença de Gols por Fase"));

    // Accordion trigger shows count of other predictions
    const trigger = screen.getByText(/Palpites do Grupo \(1\)/);
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);
    // Other member is listed, but their pick is hidden (Oculto) because unlocked
    expect(screen.getByText("Outro Membro")).toBeInTheDocument();
    expect(screen.getByText("Oculto")).toBeInTheDocument();
  });

  it("reveals other members' picks once the phase is locked", async () => {
    fakeDb.extraPhasePredictions = [
      { userId: "u2", groupId: "g1", phase: "groups", matchId: "m1" },
    ];
    render(
      <ExtraPhasePredictionsCard
        groupId="g1"
        userId="u1"
        matches={[makeMatch({ id: "m1", homeTeamId: "t1", awayTeamId: "t2" })]}
        lockDate={pastLock}
      />
    );
    await userEvent.click(screen.getByText("Maior Diferença de Gols por Fase"));
    await userEvent.click(screen.getByText(/Palpites do Grupo \(1\)/));

    // Match label uses team codes when locked
    expect(screen.getByText("BRA vs ARG")).toBeInTheDocument();
    expect(screen.queryByText("Oculto")).not.toBeInTheDocument();
  });
});
