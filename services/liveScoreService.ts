import {
  Match,
  MatchStatus,
  CompetitionDB,
  LiveMatchDetails,
  LiveMatchEvent,
  LiveMatchStats,
  LiveTeamStat,
} from "../types";
import { DEFAULT_COMPETITION_CODE } from "../data/competitions";

/**
 * SERVIÇO DE PLACARES AO VIVO (SEGURO)
 */

// --- TEAMS ---

export interface ExternalSquadPlayer {
  id: number;
  name: string;
  position: string;
  dateOfBirth: string;
  nationality: string;
}

export interface ExternalTeam {
  id: number;
  name: string;
  shortName?: string;
  tla: string;
  crest?: string;
  squad?: ExternalSquadPlayer[];
}

export const fetchCompetitionTeams = async (
  competitionCode = DEFAULT_COMPETITION_CODE,
): Promise<ExternalTeam[]> => {
  // Cliente não envia season — o proxy resolve server-side (seasonPolicy).
  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set("competition", (competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase());
    return `/api/teams?${params.toString()}`;
  };

  try {
    const response = await fetch(buildUrl());
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      console.error("[TEAMS] Resposta não-JSON do proxy.");
      return [];
    }

    const payload = await response.json().catch(() => ({}));

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
  minute?: number | null;
  lastUpdated?: string;
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
    winner?: string;
    duration?: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime?: { home: number; away: number };
    halfTime?: { home: number; away: number };
    regularTime?: { home: number; away: number };
    extraTime?: { home: number; away: number };
    penalties?: { home: number; away: number };
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

// A política de `season` por competição vive SERVER-SIDE em
// api/_lib/seasonPolicy.ts. O cliente não envia season; o proxy ignora qualquer
// season recebida e decide sozinho. Isso é uma fronteira de confiança: abas
// antigas (bundle stale) não conseguem injetar `season=2026` e zerar os dados.

export const fetchExternalMatches = async (
  competitionCode = DEFAULT_COMPETITION_CODE,
): Promise<ExternalMatch[]> => {
  // Cliente não envia season — o proxy resolve server-side (seasonPolicy).
  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set("competition", (competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase());
    return `/api/matches?${params.toString()}`;
  };

  const tryFetch = async () => {
    const response = await fetch(buildUrl());
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return { response, payload: {}, invalidContent: true };
    }

    const payload = await response.json().catch(() => ({}));
    return { response, payload, invalidContent: false };
  };

  try {
    const { response, payload, invalidContent } = await tryFetch();

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

/**
 * Busca apenas os jogos ao vivo (IN_PLAY) e retorna um mapa de
 * externalMatchId → minute. O endpoint /matches?status=IN_PLAY
 * é o único que retorna o campo "minute" na API football-data.org.
 */
export const fetchLiveMatchMinutes = async (): Promise<Record<number, number | null>> => {
  try {
    const response = await fetch("/api/live-matches");
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return {};
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn("[LIVE MINUTES] Erro ao buscar jogos ao vivo:", payload.message);
      return {};
    }

    const minuteMap: Record<number, number | null> = {};
    for (const match of payload.matches || []) {
      if (match.id != null) {
        minuteMap[match.id] = match.minute ?? null;
      }
    }

    return minuteMap;
  } catch (error) {
    console.warn("[LIVE MINUTES] Falha ao buscar /api/live-matches:", error);
    return {};
  }
};

export const fetchExternalStandings = async (
  competitionCode = DEFAULT_COMPETITION_CODE,
): Promise<ExternalStandingsResponse | null> => {
  // Cliente não envia season — o proxy resolve server-side (seasonPolicy).
  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set("competition", (competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase());
    return `/api/standings?${params.toString()}`;
  };

  const tryFetch = async () => {
    const response = await fetch(buildUrl());
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
    const { response, payload, invalidContent } = await tryFetch();

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

// --- SCORERS ---

export interface ExternalScorerPlayer {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  nationality?: string;
  section?: string;
}

export interface ExternalScorerTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

export interface ExternalScorer {
  player: ExternalScorerPlayer;
  team: ExternalScorerTeam;
  goals: number;
  assists?: number;
  penalties?: number;
}

export interface ExternalScorersResponse {
  scorers: ExternalScorer[];
}

export const fetchCompetitionScorers = async (
  competitionCode = DEFAULT_COMPETITION_CODE,
): Promise<ExternalScorersResponse | null> => {
  // Cliente não envia season — o proxy resolve server-side (seasonPolicy).
  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set("competition", (competitionCode || DEFAULT_COMPETITION_CODE).toUpperCase());
    return `/api/scorers?${params.toString()}`;
  };

  const tryFetch = async () => {
    const response = await fetch(buildUrl());
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const raw = await response.text().catch(() => "");
      console.error(
        "[SCORERS] /api/scorers retornou conteúdo não-JSON.",
        raw.slice(0, 200),
      );
      return { response, payload: {}, invalidContent: true };
    }

    const payload = await response.json().catch(() => ({}));
    return { response, payload, invalidContent: false };
  };

  try {
    const { response, payload, invalidContent } = await tryFetch();

    if (invalidContent) {
      return null;
    }

    if (!response.ok) {
      const errorData = payload || {};
      console.error(
        `[SCORERS] Erro na API proxy (${response.status}):`,
        errorData.message || errorData.statusText,
      );
      return null;
    }

    if (!Array.isArray(payload.scorers)) {
      return null;
    }

    return payload as ExternalScorersResponse;
  } catch (error) {
    console.error(
      "[SCORERS] Falha na comunicação com /api/scorers:",
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

/**
 * Verifica se um jogo deve ser atualizado comparando o lastUpdated da API
 * com o timestamp do último sync conhecido.
 *
 * Retorna true se:
 * - Não temos registro do último sync (syncTimestamp é null/undefined)
 * - O lastUpdated da API é mais recente que o último sync
 */
export const shouldUpdateByLastUpdated = (
  externalLastUpdated: string | undefined,
  syncTimestamp: string | undefined | null,
  bufferSeconds = 0,
): boolean => {
  if (!externalLastUpdated) return false;
  if (!syncTimestamp) return true; // Nunca sincronizado, deve atualizar

  const externalTime = new Date(externalLastUpdated).getTime();
  const syncTime = new Date(syncTimestamp).getTime();

  // API tem dados mais recentes (com buffer opcional para evitar race conditions)
  return externalTime > syncTime + bufferSeconds * 1000;
};

/**
 * Detecta se os dados da API estão obsoletos/corrompidos por cache.
 *
 * Problema: A API às vezes retorna jogos como IN_PLAY mesmo já tendo acabado,
 * quando o lastUpdated é muito antigo (cache desatualizado).
 *
 * Retorna true se devemos IGNORAR a atualização da API (dados suspeitos)
 */
export const isStaleApiData = (
  externalStatus: string,
  externalLastUpdated: string | undefined,
  maxAgeMinutes = 30,
): boolean => {
  if (!externalLastUpdated) return true; // Sem timestamp = suspeito
  if (externalStatus !== "IN_PLAY" && externalStatus !== "PAUSED") return false; // Só afeta jogos ao vivo

  const lastUpdateTime = new Date(externalLastUpdated).getTime();
  const now = Date.now();
  const ageMinutes = (now - lastUpdateTime) / (1000 * 60);

  // Se lastUpdated tem mais de X minutos e status é IN_PLAY, dados estão obsoletos
  return ageMinutes > maxAgeMinutes;
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

// ===========================================================================
// LIVE DETAILS (api-sports.io) — minuto a minuto
// ---------------------------------------------------------------------------
// Estes dados NÃO entram em nenhum cálculo de pontos. Servem só para a UI ao
// vivo (relógio, eventos, árbitro, estádio). O placar oficial continua vindo
// da football-data.org.
// ===========================================================================

/** Fixture parseado da api-sports, com campos auxiliares para casamento. */
export interface ParsedLiveFixture {
  details: LiveMatchDetails;
  homeName: string;
  awayName: string;
  homeApiId: number | null;
  awayApiId: number | null;
  utcDate: string; // ISO
}

/**
 * Normaliza nome de time para comparação entre APIs distintas:
 * minúsculas, sem acentos, só alfanumérico.
 */
export const normalizeTeamName = (name: string | null | undefined): string =>
  (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Mapa de aliases: nomes que diferem entre football-data e api-sports.
// Chave e valor já normalizados (sem acento/espaço/minúsculo).
const TEAM_NAME_ALIASES: Record<string, string> = {
  southkorea: "korea",
  korearepublic: "korea",
  republicofkorea: "korea",
  unitedstates: "usa",
  unitedstatesofamerica: "usa",
  iriran: "iran",
  cotedivoire: "ivorycoast",
  czechrepublic: "czechia",
  caboverde: "capeverde",
  turkiye: "turkey",
  bosniaandherzegovina: "bosnia",
  congodr: "drcongo",
  drcongo: "drcongo",
  northmacedonia: "macedonia",
};

/** Aplica o alias map sobre o nome normalizado. */
export const canonicalTeamName = (name: string | null | undefined): string => {
  const n = normalizeTeamName(name);
  return TEAM_NAME_ALIASES[n] ?? n;
};

/**
 * Converte o payload bruto da api-sports (fixtures?live=all) numa lista
 * normalizada de fixtures, prontos para casar com os jogos internos.
 */
export const parseApiSportsFixtures = (payload: any): ParsedLiveFixture[] => {
  const response = Array.isArray(payload?.response) ? payload.response : [];
  const out: ParsedLiveFixture[] = [];

  for (const item of response) {
    const fixture = item?.fixture;
    if (!fixture?.id) continue;

    const events: LiveMatchEvent[] = Array.isArray(item?.events)
      ? item.events.map((ev: any) => ({
          elapsed: ev?.time?.elapsed ?? 0,
          extra: ev?.time?.extra ?? null,
          teamApiId: ev?.team?.id ?? null,
          teamName: ev?.team?.name ?? null,
          player: ev?.player?.name ?? null,
          assist: ev?.assist?.name ?? null,
          type: ev?.type ?? "",
          detail: ev?.detail ?? "",
          comments: ev?.comments ?? null,
        }))
      : [];

    const details: LiveMatchDetails = {
      apiSportsFixtureId: fixture.id,
      statusShort: fixture?.status?.short ?? "",
      statusLong: fixture?.status?.long ?? null,
      elapsed: fixture?.status?.elapsed ?? null,
      extra: fixture?.status?.extra ?? null,
      periods: {
        first: fixture?.periods?.first ?? null,
        second: fixture?.periods?.second ?? null,
      },
      referee: fixture?.referee ?? null,
      venue: fixture?.venue
        ? { name: fixture.venue.name ?? null, city: fixture.venue.city ?? null }
        : null,
      round: item?.league?.round ?? null,
      events,
      liveScoreHome: item?.goals?.home ?? null,
      liveScoreAway: item?.goals?.away ?? null,
      syncedAt: new Date().toISOString(),
    };

    out.push({
      details,
      homeName: item?.teams?.home?.name ?? "",
      awayName: item?.teams?.away?.name ?? "",
      homeApiId: item?.teams?.home?.id ?? null,
      awayApiId: item?.teams?.away?.id ?? null,
      utcDate: fixture?.date ?? "",
    });
  }

  return out;
};

const sameUtcDay = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  return (
    new Date(a).toISOString().slice(0, 10) ===
    new Date(b).toISOString().slice(0, 10)
  );
};

/**
 * Casa um fixture da api-sports com um jogo interno.
 * Prioridade:
 *  1. apiSportsFixtureId já persistido (match anterior).
 *  2. Mesmo dia (UTC) + nomes de times batendo (com aliases). Aceita ordem
 *     invertida (home/away trocados) como fallback para sedes neutras.
 */
export const matchLiveFixtureToInternal = (
  fixture: ParsedLiveFixture,
  internalMatches: Match[],
): Match | undefined => {
  // 1. Por id já persistido
  const byId = internalMatches.find(
    (m) =>
      m.liveDetails?.apiSportsFixtureId === fixture.details.apiSportsFixtureId,
  );
  if (byId) return byId;

  // 2. Por data + nomes
  const fHome = canonicalTeamName(fixture.homeName);
  const fAway = canonicalTeamName(fixture.awayName);
  if (!fHome || !fAway) return undefined;

  return internalMatches.find((m) => {
    if (!sameUtcDay(m.date, fixture.utcDate)) return false;
    const mHome = canonicalTeamName(m.homeTeam?.name);
    const mAway = canonicalTeamName(m.awayTeam?.name);
    const direct = mHome === fHome && mAway === fAway;
    const swapped = mHome === fAway && mAway === fHome;
    return direct || swapped;
  });
};

/**
 * Busca os detalhes ao vivo via proxy /api/live-details (api-sports).
 * Retorna [] em qualquer erro — os dados são puramente cosméticos.
 */
export const fetchLiveMatchDetails = async (): Promise<ParsedLiveFixture[]> => {
  try {
    console.log("[LIVE DETAILS] Chamando nova API (api-sports) via /api/live-details…");
    const startedAt = Date.now();
    const response = await fetch("/api/live-details");
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      console.warn("[LIVE DETAILS] Resposta não-JSON do proxy.");
      return [];
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn(
        `[LIVE DETAILS] Erro (${response.status}):`,
        (payload as any)?.message,
      );
      return [];
    }

    const fixtures = parseApiSportsFixtures(payload);
    console.log(
      `[LIVE DETAILS] api-sports OK (${response.status}) em ${Date.now() - startedAt}ms — ${fixtures.length} fixture(s) ao vivo.`,
    );
    return fixtures;
  } catch (error) {
    console.warn("[LIVE DETAILS] Falha ao buscar /api/live-details:", error);
    return [];
  }
};

/**
 * Normaliza o payload do `fixtures/statistics` da api-sports num `LiveMatchStats`,
 * alinhando os dois times ao mandante/visitante INTERNO via `team.id` (api-sports),
 * com fallback por ordem ([home, away]) quando os ids não casam.
 *
 * Guarda E (anti-regressão): retorna `null` se não houver estatística real — o
 * caller NÃO deve sobrescrever um `liveStats` bom com vazio.
 */
export const parseLiveStats = (
  payload: any,
  fixtureId: number,
  homeApiId: number | null,
  awayApiId: number | null,
): LiveMatchStats | null => {
  const response = Array.isArray(payload?.response) ? payload.response : [];
  if (response.length === 0) return null;

  const toStats = (arr: any): LiveTeamStat[] =>
    Array.isArray(arr)
      ? arr.map((s: any) => ({ type: s?.type ?? "", value: s?.value ?? null }))
      : [];

  let homeEntry: any = null;
  let awayEntry: any = null;
  for (const entry of response) {
    const teamId = entry?.team?.id ?? null;
    if (homeApiId != null && teamId === homeApiId) homeEntry = entry;
    else if (awayApiId != null && teamId === awayApiId) awayEntry = entry;
  }
  // Fallback por ordem quando os ids não casam (api-sports costuma vir [home, away]).
  if (!homeEntry && !awayEntry) {
    homeEntry = response[0] ?? null;
    awayEntry = response[1] ?? null;
  } else {
    if (!homeEntry) homeEntry = response.find((e: any) => e !== awayEntry) ?? null;
    if (!awayEntry) awayEntry = response.find((e: any) => e !== homeEntry) ?? null;
  }

  const home = toStats(homeEntry?.statistics);
  const away = toStats(awayEntry?.statistics);
  if (home.length === 0 && away.length === 0) return null;

  return {
    apiSportsFixtureId: fixtureId,
    home,
    away,
    syncedAt: new Date().toISOString(),
  };
};

/**
 * Busca as estatísticas de um fixture via proxy /api/live-stats (api-sports) e
 * já normaliza para `LiveMatchStats`. Retorna `null` em qualquer erro/payload
 * vazio — dados puramente cosméticos, nunca quebram o sync (Guarda C/E).
 */
export const fetchLiveStats = async (
  fixtureId: number,
  homeApiId: number | null,
  awayApiId: number | null,
): Promise<LiveMatchStats | null> => {
  try {
    const response = await fetch(`/api/live-stats?fixture=${fixtureId}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      console.warn("[LIVE STATS] Resposta não-JSON do proxy.");
      return null;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn(
        `[LIVE STATS] Erro (${response.status}):`,
        (payload as any)?.message,
      );
      return null;
    }
    return parseLiveStats(payload, fixtureId, homeApiId, awayApiId);
  } catch (error) {
    console.warn("[LIVE STATS] Falha ao buscar /api/live-stats:", error);
    return null;
  }
};

