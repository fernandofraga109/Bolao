import { Match } from '../types';
import {
  calculatePoints,
  calculatePointsRegulamento2,
  getR1MatchScoringResult,
  getMatchPhase,
  type MatchPredictionContext,
} from './scoring';
import { resolveShootoutWinnerId } from './matchUtils';

interface PredictionInput {
  homeScore: number;
  awayScore: number;
  tieWinnerTeamId?: string;
}

interface CalculateMatchPointsOptions {
  pred: PredictionInput;
  match: Match;
  ruleset: 'regulamento_1' | 'regulamento_2';
  minRankDiff?: number;
  /** Required for regulamento_2 — all predictions for the same match in the group. */
  groupMatchPredictions?: MatchPredictionContext[];
  /** The user ID owning the prediction (required for regulamento_2 alone-bonus). */
  userId?: string;
}

/**
 * Unified scoring dispatcher that calculates points for a single
 * prediction against a match result, handling both rulesets.
 *
 * This replaces the duplicated if/else blocks across useLeaderboard,
 * usePointsProcessor, MatchCard, and UserAuditModal.
 */
export const calculateMatchPoints = ({
  pred,
  match,
  ruleset,
  minRankDiff = 0,
  groupMatchPredictions = [],
  userId = '',
}: CalculateMatchPointsOptions): number => {
  if (!match.result) return 0;

  if (ruleset === 'regulamento_2') {
    const phase = getMatchPhase(match.stage, match.group);
    return calculatePointsRegulamento2(
      pred.homeScore,
      pred.awayScore,
      match.result.home,
      match.result.away,
      phase,
      groupMatchPredictions,
      userId,
    );
  }

  // Regulamento 1
  const realWhoClassifiesId = resolveShootoutWinnerId(
    match.score,
    match.homeTeam?.id,
    match.awayTeam?.id,
  );
  const predWhoClassifiesId = pred.tieWinnerTeamId;
  const r1Result = getR1MatchScoringResult(
    match.score,
    match.result.home,
    match.result.away,
  );

  return calculatePoints(
    pred.homeScore,
    pred.awayScore,
    r1Result.home,
    r1Result.away,
    match.homeTeam?.ranking,
    match.awayTeam?.ranking,
    minRankDiff,
    predWhoClassifiesId,
    realWhoClassifiesId,
  );
};
