import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  competitions: [{ code: "WC", name: "Copa", biggestGoalDiffMatchIds: {} }],
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
      screen.getByText("Classificados 2ª Fase (16 Avos, Oitavas, Quartas, Semis)")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Maior Diferença de Gols (por Fase)")
    ).toBeInTheDocument();
  });

  it("renders the 16 Avos de Final phase in the knockout classifications section", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    // The new round-of-32 phase should appear in the classifications section.
    // (It appears both in the "Maior Diferença" phase list and as a
    // classifications sub-section, hence getAllByText.)
    const labels = screen.getAllByText(/16 Avos de Final/);
    expect(labels.length).toBeGreaterThanOrEqual(1);

    // The classifications sub-header shows the phase label with a counter (0/32).
    expect(screen.getByText(/16 Avos de Final \(\d+\/32\)/)).toBeInTheDocument();
  });

  it("renders the derived group names from standings", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    expect(screen.getByText("Grupo A")).toBeInTheDocument();
    expect(screen.getByText("Grupo B")).toBeInTheDocument();
  });

  it("renders the autocomplete inputs for biggest goal diff matches", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    // There should be one autocomplete input per phase
    const inputs = screen.getAllByPlaceholderText(/Digite 2 caracteres da seleção mandante/);
    expect(inputs.length).toBe(5); // groups, round_of_32, oitavas, quartas, semis
  });

  it("allows selecting multiple biggest goal diff matches via autocomplete", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    // Type "Br" to find the Brasil match in the groups phase
    const inputs = screen.getAllByPlaceholderText(/Digite 2 caracteres da seleção mandante/);
    fireEvent.focus(inputs[0]);
    fireEvent.change(inputs[0], { target: { value: "Br" } });

    // Click the suggestion (look for the home team name in the dropdown)
    const suggestion = await screen.findByRole("button", { name: /Brasil/ });
    fireEvent.click(suggestion);

    // Save and verify the payload contains the selected match
    await userEvent.click(screen.getByText("Salvar Overrides"));
    expect(fakeDb.updateCompetitionAwards).toHaveBeenCalledTimes(1);
    const payload = fakeDb.updateCompetitionAwards.mock.calls[0][1];
    expect(payload.biggestGoalDiffMatchIds).toEqual({ groups: ["g-m1"] });
  });

  it("calls updateCompetitionAwards when Save is clicked", async () => {
    render(<AdminSpecialsOverrides selectedCompetitionCode="WC" />);
    await userEvent.click(screen.getByText("Overrides Manuais — Especiais"));

    await userEvent.click(screen.getByText("Salvar Overrides"));
    expect(fakeDb.updateCompetitionAwards).toHaveBeenCalledTimes(1);
    expect(fakeDb.updateCompetitionAwards.mock.calls[0][0]).toBe("WC");
    const payload = fakeDb.updateCompetitionAwards.mock.calls[0][1];
    expect(payload.biggestGoalDiffMatchIds).toBeNull();
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
