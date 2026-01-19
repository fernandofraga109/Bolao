
import { TournamentPredictionDB } from '../../types';

export const DB_TOURNAMENT_PREDICTIONS: TournamentPredictionDB[] = [
  // Carlos Silva (f1)
  { 
    userId: 'f1', 
    championTeamId: 'bra', 
    topScorerPlayer: 'Vinicius Jr', 
    topScorerGoals: 7,
    bestPlayer: 'Neymar', 
    bestGoalkeeper: 'Alisson'
  },

  // Ana Souza (f2)
  { 
    userId: 'f2', 
    championTeamId: 'fra', 
    topScorerPlayer: 'Mbappé', 
    topScorerGoals: 8,
    bestPlayer: 'Mbappé', 
    bestGoalkeeper: 'Maignan'
  },

  // Pedro Rocha (f3)
  { 
    userId: 'f3', 
    championTeamId: 'eng', 
    topScorerPlayer: 'Kane', 
    topScorerGoals: 6,
    bestPlayer: 'Bellingham', 
    bestGoalkeeper: 'Pickford'
  }
];
