
import { TournamentPredictions } from '../types';

export const POINTS_EXACT = 10;
export const POINTS_GOAL_DIFF = 7;
export const POINTS_OUTCOME = 5;
export const POINTS_WRONG = 0;

// Factor for underdog bonus: (DiffInRank * FACTOR). 
// Example: Rank 15 vs Rank 1. Diff 14 * 0.25 = 3.5 -> 4 points bonus.
const UNDERDOG_BONUS_FACTOR = 0.25; 
// Maximum bonus points allowed for an underdog win
const MAX_UNDERDOG_BONUS = 5;

export const POINTS_TOP_SCORER_NAME = 100;
export const POINTS_TOP_SCORER_GOALS = 100;
export const POINTS_CHAMPION = 100;
export const POINTS_BEST_PLAYER = 100;
export const POINTS_BEST_GOALKEEPER = 100;

/**
 * Calculates the potential bonus points if the underdog wins.
 * Returns 0 if the winner is the favorite or ranks are missing.
 * Capped at MAX_UNDERDOG_BONUS (5).
 */
export const calculateUnderdogBonus = (
    winnerRank: number | undefined, 
    loserRank: number | undefined
): number => {
    if (!winnerRank || !loserRank) return 0;
    
    // If the winner has a worse ranking (higher number) than the loser, it's an underdog win.
    if (winnerRank > loserRank) {
        const diff = winnerRank - loserRank;
        const calculatedBonus = Math.ceil(diff * UNDERDOG_BONUS_FACTOR);
        // Apply the cap
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
  }
  // 2. Determine outcomes
  else {
      const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
      const realOutcome = realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

      // 3. Correct Outcome (Winner or Draw)
      if (predOutcome === realOutcome) {
        // Check Goal Difference
        const predDiff = predHome - predAway;
        const realDiff = realHome - realAway;

        if (predDiff === realDiff) {
            points = POINTS_GOAL_DIFF;
        } else {
            points = POINTS_OUTCOME;
        }
      }
  }

  // 4. Apply Underdog Bonus
  // Only applies if the user got ANY points (meaning they predicted the winner/draw correctly)
  // And it wasn't a draw (usually bonus implies picking a WINNER who is an underdog)
  if (points > 0 && homeRank && awayRank && realHome !== realAway) {
      const winnerRank = realHome > realAway ? homeRank : awayRank;
      const loserRank = realHome > realAway ? awayRank : homeRank;
      
      const bonus = calculateUnderdogBonus(winnerRank, loserRank);
      points += bonus;
  }

  return points;
};

export const calculateTournamentPoints = (
  prediction: TournamentPredictions | undefined,
  actual: TournamentPredictions | undefined
): number => {
  if (!prediction || !actual) return 0;

  let points = 0;
  
  // 1. Top Scorer Name
  if (prediction.topScorer?.player && actual.topScorer?.player) {
      if (prediction.topScorer.player.trim().toLowerCase() === actual.topScorer.player.trim().toLowerCase()) {
        points += POINTS_TOP_SCORER_NAME;
      }
  }

  // 2. Top Scorer Goals
  if (prediction.topScorer?.goals && actual.topScorer?.goals) {
      if (prediction.topScorer.goals === actual.topScorer.goals) {
        points += POINTS_TOP_SCORER_GOALS;
      }
  }

  // 3. Champion
  if (prediction.championTeamId && actual.championTeamId) {
      if (prediction.championTeamId === actual.championTeamId) {
          points += POINTS_CHAMPION;
      }
  }

  // 4. Best Player
  if (prediction.bestPlayer && actual.bestPlayer) {
      if (prediction.bestPlayer.trim().toLowerCase() === actual.bestPlayer.trim().toLowerCase()) {
          points += POINTS_BEST_PLAYER;
      }
  }

  // 5. Best Goalkeeper
  if (prediction.bestGoalkeeper && actual.bestGoalkeeper) {
      if (prediction.bestGoalkeeper.trim().toLowerCase() === actual.bestGoalkeeper.trim().toLowerCase()) {
          points += POINTS_BEST_GOALKEEPER;
      }
  }

  return points;
};

export const calculateTopScorerPoints = calculateTournamentPoints; // Backward compatibility alias if needed
