import { Match, MatchStatus, CompetitionDB } from "../types";
import { DEFAULT_COMPETITION_CODE } from "../data/competitions";

/**
 * SERVIÇO DE PLACARES AO VIVO (SEGURO)
 */

// --- TEAMS ---

export interface ExternalTeam {
  id: number;
  name: string;
  shortName?: string;
  tla: string;
  crest?: string;
}

export const fetchCompetitionTeams = async (
  competitionCode = DEFAULT_COMPETITION_CODE,
  season = getCurrentSeason(),
): Promise<ExternalTeam[]> => {
  const buildUrl = (withSeason: boolean) => {
    const params = new URLSearchParams();
    params.set("competition", (competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase());
    if (withSeason) params.set("season", season);
    return `/api/teams?${params.toString()}`;
  };

  try {
    let response = await fetch(buildUrl(true));
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      console.error("[TEAMS] Resposta não-JSON do proxy.");
      return [];
    }

    let payload = await response.json().catch(() => ({}));

    if (!response.ok && (response.status === 404 || response.status === 403)) {
      console.warn(`[TEAMS] Season ${season} não encontrada para ${competitionCode}. Tentando sem season...`);
      response = await fetch(buildUrl(false));
      payload = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
      console.error(`[TEAMS] Erro (${response.status}):`, payload.message);
      return [];
    }

    return (payload.teams || []) as ExternalTeam[];
  } catch (error) {
    console.error("[TEAMS] Falha na comunicação com /api/teams:", error);
    return [];
  }
};

export interface ExternalMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
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
  group: string | null;
  table: ExternalStandingRow[];
}

export interface ExternalStandingsResponse {
  filters?: { season?: string };
  competition?: { id?: number; code?: string; name?: string };
  standings: ExternalStandingGroup[];
}

export const getCurrentSeason = (): string =>
  new Date().getFullYear().toString();

export const fetchExternalMatches = async (
  competitionCode = DEFAULT_COMPETITION_CODE,
  season = getCurrentSeason(),
): Promise<ExternalMatch[]> => {
  // Rota interna segura que oculta seu Token
  const buildUrl = (seasonParam?: string) => {
    const params = new URLSearchParams();
    params.set("competition", (competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase());
    if (seasonParam) {
      params.set("season", seasonParam);
    }
    return `/api/matches?${params.toString()}`;
  };

  const tryFetch = async (seasonParam?: string) => {
    const response = await fetch(buildUrl(seasonParam));
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const raw = await response.text().catch(() => "");
      console.error(
        "[LIVE SCORE] /api/matches retornou conteúdo não-JSON.",
        raw.slice(0, 200),
      );
      return { response, payload: {}, invalidContent: true };
    }

    const payload = await response.json().catch(() => ({}));
    return { response, payload, invalidContent: false };
  };

  try {
    let { response, payload, invalidContent } = await tryFetch(season);

    if (invalidContent) {
      return [];
    }

    if (
      !response.ok &&
      season &&
      (response.status === 404 || response.status === 403)
    ) {
      console.warn(
        `[LIVE SCORE] Season ${season} indisponível para ${competitionCode}. Tentando sem season...`,
      );
      const fallbackResult = await tryFetch();
      response = fallbackResult.response;
      payload = fallbackResult.payload;
      invalidContent = fallbackResult.invalidContent;
    }

    if (invalidContent) {
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

      if (response.status === 404 || response.status === 403) {
        console.warn(
          "[LIVE SCORE] A API da Football-Data não possui jogos para os parâmetros informados.",
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
  competitionCode = DEFAULT_COMPETITION_CODE,
  season = getCurrentSeason(),
): Promise<ExternalStandingsResponse | null> => {
  const buildUrl = (seasonParam?: string) => {
    const params = new URLSearchParams();
    params.set("competition", (competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase());
    if (seasonParam) {
      params.set("season", seasonParam);
    }
    return `/api/standings?${params.toString()}`;
  };

  const tryFetch = async (seasonParam?: string) => {
    const response = await fetch(buildUrl(seasonParam));
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const raw = await response.text().catch(() => "");
      console.error(
        "[LIVE SCORE] /api/standings retornou conteúdo não-JSON.",
        raw.slice(0, 200),
      );
      return { response, payload: {}, invalidContent: true };
    }

    const payload = await response.json().catch(() => ({}));
    return { response, payload, invalidContent: false };
  };

  try {
    let { response, payload, invalidContent } = await tryFetch(season);

    if (invalidContent) {
      return null;
    }

    if (
      !response.ok &&
      season &&
      (response.status === 404 || response.status === 403)
    ) {
      console.warn(
        `[LIVE SCORE] Season ${season} não encontrada para ${competitionCode}. Tentando sem season...`,
      );
      const fallbackResult = await tryFetch();
      response = fallbackResult.response;
      payload = fallbackResult.payload;
      invalidContent = fallbackResult.invalidContent;
    }

    if (invalidContent) {
      return null;
    }

    if (!response.ok) {
      const errorData = payload || {};
      console.error(
        `[LIVE SCORE] Erro na API proxy (${response.status}):`,
        errorData.message || response.statusText,
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

// --- COMPETITIONS ---

export interface ExternalCompetition {
  id: number;
  code: string;
  name: string;
  emblem?: string;
  type?: string; // "LEAGUE" | "CUP"
  lastUpdated?: string;
}

export const fetchExternalCompetitions = async (): Promise<CompetitionDB[]> => {
  try {
    const response = await fetch("/api/competitions");
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      console.error("[COMPETITIONS] Resposta não-JSON do proxy.");
      return [];
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        `[COMPETITIONS] Erro (${response.status}):`,
        payload.message || payload.error,
      );
      return [];
    }

    const competitions: ExternalCompetition[] = payload.competitions || [];

    return competitions.map((c) => ({
      code: c.code,
      name: c.name,
      emblem: c.emblem || undefined,
      type: c.type || undefined,
    }));
  } catch (error) {
    console.error("[COMPETITIONS] Falha ao buscar competições:", error);
    return [];
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
  const homeExternalId = externalMatch.homeTeam.id;
  const awayExternalId = externalMatch.awayTeam.id;

  return internalMatches.find((m) => {
    // 1. Prioridade absoluta: Match ID externo
    if (
      m.externalMatchId &&
      externalMatch.id &&
      String(m.externalMatchId) === String(externalMatch.id)
    ) {
      return true;
    }

    // 2. Fallback: Data + Times (Considerando IDs de times se disponíveis)
    const sameDay =
      new Date(m.date).toISOString().slice(0, 10) ===
      new Date(externalMatch.utcDate).toISOString().slice(0, 10);

    if (!sameDay) return false;

    // Se temos IDs externos nos dois lados, comparamos por ID (evita erro de TLA duplicado como "COR")
    const hasExternalTeamIds = 
      homeExternalId != null && 
      awayExternalId != null && 
      m.homeTeam?.externalTeamId != null && 
      m.awayTeam?.externalTeamId != null;

    if (hasExternalTeamIds) {
      return (
        m.homeTeam.externalTeamId === homeExternalId &&
        m.awayTeam.externalTeamId === awayExternalId
      );
    }

    // Último recurso: TLA (Sujeito a colisões como Corinthians/Coritiba se os IDs não estiverem presentes)
    return (
      m.homeTeam?.code === homeCode &&
      m.awayTeam?.code === awayCode
    );
  });
};

