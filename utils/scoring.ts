
import { TournamentPredictions } from '../types';

export const POINTS_EXACT = 10;
export const POINTS_GOAL_DIFF = 7;
export const POINTS_OUTCOME = 5;
export const POINTS_WRONG = 0;

const UNDERDOG_BONUS_FACTOR = 0.25;
const MAX_UNDERDOG_BONUS = 5;
const MIN_RANK_DIFF_FOR_UNDERDOG = 10;

export const POINTS_TOP_SCORER_NAME = 100;
export const POINTS_TOP_SCORER_GOALS = 100;
export const POINTS_CHAMPION = 100;
export const POINTS_BEST_PLAYER = 100;
export const POINTS_BEST_GOALKEEPER = 100;

/**
 * Calculates the potential bonus points if the underdog wins.
 */
export const calculateUnderdogBonus = (
    winnerRank: number | undefined, 
    loserRank: number | undefined
): number => {
    if (!winnerRank || !loserRank) return 0;
    
    // If the winner has a worse ranking (higher number) than the loser, it's an underdog win.
    if (winnerRank > loserRank) {
        const diff = winnerRank - loserRank;
        if (diff <= MIN_RANK_DIFF_FOR_UNDERDOG) return 0;
        const calculatedBonus = Math.ceil(diff * UNDERDOG_BONUS_FACTOR);
        return Math.min(calculatedBonus, MAX_UNDERDOG_BONUS);
    }
    
    return 0;
};

export const calculatePoints = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  homeRank?: number,
  awayRank?: number
): number => {
  let points = 0;

  // 1. Exact score
  if (predHome === realHome && predAway === realAway) {
    points = POINTS_EXACT;
  } else {
    const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
    const realOutcome = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

    // 2. Correct Outcome
    if (predOutcome === realOutcome) {
      const predDiff = predHome - predAway;
      const realDiff = realHome - realAway;

      // 3. Correct Goal Difference
      if (predDiff === realDiff) {
        points = POINTS_GOAL_DIFF;
      } else {
        points = POINTS_OUTCOME;
      }
    }
  }

  // 4. Underdog Bonus
  if (points > 0 && homeRank && awayRank && realHome !== realAway) {
    const winnerRank = realHome > realAway ? homeRank : awayRank;
    const loserRank = realHome > realAway ? awayRank : homeRank;
    points += calculateUnderdogBonus(winnerRank, loserRank);
  }

  return points;
};

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

export const calculateTopScorerPoints = calculateTournamentPoints; 
