import { Match, MatchStatus } from "../types";

/**
 * SERVIÇO DE PLACARES AO VIVO (SEGURO)
 */

export interface ExternalMatch {
  id: number;
  utcDate: string;
  status: string;
  group?: string | null;
  stage?: string;
  homeTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla: string;
    crest?: string;
  } | null;
  awayTeam: {
    id: number;
    name: string;
    shortName?: string;
    tla: string;
    crest?: string;
  } | null;
  score?: {
    fullTime?: { home: number; away: number };
  };
}

export interface ExternalStandingTeam {
  id: number;
  name: string;
  shortName?: string;
  tla: string;
  crest?: string;
}

export interface ExternalStandingRow {
  position: number;
  team: ExternalStandingTeam;
  playedGames: number;
  form: string | null;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface ExternalStandingGroup {
  stage: string;
  type: string;
  group: string;
  table: ExternalStandingRow[];
}

export interface ExternalStandingsResponse {
  filters?: { season?: string };
  competition?: { id?: number; code?: string; name?: string };
  standings: ExternalStandingGroup[];
}

export const fetchExternalMatches = async (): Promise<ExternalMatch[]> => {
  // Rota interna segura que oculta seu Token
  const internalApiUrl = "/api/matches";

  try {
    const response = await fetch(internalApiUrl);
    const contentType = response.headers.get("content-type") || "";

    let payload: any = {};
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => ({}));
    } else {
      const raw = await response.text().catch(() => "");
      console.error(
        "[LIVE SCORE] /api/matches retornou conteúdo não-JSON.",
        raw.slice(0, 200),
      );
      return [];
    }

    if (!response.ok) {
      const errorData = payload || {};

      if (response.status === 429) {
        const retryHeader = response.headers.get("retry-after");
        const waitFromHeader = retryHeader ? Number(retryHeader) : NaN;
        const waitFromMessage = Number(
          (errorData.message || "").match(/(\d+)\s*seconds?/i)?.[1] || NaN,
        );
        const waitSeconds =
          Number.isFinite(waitFromHeader) && waitFromHeader > 0
            ? waitFromHeader
            : Number.isFinite(waitFromMessage) && waitFromMessage > 0
              ? waitFromMessage
              : 30;

        throw new Error(`RATE_LIMIT_${waitSeconds}`);
      }

      // Se der 404, explicamos que pode ser ausência de dados para 2026
      if (response.status === 404) {
        console.warn(
          "[LIVE SCORE] A API da Football-Data ainda não possui jogos para a Copa de 2026.",
        );
      } else {
        console.error(
          `[LIVE SCORE] Erro no Proxy (${response.status}):`,
          errorData.message || errorData.error,
        );
      }
      return [];
    }

    const data = payload;
    return data.matches || [];
  } catch (error) {
    console.error(
      "[LIVE SCORE] Falha na comunicação com o servidor local/Vercel:",
      error,
    );
    return [];
  }
};

export const fetchExternalStandings = async (
  competitionCode = "WC",
  season = "2026",
): Promise<ExternalStandingsResponse | null> => {
  const params = new URLSearchParams({ season });
  if (competitionCode && competitionCode.toUpperCase() !== "WC") {
    params.set("competition", competitionCode.toUpperCase());
  }
  const internalApiUrl = `/api/standings?${params.toString()}`;

  try {
    const response = await fetch(internalApiUrl);
    const contentType = response.headers.get("content-type") || "";

    let payload: any = {};
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => ({}));
    } else {
      const raw = await response.text().catch(() => "");
      console.error(
        "[LIVE SCORE] /api/standings retornou conteúdo não-JSON.",
        raw.slice(0, 200),
      );
      return null;
    }

    if (!response.ok) {
      const errorData = payload || {};
      console.error(
        `[LIVE SCORE] Erro no Proxy Standings (${response.status}):`,
        errorData.message || errorData.error,
      );
      return null;
    }

    if (!Array.isArray(payload.standings)) {
      return null;
    }

    return payload as ExternalStandingsResponse;
  } catch (error) {
    console.error(
      "[LIVE SCORE] Falha na comunicação com /api/standings:",
      error,
    );
    return null;
  }
};

export const mapExternalStatusToInternal = (status: string): MatchStatus => {
  if (["IN_PLAY", "PAUSED"].includes(status)) return MatchStatus.LIVE;
  if (["FINISHED", "AWARDED"].includes(status)) return MatchStatus.FINISHED;
  return MatchStatus.SCHEDULED;
};

export const findInternalMatch = (
  externalMatch: ExternalMatch,
  internalMatches: Match[],
): Match | undefined => {
  if (!externalMatch.homeTeam || !externalMatch.awayTeam) return undefined;

  const homeCode = externalMatch.homeTeam.tla;
  const awayCode = externalMatch.awayTeam.tla;

  if (!homeCode || !awayCode) return undefined;

  return internalMatches.find((m) => {
    return m.homeTeam.code === homeCode && m.awayTeam.code === awayCode;
  });
};
