import { describe, it, expect } from "vitest";
import {
  INITIAL_USERS,
  INITIAL_GROUPS,
  INITIAL_MATCHES,
  TEAMS,
  STADIUMS,
  TOURNAMENT_GROUPS,
  OFFICIAL_TOURNAMENT_RESULTS,
} from "./constants";
import { DB_USERS } from "./data/users_groups/users";
import { DB_GROUPS } from "./data/users_groups/groups";
import { DB_USER_GROUPS } from "./data/users_groups/user_groups";
import { DB_PREDICTIONS } from "./data/users_groups/predictions";
import { DB_TOURNAMENT_PREDICTIONS } from "./data/users_groups/tournament_predictions";

describe("constants", () => {
  describe("INITIAL_GROUPS", () => {
    it("contem todos os grupos de DB_GROUPS", () => {
      expect(INITIAL_GROUPS.length).toBe(DB_GROUPS.length);
    });

    it("cada grupo tem competitionCode populado", () => {
      INITIAL_GROUPS.forEach((g) => {
        expect(g.competitionCode).toBeTruthy();
      });
    });

    it("usa competitionCode do DB_GROUPS ou fallback WC", () => {
      INITIAL_GROUPS.forEach((g, i) => {
        const dbGroup = DB_GROUPS[i];
        const expected = dbGroup.competitionCode || "WC";
        expect(g.competitionCode).toBe(expected);
      });
    });
  });

  describe("INITIAL_USERS", () => {
    it("contem todos os usuarios de DB_USERS", () => {
      expect(INITIAL_USERS.length).toBe(DB_USERS.length);
    });

    it("associa groupIds corretos via DB_USER_GROUPS", () => {
      const adminUser = INITIAL_USERS.find(
        (u) => u.id === "11111111-1111-4111-8111-111111111111",
      );
      expect(adminUser).toBeDefined();
      const expectedGroupIds = DB_USER_GROUPS.filter(
        (rel) => rel.userId === "11111111-1111-4111-8111-111111111111",
      ).map((rel) => rel.groupId);
      expect(adminUser!.groupIds).toEqual(expectedGroupIds);
    });

    it("hidrata predictions a partir de DB_PREDICTIONS", () => {
      const carlos = INITIAL_USERS.find(
        (u) => u.id === "33333333-3333-4333-8333-333333333333",
      );
      expect(carlos).toBeDefined();
      const carlosPreds = DB_PREDICTIONS.filter(
        (p) => p.userId === "33333333-3333-4333-8333-333333333333",
      );
      carlosPreds.forEach((p) => {
        expect(carlos!.predictions[p.matchId]).toEqual({
          home: p.homeScore,
          away: p.awayScore,
        });
      });
    });

    it("hidrata tournamentPredictions a partir de DB_TOURNAMENT_PREDICTIONS", () => {
      const carlos = INITIAL_USERS.find(
        (u) => u.id === "33333333-3333-4333-8333-333333333333",
      );
      expect(carlos).toBeDefined();
      const carlosTournPred = DB_TOURNAMENT_PREDICTIONS.find(
        (tp) => tp.userId === "33333333-3333-4333-8333-333333333333",
      );
      expect(carlos!.tournamentPredictions).toBeDefined();
      expect(carlos!.tournamentPredictions!.championTeamId).toBe(
        carlosTournPred!.championTeamId,
      );
    });

    it("usuario sem tournamentPrediction tem undefined", () => {
      const demo = INITIAL_USERS.find(
        (u) => u.id === "22222222-2222-4222-8222-222222222222",
      );
      expect(demo).toBeDefined();
      const hasTournPred = DB_TOURNAMENT_PREDICTIONS.some(
        (tp) => tp.userId === demo!.id,
      );
      if (!hasTournPred) {
        expect(demo!.tournamentPredictions).toBeUndefined();
      }
    });

    it("activeGroupId fallback para primeiro grupo quando original nao e valido", () => {
      INITIAL_USERS.forEach((user) => {
        const userGroupIds = DB_USER_GROUPS.filter(
          (rel) => rel.userId === user.id,
        ).map((rel) => rel.groupId);
        if (userGroupIds.length > 0) {
          expect(userGroupIds).toContain(user.activeGroupId);
        } else {
          expect(user.activeGroupId).toBeUndefined();
        }
      });
    });

    it("usuario sem grupos tem groupIds vazio e activeGroupId undefined", () => {
      const usersWithoutGroups = INITIAL_USERS.filter(
        (u) =>
          !DB_USER_GROUPS.some((rel) => rel.userId === u.id),
      );
      usersWithoutGroups.forEach((user) => {
        expect(user.groupIds).toEqual([]);
        expect(user.activeGroupId).toBeUndefined();
      });
    });
  });

  describe("re-exports", () => {
    it("TEAMS e um Record nao vazio", () => {
      expect(typeof TEAMS).toBe("object");
      expect(Object.keys(TEAMS).length).toBeGreaterThan(0);
    });

    it("STADIUMS e um Record nao vazio", () => {
      expect(typeof STADIUMS).toBe("object");
      expect(Object.keys(STADIUMS).length).toBeGreaterThan(0);
    });

    it("INITIAL_MATCHES e um array", () => {
      expect(Array.isArray(INITIAL_MATCHES)).toBe(true);
    });

    it("TOURNAMENT_GROUPS e um Record nao vazio", () => {
      expect(typeof TOURNAMENT_GROUPS).toBe("object");
      expect(Object.keys(TOURNAMENT_GROUPS).length).toBeGreaterThan(0);
    });

    it("OFFICIAL_TOURNAMENT_RESULTS e undefined", () => {
      expect(OFFICIAL_TOURNAMENT_RESULTS).toBeUndefined();
    });
  });
});
