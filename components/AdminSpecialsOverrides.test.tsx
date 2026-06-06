import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchStatus } from "../types";

let fakeDb: any;

vi.mock("../contexts/DatabaseContext", () => ({
  useDatabase: () => fakeDb,
}));

import AdminSpecialsOverrides from "./AdminSpecialsOverrides";

const teams = [
  { id: "t1", name: "Brasil", code: "BRA", flag: "bra.png", ranking: 1 },
  { id: "t2", name: "Argentina", code: "ARG", flag: "arg.png", ranking: 2 },
  { id: "t3", name: "França", code: "FRA", flag: "fra.png", ranking: 3 },
  { id: "t4", name: "Espanha", code: "ESP", flag: "esp.png", ranking: 4 },
];

const baseDb = () => ({
  competitions: [{ code: "WC", name: "Copa", biggestGoalDiffMatches: {} }],
  teams,
  teamStandings: [
    { teamId: "t1", competitionCode: "WC", group: "Group A" },
    { teamId: "t2", competitionCode: "WC", group: "Group A" },
    { teamId: "t3", competitionCode: "WC", group: "Group B" },
    { teamId: "t4", competitionCode: "WC", group: "Group B" },
  ],
  matches: [
    {
      id: "g-m1",
      homeTeamId: "t1",
      awayTeamId: "t2",
      competitionCode: "WC",
      group: "Grupo A",
      stage: "GROUP_STAGE",
      status: MatchStatus.SCHEDULED,
    },
    {
      id: "ko-m1",
      homeTeamId: "t3",
      awayTeamId: "t4",
      competitionCode: "WC",
      group: "Oitavas",
      stage: "ROUND_OF_16",
      status: MatchStatus.SCHEDULED,
    },
  ],
  updateCompetitionAwards: vi.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  fakeDb = baseDb();
});

describe("AdminSpecialsOverrides", () => {
  it("renders nothing when no competition is selected", () => {
    const { container } = render(
      <AdminSpecialsOverrides selectedCompetitionCode={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the collapsed header when a competition is selected", () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    expect(
      screen.getByText("Overrides Manuais — Especiais")
    ).toBeInTheDocument();
    // Sections hidden until expanded
    expect(
      screen.queryByText("Classificados dos Grupos (1º e 2º)")
    ).not.toBeInTheDocument();
  });

  it("expands to reveal the three override sections", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    expect(
      screen.getByText("Classificados dos Grupos (1º e 2º)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Classificados 2ª Fase (Oitavas, Quartas, Semis)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Maior Diferença de Gols (por Fase)")
    ).toBeInTheDocument();
  });

  it("renders the derived group names from standings", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    expect(screen.getByText("Grupo A")).toBeInTheDocument();
    expect(screen.getByText("Grupo B")).toBeInTheDocument();
  });

  it("renders the team options inside the group classification selects", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    // Group A select should offer its two teams as <option> elements
    const options = screen.getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Brasil");
    expect(optionTexts).toContain("Argentina");
  });

  it("calls updateCompetitionAwards when Save is clicked", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    await userEvent.click(screen.getByText("Salvar Overrides"));
    expect(fakeDb.updateCompetitionAwards).toHaveBeenCalledTimes(1);
    expect(fakeDb.updateCompetitionAwards.mock.calls[0][0]).toBe("WC");
  });

  it("shows a fallback message when no groups exist for the competition", async () => {
    fakeDb.teamStandings = [];
    fakeDb.matches = [];
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    expect(
      screen.getByText(/Nenhum grupo encontrado para esta competição/)
    ).toBeInTheDocument();
  });
});
