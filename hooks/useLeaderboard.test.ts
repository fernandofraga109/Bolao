import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLeaderboard } from "./useLeaderboard";
import { MatchStatus } from "../types";

const makeUser = (id: string, overrides = {}) => ({
  id,
  name: `User ${id}`,
  email: `${id}@test.com`,
  avatar: "",
  role: "USER" as const,
  status: "ACTIVE" as const,
  groupIds: ["g1"],
  activeGroupId: "g1",
  predictions: {},
  totalPoints: 0,
  ...overrides,
});

const makeMatch = (id: string, status: MatchStatus, result?: { home: number; away: number }) => ({
  id,
  date: "2026-06-01T00:00:00Z",
  status,
  result,
  homeTeam: { id: "t1", name: "Brasil", flag: "", ranking: 1, code: "BRA" },
  awayTeam: { id: "t2", name: "Argentina", flag: "", ranking: 2, code: "ARG" },
  group: "Grupo A",
  competitionCode: "WC",
  stadiumId: "s1",
});

const makeGroup = (id: string) => ({
  id,
  name: `Grupo ${id}`,
  code: "ABC123",
  adminId: "admin",
  createdAt: "2026-01-01",
  competitionCode: "WC",
  ruleset: "regulamento_1" as const,
});

describe("useLeaderboard", () => {
  describe("usersWithCalculatedPoints", () => {
    it("exclui usuários com role ADMIN do ranking", () => {
      const users = [
        makeUser("u1"),
        makeUser("admin1", { role: "ADMIN" }),
      ];
      const { result } = renderHook(() =>
        useLeaderboard(users, [], null, null, { userGroups: [], predictions: [] }, [])
      );
      expect(result.current.usersWithCalculatedPoints).toHaveLength(1);
      expect(result.current.usersWithCalculatedPoints[0].id).toBe("u1");
    });

    it("soma pontos apenas de jogos finalizados", () => {
      const finishedMatch = makeMatch("m1", MatchStatus.FINISHED, { home: 2, away: 1 });
      const scheduledMatch = makeMatch("m2", MatchStatus.SCHEDULED);

      const users = [
        makeUser("u1", {
          predictions: {
            m1: { home: 2, away: 1 }, // placar exato = 10 pts
            m2: { home: 1, away: 0 }, // sem resultado ainda
          },
        }),
      ];

      const { result } = renderHook(() =>
        useLeaderboard(users, [finishedMatch, scheduledMatch], null, null, { userGroups: [], predictions: [] }, [])
      );

      expect(result.current.usersWithCalculatedPoints[0].totalPoints).toBe(10);
    });

    it("usa pontos persistidos no banco quando disponíveis", () => {
      const finishedMatch = makeMatch("m1", MatchStatus.FINISHED, { home: 1, away: 0 });

      const users = [
        makeUser("u1", {
          predictions: {
            m1: { home: 2, away: 0, points: 7 }, // DB diz 7, cálculo daria 5
          },
        }),
      ];

      const { result } = renderHook(() =>
        useLeaderboard(users, [finishedMatch], null, null, { userGroups: [], predictions: [] }, [])
      );

      expect(result.current.usersWithCalculatedPoints[0].totalPoints).toBe(7);
    });
  });

  describe("leaderboardSections", () => {
    it("retorna lista vazia quando currentUser é null", () => {
      const { result } = renderHook(() =>
        useLeaderboard([], [], null, null, { userGroups: [], predictions: [] }, [])
      );
      expect(result.current.leaderboardSections).toEqual([]);
    });

    it("popula scoreBreakdown para regulamento_1", () => {
      const finishedMatch = makeMatch("m1", MatchStatus.FINISHED, { home: 2, away: 1 });

      const users = [
        makeUser("u1", {
          predictions: {
            m1: { home: 2, away: 1 }, // exact
          },
        }),
      ];

      const { result } = renderHook(() =>
        useLeaderboard(users, [finishedMatch], makeUser("u1"), null, { userGroups: [], predictions: [] }, [makeGroup("g1")])
      );

      const bd = result.current.usersWithCalculatedPoints[0].scoreBreakdown;
      expect(bd).toBeDefined();
      expect(bd?.exactCount).toBe(1);
      expect(bd?.diffCount).toBe(0);
      expect(bd?.outcomeCount).toBe(0);
      expect(bd?.wrongCount).toBe(0);
    });

    it("usa pontos do banco (userGroups) quando disponíveis", () => {
      const finishedMatch = makeMatch("m1", MatchStatus.FINISHED, { home: 1, away: 0 });
      const users = [
        makeUser("u1", {
          predictions: {
            m1: { home: 1, away: 0, points: 42 },
          },
        }),
        makeUser("u2", {
          predictions: {
            m1: { home: 0, away: 0, points: 15 },
          },
        }),
      ];
      const currentUser = makeUser("u1");
      const groups = [makeGroup("g1")];

      const userGroups = [
        { userId: "u1", groupId: "g1", points: 42 },
        { userId: "u2", groupId: "g1", points: 15 },
      ];

      const { result } = renderHook(() =>
        useLeaderboard(users, [finishedMatch], currentUser, null, { userGroups, predictions: [] }, groups)
      );

      const section = result.current.leaderboardSections[0];
      const u1 = section.users.find((u) => u.id === "u1");
      expect(u1?.totalPoints).toBe(42);
    });

    it("filtra seções sem usuários", () => {
      const currentUser = makeUser("u1", { groupIds: ["g1", "g2"] });
      const groups = [makeGroup("g1"), makeGroup("g2")];

      // g2 não tem usuários associados
      const users = [makeUser("u1")];

      const { result } = renderHook(() =>
        useLeaderboard(users, [], currentUser, null, { userGroups: [], predictions: [] }, groups)
      );

      // Só g1 deve aparecer (u1 está em g1)
      expect(result.current.leaderboardSections).toHaveLength(1);
      expect(result.current.leaderboardSections[0].groupId).toBe("g1");
    });
  });
});
