import { useState, useMemo } from 'react';
import { Match, MatchStatus, TournamentPredictions } from '../types';
import { INITIAL_MATCHES, OFFICIAL_TOURNAMENT_RESULTS } from '../constants';

export const useMatchSystem = () => {
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [tournamentResults, setTournamentResults] = useState<TournamentPredictions | undefined>(OFFICIAL_TOURNAMENT_RESULTS);

  const simulateLiveGame = () => {
      const scheduledMatches = matches.filter(m => m.status === MatchStatus.SCHEDULED);
      if (scheduledMatches.length > 0) {
        const randomMatch = scheduledMatches[0];
        const simHome = Math.floor(Math.random() * 4);
        const simAway = Math.floor(Math.random() * 4);
        setMatches(prev => prev.map(m => {
            if (m.id === randomMatch.id) {
                return { ...m, status: MatchStatus.FINISHED, result: { home: simHome, away: simAway } };
            }
            return m;
        }));
      } else if (!tournamentResults) {
            alert("Simulando Fim da Copa: Resultados Especiais Liberados!");
            setTournamentResults({ 
                championTeamId: 'bra',
                topScorer: { player: 'Mbappé', goals: 8 },
                bestPlayer: 'Vini Jr',
                bestGoalkeeper: 'Alisson'
            });
      }
  };

  const updateMatchResult = (matchId: string, home: number, away: number) => {
    setMatches(prev => prev.map(m => {
        if (m.id === matchId) {
            return {
                ...m,
                status: MatchStatus.FINISHED,
                result: { home, away }
            };
        }
        return m;
    }));
  };

  const lockDate = useMemo(() => {
    const dates = matches.map(m => new Date(m.date).getTime());
    return new Date(Math.min(...dates));
  }, [matches]);

  return {
    matches,
    tournamentResults,
    lockDate,
    simulateLiveGame,
    updateMatchResult
  };
};