import { describe, it, expect } from "vitest";
import {
  parseApiSportsFixtures,
  canonicalTeamName,
  matchLiveFixtureToInternal,
  type ParsedLiveFixture,
} from "./liveScoreService";
import { Match, MatchStatus } from "../types";

// Payload de exemplo (recortado do retorno real da api-sports).
const SAMPLE = {
  get: "fixtures",
  response: [
    {
      fixture: {
        id: 1489372,
        referee: "Mustapha Ghorbal, Algeria",
        date: "2026-06-14T01:00:00+00:00",
        periods: { first: 1781398800, second: null },
        venue: { id: 1618, name: "Gillette Stadium", city: "Boston" },
        status: { long: "First Half", short: "1H", elapsed: 45, extra: 1 },
      },
      league: { id: 1, name: "World Cup", round: "Group Stage - 1" },
      teams: {
        home: { id: 2386, name: "Haiti" },
        away: { id: 1108, name: "Scotland" },
      },
      goals: { home: 0, away: 1 },
      events: [
        {
          time: { elapsed: 28, extra: null },
          team: { id: 1108, name: "Scotland" },
          player: { id: 19191, name: "J. McGinn" },
          assist: { id: null, name: null },
          type: "Goal",
          detail: "Normal Goal",
          comments: null,
        },
        {
          time: { elapsed: 39, extra: null },
          team: { id: 2386, name: "Haiti" },
          player: { id: 20665, name: "J. Bellegarde" },
          assist: { id: null, name: null },
          type: "Card",
          detail: "Yellow Card",
          comments: "Tripping",
        },
      ],
    },
  ],
};

describe("parseApiSportsFixtures", () => {
  it("normaliza o payload em ParsedLiveFixture", () => {
    const parsed = parseApiSportsFixtures(SAMPLE);
    expect(parsed).toHaveLength(1);
    const fx = parsed[0];
    expect(fx.details.apiSportsFixtureId).toBe(1489372);
    expect(fx.details.statusShort).toBe("1H");
    expect(fx.details.elapsed).toBe(45);
    expect(fx.details.extra).toBe(1);
    expect(fx.details.periods.first).toBe(1781398800);
    expect(fx.details.referee).toBe("Mustapha Ghorbal, Algeria");
    expect(fx.details.venue).toEqual({ name: "Gillette Stadium", city: "Boston" });
    expect(fx.homeName).toBe("Haiti");
    expect(fx.awayName).toBe("Scotland");
    expect(fx.details.events).toHaveLength(2);
    expect(fx.details.events[0]).toMatchObject({
      elapsed: 28,
      player: "J. McGinn",
      type: "Goal",
      detail: "Normal Goal",
    });
  });

  it("retorna [] para payload vazio/ inválido", () => {
    expect(parseApiSportsFixtures({})).toEqual([]);
    expect(parseApiSportsFixtures({ response: null })).toEqual([]);
    expect(parseApiSportsFixtures({ response: [{ fixture: {} }] })).toEqual([]);
  });
});

describe("canonicalTeamName", () => {
  it("normaliza acentos, espaços e caixa", () => {
    expect(canonicalTeamName("Côte d'Ivoire")).toBe("ivorycoast");
    expect(canonicalTeamName("United States")).toBe("usa");
    expect(canonicalTeamName("South Korea")).toBe("korea");
    expect(canonicalTeamName("Korea Republic")).toBe("korea");
  });
});

const makeMatch = (over: Partial<Match>): Match =>
  ({
    id: "m1",
    homeTeam: { id: "h", name: "Haiti", code: "HAI", flag: "", ranking: 1 } as any,
    awayTeam: { id: "a", name: "Scotland", code: "SCO", flag: "", ranking: 2 } as any,
    date: "2026-06-14T01:00:00.000Z",
    group: "Grupo C",
    status: MatchStatus.LIVE,
    ...over,
  }) as Match;

describe("matchLiveFixtureToInternal", () => {
  const fixture: ParsedLiveFixture = parseApiSportsFixtures(SAMPLE)[0];

  it("casa por nome + data (UTC)", () => {
    const internal = makeMatch({});
    const found = matchLiveFixtureToInternal(fixture, [internal]);
    expect(found?.id).toBe("m1");
  });

  it("prioriza apiSportsFixtureId já persistido", () => {
    const tagged = makeMatch({
      id: "tagged",
      homeTeam: { id: "x", name: "Outro", code: "OUT", flag: "", ranking: 9 } as any,
      awayTeam: { id: "y", name: "Time", code: "TIM", flag: "", ranking: 9 } as any,
      date: "2020-01-01T00:00:00.000Z",
      liveDetails: { ...fixture.details },
    });
    const found = matchLiveFixtureToInternal(fixture, [tagged]);
    expect(found?.id).toBe("tagged");
  });

  it("casa mesmo com times invertidos (sede neutra)", () => {
    const swapped = makeMatch({
      id: "swap",
      homeTeam: { id: "a", name: "Scotland", code: "SCO", flag: "", ranking: 2 } as any,
      awayTeam: { id: "h", name: "Haiti", code: "HAI", flag: "", ranking: 1 } as any,
    });
    const found = matchLiveFixtureToInternal(fixture, [swapped]);
    expect(found?.id).toBe("swap");
  });

  it("não casa em datas diferentes", () => {
    const other = makeMatch({ date: "2026-07-01T01:00:00.000Z" });
    expect(matchLiveFixtureToInternal(fixture, [other])).toBeUndefined();
  });
});
