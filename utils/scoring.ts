import { TournamentPredictions } from '../types';

export const POINTS_EXACT = 10;
export const POINTS_GOAL_DIFF = 7;
export const POINTS_OUTCOME = 5;
export const POINTS_WRONG = 0;
export const POINTS_CLASSIFIES_BONUS = 3;

const UNDERDOG_BONUS_FACTOR = 0.03;
const MAX_UNDERDOG_BONUS = 5;
const FALLBACK_MIN_RANK_DIFF = 0;

export const POINTS_TOP_SCORER_NAME = 100;
export const POINTS_TOP_SCORER_GOALS = 100;
export const POINTS_CHAMPION = 100;
export const POINTS_BEST_PLAYER = 100;
export const POINTS_BEST_GOALKEEPER = 100;

export type MatchPhase = 'groups' | 'ko' | 'third_place' | 'final';

/**
 * Maps a match stage and group to the corresponding tournament phase.
 */
export const getMatchPhase = (stage?: string, group?: string): MatchPhase => {
  const s = (stage || '').toUpperCase();
  const g = (group || '').toUpperCase();

  if (
    s.includes('FINAL') &&
    !s.includes('SEMI') &&
    !s.includes('QUARTER') &&
    !s.includes('ROUND_OF_16') &&
    !s.includes('THIRD')
  ) {
    return 'final';
  }
  if (s.includes('THIRD') || g.includes('TERCEIRO') || g.includes('3º') || g.includes('3O')) {
    return 'third_place';
  }
  if (
    s.includes('ROUND_OF_16') ||
    s.includes('QUARTER') ||
    s.includes('SEMI') ||
    g.includes('OITAVAS') ||
    g.includes('QUARTAS') ||
    g.includes('SEMI')
  ) {
    return 'ko';
  }
  return 'groups';
};

/**
 * Calculates the potential bonus points if the underdog wins.
 */
export const calculateUnderdogBonus = (
  winnerRank: number | undefined,
  loserRank: number | undefined,
  minRankDiff = FALLBACK_MIN_RANK_DIFF
): number => {
  if (!winnerRank || !loserRank) return 0;

  if (winnerRank > loserRank) {
    const diff = winnerRank - loserRank;
    if (diff <= minRankDiff) return 0;
    const calculatedBonus = Math.floor(diff * UNDERDOG_BONUS_FACTOR);
    return Math.min(calculatedBonus, MAX_UNDERDOG_BONUS);
  }

  return 0;
};

/**
 * REGULAMENTO 1 (Default): Stateless single-prediction points calculator
 */
export const calculatePoints = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  homeRank?: number,
  awayRank?: number,
  minRankDiff = FALLBACK_MIN_RANK_DIFF,
  predWhoClassifiesId?: string,
  realWhoClassifiesId?: string
): number => {
  const cat = getScoreCategoryRegulamento1(predHome, predAway, realHome, realAway, homeRank, awayRank, minRankDiff, predWhoClassifiesId, realWhoClassifiesId);

  if (cat.type === 'exact') return POINTS_EXACT + cat.underdogBonus + cat.classifiesBonus;
  if (cat.type === 'diff') return POINTS_GOAL_DIFF + cat.underdogBonus + cat.classifiesBonus;
  if (cat.type === 'outcome') return POINTS_OUTCOME + cat.underdogBonus + cat.classifiesBonus;
  return POINTS_WRONG;
};

export interface MatchPredictionContext {
  userId: string;
  homeScore: number;
  awayScore: number;
}

export interface ScoreCategoryR1 {
  type: 'exact' | 'diff' | 'outcome' | 'wrong';
  underdogBonus: number;
  classifiesBonus: number;
}

export interface ScoreCategoryR2 {
  type: 'exact' | 'diff' | 'outcome' | 'wrong';
  aloneBonus: boolean;
  classifiesBonus: number;
}

/**
 * REGULAMENTO 1: Returns the score category and underdog bonus without computing total points.
 * predWhoClassifiesId / realWhoClassifiesId: team IDs for who advances (R1, knockout draws).
 * classifiesBonus (+3) is only applied when:
 *   - The predicted score is a draw (predHome === predAway)
 *   - The real result resolves via PENALTY_SHOOTOUT (realWhoClassifiesId is provided)
 *   - The user's predicted team to advance matches the real one
 */
export const getScoreCategoryRegulamento1 = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  homeRank?: number,
  awayRank?: number,
  minRankDiff = FALLBACK_MIN_RANK_DIFF,
  predWhoClassifiesId?: string,
  realWhoClassifiesId?: string
): ScoreCategoryR1 => {
  const isExact = predHome === realHome && predAway === realAway;

  const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
  const realOutcome = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

  let underdogBonus = 0;
  if (realHome !== realAway && homeRank && awayRank) {
    const winnerRank = realHome > realAway ? homeRank : awayRank;
    const loserRank = realHome > realAway ? awayRank : homeRank;
    underdogBonus = calculateUnderdogBonus(winnerRank, loserRank, minRankDiff);
  }

  // classifiesBonus: only when pred is draw AND real game went to shootout
  const predIsDraw = predHome === predAway;
  const classifiesBonus =
    predIsDraw &&
    !!predWhoClassifiesId &&
    !!realWhoClassifiesId &&
    predWhoClassifiesId === realWhoClassifiesId
      ? POINTS_CLASSIFIES_BONUS
      : 0;

  if (isExact) {
    return { type: 'exact', underdogBonus, classifiesBonus };
  }

  if (predOutcome === realOutcome) {
    // Rule 3: no diff bonus when real result is a draw
    if (realHome === realAway) {
      return { type: 'outcome', underdogBonus, classifiesBonus };
    }
    const predDiff = predHome - predAway;
    const realDiff = realHome - realAway;
    if (predDiff === realDiff) {
      return { type: 'diff', underdogBonus, classifiesBonus };
    }
    return { type: 'outcome', underdogBonus, classifiesBonus };
  }

  return { type: 'wrong', underdogBonus: 0, classifiesBonus: 0 };
};

/**
 * REGULAMENTO 2: Returns the score category and alone-bonus flag without computing total points.
 */
export const getScoreCategoryRegulamento2 = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  phase: MatchPhase,
  matchPredictions: MatchPredictionContext[],
  currentUserId: string,
  predWhoClassifiesId?: string,
  realWhoClassifiesId?: string
): ScoreCategoryR2 => {
  const isExact = predHome === realHome && predAway === realAway;
  const isRealDraw = realHome === realAway;
  const isOutcomeCorrect =
    (realHome > realAway && predHome > predAway) ||
    (realHome < realAway && predHome < predAway) ||
    (realHome === realAway && predHome === predAway);

  const realDiff = realHome - realAway;
  const predDiff = predHome - predAway;
  const isDiffCorrect = realDiff === predDiff;

  const predIsDraw = predHome === predAway;
  const classifiesBonus =
    predIsDraw &&
    !!predWhoClassifiesId &&
    !!realWhoClassifiesId &&
    predWhoClassifiesId === realWhoClassifiesId
      ? POINTS_CLASSIFIES_BONUS
      : 0;

  if (isExact) {
    const exactHits = matchPredictions.filter(
      (p) => p.homeScore === realHome && p.awayScore === realAway
    );
    const aloneBonus = exactHits.length === 1 && exactHits[0].userId === currentUserId;
    return { type: 'exact', aloneBonus, classifiesBonus };
  }

  if (isOutcomeCorrect) {
    if (isRealDraw) {
      return { type: 'outcome', aloneBonus: false, classifiesBonus };
    } else if (isDiffCorrect) {
      return { type: 'diff', aloneBonus: false, classifiesBonus };
    } else {
      return { type: 'outcome', aloneBonus: false, classifiesBonus };
    }
  }

  return { type: 'wrong', aloneBonus: false, classifiesBonus: 0 };
};

/**
 * REGULAMENTO 2: State-aware prediction points calculator (with Placar Sozinho +5 bonus)
 */
export const calculatePointsRegulamento2 = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  phase: MatchPhase,
  matchPredictions: MatchPredictionContext[],
  currentUserId: string,
  predWhoClassifiesId?: string,
  realWhoClassifiesId?: string
): number => {
  const cat = getScoreCategoryRegulamento2(predHome, predAway, realHome, realAway, phase, matchPredictions, currentUserId, predWhoClassifiesId, realWhoClassifiesId);

  let pointsExact = 15;
  let pointsDiff = 13;
  let pointsOutcome = 10;

  if (phase === 'third_place') {
    pointsExact = 17;
    pointsDiff = 15;
    pointsOutcome = 12;
  } else if (phase === 'final') {
    pointsExact = 22;
    pointsDiff = 19;
    pointsOutcome = 16;
  }

  if (cat.type === 'exact') {
    return pointsExact + (cat.aloneBonus ? 5 : 0) + cat.classifiesBonus;
  }
  if (cat.type === 'diff') {
    return pointsDiff + cat.classifiesBonus;
  }
  if (cat.type === 'outcome') {
    return pointsOutcome + cat.classifiesBonus;
  }
  return 0;
};

/**
 * REGULAMENTO 1 (Default): Stateless tournament predictions calculator
 */
export const calculateTournamentPoints = (
  prediction: TournamentPredictions | undefined,
  actual: TournamentPredictions | undefined
): number => {
  if (!prediction || !actual) return 0;

  let points = 0;

  if (prediction.topScorer?.player && actual.topScorer?.player) {
    if (prediction.topScorer.player.trim().toLowerCase() === actual.topScorer.player.trim().toLowerCase()) {
      points += POINTS_TOP_SCORER_NAME;
    }
  }

  if (prediction.topScorer?.goals && actual.topScorer?.goals) {
    if (prediction.topScorer.goals === actual.topScorer.goals) {
      points += POINTS_TOP_SCORER_GOALS;
    }
  }

  if (prediction.championTeamId && actual.championTeamId) {
    if (prediction.championTeamId === actual.championTeamId) {
      points += POINTS_CHAMPION;
    }
  }

  if (prediction.bestPlayer && actual.bestPlayer) {
    if (prediction.bestPlayer.trim().toLowerCase() === actual.bestPlayer.trim().toLowerCase()) {
      points += POINTS_BEST_PLAYER;
    }
  }

  if (prediction.bestGoalkeeper && actual.bestGoalkeeper) {
    if (prediction.bestGoalkeeper.trim().toLowerCase() === actual.bestGoalkeeper.trim().toLowerCase()) {
      points += POINTS_BEST_GOALKEEPER;
    }
  }

  return points;
};

export interface TournamentPredictionContext {
  userId: string;
  championTeamId?: string;
  topScorerPlayer?: string;
}

/**
 * REGULAMENTO 2: State-aware tournament predictions calculator (Champion/Top Scorer divided scoring)
 */
export const calculateTournamentPointsRegulamento2 = (
  prediction: TournamentPredictions | undefined,
  actual: TournamentPredictions | undefined,
  allGroupPredictions: TournamentPredictionContext[],
  currentUserId: string
): number => {
  if (!prediction || !actual) return 0;

  let points = 0;

  // 1. Champion points
  if (prediction.championTeamId && actual.championTeamId) {
    if (prediction.championTeamId === actual.championTeamId) {
      const correctChampionUsers = allGroupPredictions.filter(
        (p) => p.championTeamId === actual.championTeamId
      );
      const count = correctChampionUsers.length;
      if (count === 1) {
        points += 100;
      } else if (count === 2) {
        points += 70;
      } else if (count === 3) {
        points += 50;
      } else if (count >= 4) {
        points += 40;
      }
    }
  }

  // 2. Top Scorer points
  if (prediction.topScorer?.player && actual.topScorer?.player) {
    const predPlayer = prediction.topScorer.player.trim().toLowerCase();
    const actualPlayer = actual.topScorer.player.trim().toLowerCase();

    if (predPlayer === actualPlayer) {
      const correctScorerUsers = allGroupPredictions.filter(
        (p) => p.topScorerPlayer && p.topScorerPlayer.trim().toLowerCase() === actualPlayer
      );
      const count = correctScorerUsers.length;
      if (count === 1) {
        points += 60;
      } else if (count === 2) {
        points += 40;
      } else if (count === 3) {
        points += 30;
      } else if (count >= 4) {
        points += 25;
      }
    }
  }

  // 3. Pre-cup Extra predictions (Team with most goals / conceded)
  if (prediction.mostGoalsTeamId && actual.mostGoalsTeamId) {
    if (prediction.mostGoalsTeamId === actual.mostGoalsTeamId) {
      points += 20;
    }
  }

  if (prediction.mostConcededTeamId && actual.mostConcededTeamId) {
    if (prediction.mostConcededTeamId === actual.mostConcededTeamId) {
      points += 20;
    }
  }

  // 4. Group classifications & Knockout qualifiers points: 10 points per correct group team, 5 points per correct knockout team
  if (prediction.groupClassifications && actual.groupClassifications) {
    Object.entries(prediction.groupClassifications).forEach(([groupName, predTeams]) => {
      const actualTeams = actual.groupClassifications?.[groupName];
      if (actualTeams && Array.isArray(predTeams) && Array.isArray(actualTeams)) {
        const validPreds = predTeams.filter(Boolean);
        validPreds.forEach((teamId) => {
          if (actualTeams.includes(teamId)) {
            const isKnockout = ["Oitavas", "Quartas", "Semis"].includes(groupName);
            points += isKnockout ? 5 : 10;
          }
        });
      }
    });
  }

  return points;
};

/**
 * R1 scoring base: regularTime only (not regularTime + extraTime).
 * Prefers flat columns (regularHome/Away); falls back to score JSONB for older rows.
 */
export const getR1MatchScoringResult = (
  match: { regularHome?: number | null; regularAway?: number | null; extraTimeHome?: number | null; penaltiesHome?: number | null; score?: any },
  fallbackHome: number,
  fallbackAway: number
): { home: number; away: number } => {
  if (match.regularHome != null && match.regularAway != null) {
    return { home: match.regularHome, away: match.regularAway };
  }
  // JSONB backward compat for rows not yet synced with flat cols
  const duration = match.score?.duration;
  if (duration === "EXTRA_TIME" || duration === "PENALTY_SHOOTOUT") {
    return {
      home: match.score?.regularTime?.home ?? fallbackHome,
      away: match.score?.regularTime?.away ?? fallbackAway,
    };
  }
  return { home: fallbackHome, away: fallbackAway };
};

/**
 * Infers match duration from flat columns.
 * Falls back to score JSONB for rows not yet synced.
 */
export const getMatchDuration = (
  match: { extraTimeHome?: number | null; penaltiesHome?: number | null; score?: any }
): 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' => {
  if (match.penaltiesHome != null) return 'PENALTY_SHOOTOUT';
  if (match.extraTimeHome != null) return 'EXTRA_TIME';
  return match.score?.duration ?? 'REGULAR';
};

/**
 * Returns the id of the team that advanced through the knockout tiebreaker.
 * Covers both EXTRA_TIME (winner from result) and PENALTY_SHOOTOUT (winner from penalties).
 * Returns undefined for REGULAR matches — no tiebreaker, whoClassifiesTeamId bonus not applicable.
 */
export const getKnockoutAdvancingTeamId = (
  match: {
    extraTimeHome?: number | null;
    penaltiesHome?: number | null;
    penaltiesAway?: number | null;
    result?: { home: number; away: number } | null;
    homeTeam?: { id: string } | null;
    awayTeam?: { id: string } | null;
    score?: any;
  }
): string | undefined => {
  const duration = getMatchDuration(match);

  if (duration === 'PENALTY_SHOOTOUT') {
    if (match.penaltiesHome != null && match.penaltiesAway != null) {
      return match.penaltiesHome > match.penaltiesAway ? match.homeTeam?.id : match.awayTeam?.id;
    }
    // JSONB backward compat
    return match.score?.winner === 'HOME_TEAM' ? match.homeTeam?.id : match.awayTeam?.id;
  }

  if (duration === 'EXTRA_TIME' && match.result) {
    return match.result.home > match.result.away ? match.homeTeam?.id : match.awayTeam?.id;
  }

  return undefined;
};

export interface PhaseMatchContext {
  id: string;
  resultHome?: number | null;
  resultAway?: number | null;
  status: string;
}

/**
 * REGULAMENTO 2: Phase extra prediction points calculator (match with biggest goal diff per phase)
 * adminOverrideMatchId: if admin manually set the correct match, use it directly (precedence over computed)
 */
export const calculateExtraPhasePoints = (
  userPrediction: { phase: string; matchId?: string } | undefined,
  phaseMatches: PhaseMatchContext[],
  adminOverrideMatchId?: string
): number => {
  if (!userPrediction || !userPrediction.matchId) return 0;

  // Admin override: if the admin set the correct match for this phase, use it directly
  if (adminOverrideMatchId) {
    return userPrediction.matchId === adminOverrideMatchId ? 20 : 0;
  }

  const finishedMatches = phaseMatches.filter(
    (m) => m.status === 'FINISHED' && m.resultHome != null && m.resultAway != null
  );
  if (finishedMatches.length === 0) return 0;

  let maxDiff = -1;
  const matchDiffs = finishedMatches.map((m) => {
    const diff = Math.abs((m.resultHome ?? 0) - (m.resultAway ?? 0));
    if (diff > maxDiff) maxDiff = diff;
    return { id: m.id, diff };
  });

  if (maxDiff < 0) return 0;

  const correctMatchIds = matchDiffs
    .filter((md) => md.diff === maxDiff)
    .map((md) => md.id);

  if (correctMatchIds.includes(userPrediction.matchId)) {
    return 20; // 20 points for correct guess
  }

  return 0;
};

export const calculateTopScorerPoints = calculateTournamentPoints;
