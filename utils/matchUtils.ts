import { Match, MatchDB, MatchStatus, TeamDB } from '../types';

/**
 * Normalizes a competition code to uppercase, defaulting to "WC".
 */
export const normalizeCompetitionCode = (value?: string): string =>
  (value || 'WC').toUpperCase();

/**
 * Determines whether a match is currently live.
 */
export const isMatchLive = (status: MatchStatus): boolean =>
  status === MatchStatus.LIVE ||
  status === MatchStatus.IN_PLAY ||
  status === MatchStatus.PAUSED;

/**
 * Determines whether a match has finished.
 */
export const isMatchFinished = (status: MatchStatus): boolean =>
  status === MatchStatus.FINISHED;

/**
 * Resolves the team ID of the shootout winner from a match score payload.
 * Returns undefined when the match did not go to a penalty shootout.
 */
export const resolveShootoutWinnerId = (
  score: any,
  homeTeamId?: string,
  awayTeamId?: string,
): string | undefined => {
  if (score?.duration !== 'PENALTY_SHOOTOUT') return undefined;
  return score?.winner === 'HOME_TEAM' ? homeTeamId : awayTeamId;
};

/**
 * Hydrates a raw MatchDB row into a Match by joining teams and
 * projecting the result. Returns null when teams are not found.
 */
export const hydrateMatchDB = (
  m: MatchDB,
  teams: TeamDB[],
): Match | null => {
  const homeTeam = teams.find((t) => t.id === m.homeTeamId);
  const awayTeam = teams.find((t) => t.id === m.awayTeamId);
  if (!homeTeam || !awayTeam) return null;

  return {
    ...m,
    homeTeam,
    awayTeam,
    status: m.status as MatchStatus,
    result:
      m.resultHome != null
        ? { home: m.resultHome, away: m.resultAway! }
        : undefined,
    score: m.score,
    penaltiesHome: m.penaltiesHome,
    penaltiesAway: m.penaltiesAway,
  } as Match;
};
