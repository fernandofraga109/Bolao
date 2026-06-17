import { describe, it, expect } from "vitest";
import { parseLiveStats } from "./liveScoreService";

// Ids de exemplo (api-sports) usados em todo o arquivo.
const FIXTURE_ID = 1489372;
const HOME_API_ID = 2386; // Haiti
const AWAY_API_ID = 1108; // Scotland

const makeEntry = (teamId: number, statistics: any[]) => ({
  team: { id: teamId, name: `team-${teamId}` },
  statistics,
});

const HOME_STATS = [
  { type: "Ball Possession", value: "45%" },
  { type: "Total Shots", value: 6 },
];
const AWAY_STATS = [
  { type: "Ball Possession", value: "55%" },
  { type: "Total Shots", value: 11 },
];

describe("parseLiveStats", () => {
  describe("payload vazio / sem response", () => {
    it("retorna null para {}", () => {
      expect(parseLiveStats({}, FIXTURE_ID, HOME_API_ID, AWAY_API_ID)).toBeNull();
    });

    it("retorna null para { response: [] }", () => {
      expect(
        parseLiveStats({ response: [] }, FIXTURE_ID, HOME_API_ID, AWAY_API_ID),
      ).toBeNull();
    });

    it("retorna null para response não-array", () => {
      expect(
        parseLiveStats({ response: null }, FIXTURE_ID, HOME_API_ID, AWAY_API_ID),
      ).toBeNull();
      expect(
        parseLiveStats(null, FIXTURE_ID, HOME_API_ID, AWAY_API_ID),
      ).toBeNull();
    });
  });

  describe("alinhamento por team.id", () => {
    it("casa home/away pelos ids quando vêm na ordem [home, away]", () => {
      const payload = {
        response: [
          makeEntry(HOME_API_ID, HOME_STATS),
          makeEntry(AWAY_API_ID, AWAY_STATS),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(result).not.toBeNull();
      expect(result!.apiSportsFixtureId).toBe(FIXTURE_ID);
      expect(result!.home).toEqual(HOME_STATS);
      expect(result!.away).toEqual(AWAY_STATS);
    });

    it("casa home/away pelos ids mesmo com a ordem INVERTIDA [away, home]", () => {
      const payload = {
        response: [
          makeEntry(AWAY_API_ID, AWAY_STATS),
          makeEntry(HOME_API_ID, HOME_STATS),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(result).not.toBeNull();
      // home deve ser o time cujo id == homeApiId, independente da ordem do array.
      expect(result!.home).toEqual(HOME_STATS);
      expect(result!.away).toEqual(AWAY_STATS);
    });
  });

  describe("fallback por ordem quando os ids não casam", () => {
    it("usa [response[0]=home, response[1]=away] quando ambos os ids são null", () => {
      const payload = {
        response: [
          makeEntry(999, HOME_STATS),
          makeEntry(888, AWAY_STATS),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, null, null);

      expect(result).not.toBeNull();
      expect(result!.home).toEqual(HOME_STATS);
      expect(result!.away).toEqual(AWAY_STATS);
    });

    it("usa a ordem quando os ids informados não batem com nenhum entry", () => {
      const payload = {
        response: [
          makeEntry(111, HOME_STATS),
          makeEntry(222, AWAY_STATS),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, 7777, 8888);

      expect(result).not.toBeNull();
      expect(result!.home).toEqual(HOME_STATS);
      expect(result!.away).toEqual(AWAY_STATS);
    });
  });

  describe("normalização de value", () => {
    it("preserva number e string (ex.: '55%')", () => {
      const payload = {
        response: [
          makeEntry(HOME_API_ID, [
            { type: "Ball Possession", value: "45%" },
            { type: "Total Shots", value: 6 },
          ]),
          makeEntry(AWAY_API_ID, []),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(result!.home[0]).toEqual({ type: "Ball Possession", value: "45%" });
      expect(result!.home[1]).toEqual({ type: "Total Shots", value: 6 });
    });

    it("mapeia value ausente para null", () => {
      const payload = {
        response: [
          makeEntry(HOME_API_ID, [{ type: "Offsides" }]),
          makeEntry(AWAY_API_ID, []),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(result!.home[0]).toEqual({ type: "Offsides", value: null });
    });

    it("mapeia type ausente para string vazia", () => {
      const payload = {
        response: [
          makeEntry(HOME_API_ID, [{ value: 3 }]),
          makeEntry(AWAY_API_ID, []),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(result!.home[0]).toEqual({ type: "", value: 3 });
    });

    it("trata statistics ausente como lista vazia", () => {
      const payload = {
        response: [
          { team: { id: HOME_API_ID } },
          makeEntry(AWAY_API_ID, AWAY_STATS),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(result!.home).toEqual([]);
      expect(result!.away).toEqual(AWAY_STATS);
    });
  });

  describe("não-vazio e syncedAt", () => {
    it("retorna objeto quando há >=1 stat em qualquer lado", () => {
      const payload = {
        response: [
          makeEntry(HOME_API_ID, []),
          makeEntry(AWAY_API_ID, AWAY_STATS),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(result).not.toBeNull();
      expect(result!.home).toEqual([]);
      expect(result!.away).toEqual(AWAY_STATS);
    });

    it("retorna null quando ambos os lados não têm nenhuma stat", () => {
      const payload = {
        response: [makeEntry(HOME_API_ID, []), makeEntry(AWAY_API_ID, [])],
      };
      expect(
        parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID),
      ).toBeNull();
    });

    it("syncedAt é uma string ISO válida", () => {
      const payload = {
        response: [
          makeEntry(HOME_API_ID, HOME_STATS),
          makeEntry(AWAY_API_ID, AWAY_STATS),
        ],
      };
      const result = parseLiveStats(payload, FIXTURE_ID, HOME_API_ID, AWAY_API_ID);

      expect(typeof result!.syncedAt).toBe("string");
      expect(result!.syncedAt).toBe(new Date(result!.syncedAt).toISOString());
    });
  });
});
