import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCompetitionTeams,
  fetchExternalMatches,
  fetchExternalStandings,
  fetchCompetitionScorers,
} from "./liveScoreService";

/**
 * LIVE SCORE — montagem de URL dos fetchers football-data
 * (`services/liveScoreService.ts`).
 *
 * Após mover a política de season para o servidor (`api/_lib/seasonPolicy.ts`),
 * o CLIENTE não envia mais `season` na query string. A URL de cada fetcher deve
 * conter SOMENTE `?competition=XXX` (caixa alta), e o proxy resolve a season
 * server-side. Estes testes travam essa fronteira de confiança: garantem que
 * nenhum `season` vaza para a request.
 */

const jsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as Response;

const getFetchedUrl = (mock: ReturnType<typeof vi.fn>): string =>
  String(mock.mock.calls[0]?.[0] ?? "");

describe("liveScoreService — URLs sem season", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetchCompetitionTeams monta /api/teams?competition=WC sem season", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ teams: [] }));
    await fetchCompetitionTeams("WC");
    const url = getFetchedUrl(fetchMock);
    expect(url).toBe("/api/teams?competition=WC");
    expect(url).not.toContain("season");
  });

  it("fetchExternalMatches monta /api/matches?competition=WC sem season", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ matches: [] }));
    await fetchExternalMatches("WC");
    const url = getFetchedUrl(fetchMock);
    expect(url).toBe("/api/matches?competition=WC");
    expect(url).not.toContain("season");
  });

  it("fetchExternalStandings monta /api/standings?competition=WC sem season", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ standings: [] }));
    await fetchExternalStandings("WC");
    const url = getFetchedUrl(fetchMock);
    expect(url).toBe("/api/standings?competition=WC");
    expect(url).not.toContain("season");
  });

  it("fetchCompetitionScorers monta /api/scorers?competition=WC sem season", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ scorers: [] }));
    await fetchCompetitionScorers("WC");
    const url = getFetchedUrl(fetchMock);
    expect(url).toBe("/api/scorers?competition=WC");
    expect(url).not.toContain("season");
  });

  it("normaliza o código da competição para caixa alta (bsa → BSA), sem season", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ standings: [] }));
    await fetchExternalStandings("bsa");
    const url = getFetchedUrl(fetchMock);
    expect(url).toBe("/api/standings?competition=BSA");
    expect(url).not.toContain("season");
  });
});
