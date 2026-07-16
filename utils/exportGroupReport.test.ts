import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { exportGroupReport } from "./exportGroupReport";
import { User, Match, Group, MatchStatus } from "../types";

const teamA = { id: "team-a", name: "Brasil", code: "BRA", flag: "", ranking: 1 };
const teamB = { id: "team-b", name: "Argentina", code: "ARG", flag: "", ranking: 2 };

describe("exportGroupReport", () => {
  it("should generate a workbook with ranking sheet and one sheet per user", () => {
    const group: Group = {
      id: "g1",
      name: "Grupo Teste",
      code: "GTST",
      adminId: "admin-1",
      createdAt: "2026-01-01",
      competitionCode: "WC",
      ruleset: "regulamento_1",
      underdog_min_rank_diff: 10,
    };

    const users: User[] = [
      {
        id: "u1",
        name: "Alice",
        email: "alice@example.com",
        avatar: "",
        role: "USER",
        status: "ACTIVE",
        groupIds: ["g1"],
        activeGroupId: "g1",
        totalPoints: 15,
        predictions: {
          "m1": { home: 2, away: 1 },
        },
        scoreBreakdown: {
          exactCount: 1,
          diffCount: 0,
          outcomeCount: 0,
          wrongCount: 0,
        },
      },
      {
        id: "u2",
        name: "Bob",
        email: "bob@example.com",
        avatar: "",
        role: "USER",
        status: "ACTIVE",
        groupIds: ["g1"],
        activeGroupId: "g1",
        totalPoints: 5,
        predictions: {},
        scoreBreakdown: {
          exactCount: 0,
          diffCount: 0,
          outcomeCount: 1,
          wrongCount: 0,
        },
      },
    ];

    const matches: Match[] = [
      {
        id: "m1",
        homeTeam: teamA,
        awayTeam: teamB,
        date: "2026-06-15T16:00:00.000Z",
        group: "Grupo A",
        competitionCode: "WC",
        status: MatchStatus.FINISHED,
        result: { home: 2, away: 1 },
        stage: "GROUP_STAGE",
      },
    ];

    const data = exportGroupReport({
      group,
      users,
      matches,
      tournamentResults: null,
      dbPredictions: [],
      extraPhasePredictions: [],
      competitions: [],
      teams: [teamA, teamB],
      players: [],
      lockDate: null,
    });

    const workbook = XLSX.read(data, { type: "array" });

    expect(workbook.SheetNames).toContain("Ranking");
    expect(workbook.SheetNames).toContain("Alice");
    expect(workbook.SheetNames).toContain("Bob");
    expect(workbook.SheetNames.length).toBe(3);

    const rankingSheet = workbook.Sheets["Ranking"];
    const rankingData = XLSX.utils.sheet_to_json(rankingSheet);
    expect(rankingData).toHaveLength(2);
    expect(rankingData[0]).toMatchObject({ Nome: "Alice", "Pontos Totais": 15 });
    expect(rankingData[1]).toMatchObject({ Nome: "Bob", "Pontos Totais": 5 });
  });

  it("should handle empty group without throwing", () => {
    const group: Group = {
      id: "g-empty",
      name: "Empty",
      code: "EMPT",
      adminId: "admin-1",
      createdAt: "2026-01-01",
      ruleset: "regulamento_1",
    };

    const data = exportGroupReport({
      group,
      users: [],
      matches: [],
      tournamentResults: null,
      dbPredictions: [],
      extraPhasePredictions: [],
      competitions: [],
      teams: [],
      players: [],
      lockDate: null,
    });

    const workbook = XLSX.read(data, { type: "array" });
    expect(workbook.SheetNames).toEqual(["Ranking"]);
  });

  it("should sanitize long sheet names", () => {
    const group: Group = {
      id: "g1",
      name: "G",
      code: "G",
      adminId: "admin-1",
      createdAt: "2026-01-01",
      ruleset: "regulamento_1",
    };

    const longName = "A".repeat(40);
    const users: User[] = [
      {
        id: "u1",
        name: longName,
        email: "a@example.com",
        avatar: "",
        role: "USER",
        status: "ACTIVE",
        groupIds: ["g1"],
        totalPoints: 0,
        predictions: {},
      },
    ];

    const data = exportGroupReport({
      group,
      users,
      matches: [],
      tournamentResults: null,
      dbPredictions: [],
      extraPhasePredictions: [],
      competitions: [],
      teams: [],
      players: [],
      lockDate: null,
    });

    const workbook = XLSX.read(data, { type: "array" });
    expect(workbook.SheetNames[1]).toBe(longName.slice(0, 31));
  });
});
