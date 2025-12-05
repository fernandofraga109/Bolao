import { TournamentPredictions } from '../types';

export const POINTS_EXACT = 10;
export const POINTS_GOAL_DIFF = 7;
export const POINTS_OUTCOME = 5;
export const POINTS_WRONG = 0;

export const POINTS_TOP_SCORER_NAME = 100;
export const POINTS_TOP_SCORER_GOALS = 100;
export const POINTS_CHAMPION = 100;
export const POINTS_BEST_PLAYER = 100;
export const POINTS_BEST_GOALKEEPER = 100;

export const calculatePoints = (
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number
): number => {
  // 1. Exact score
  if (predHome === realHome && predAway === realAway) {
    return POINTS_EXACT;
  }

  // 2. Determine outcomes
  const predOutcome =
    predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw';
  
  const realOutcome =
    realHome > realAway ? 'home' : realHome < realAway ? 'away' : 'draw';

  // 3. Correct Outcome (Winner or Draw)
  if (predOutcome === realOutcome) {
    // Check Goal Difference (New Rule)
    const predDiff = predHome - predAway;
    const realDiff = realHome - realAway;

    if (predDiff === realDiff) {
        return POINTS_GOAL_DIFF;
    }

    return POINTS_OUTCOME;
  }

  // 4. Incorrect
  return POINTS_WRONG;
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