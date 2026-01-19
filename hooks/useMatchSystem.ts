
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Match, MatchStatus, TournamentPredictions } from '../types';
import { useDatabase } from '../contexts/DatabaseContext';
import { fetchExternalMatches, findInternalMatch, mapExternalStatusToInternal } from '../services/liveScoreService';

export const useMatchSystem = () => {
  const db = useDatabase();
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Use DB config instead of local state
  const isAutoSyncEnabled = db.systemConfig.is_auto_sync_enabled;
  const syncInterval = db.systemConfig.sync_interval_ms;

  // Hydrate Matches (Join with Teams and Stadiums)
  const matches: Match[] = useMemo(() => {
      if (!db.matches) return []; // Safety check
      return db.matches.map(m => {
          const homeTeam = db.teams.find(t => t.id === m.homeTeamId);
          const awayTeam = db.teams.find(t => t.id === m.awayTeamId);
          const stadium = db.stadiums.find(s => s.id === m.stadiumId);

          if (!homeTeam || !awayTeam) return null; 

          return {
              id: m.id,
              homeTeam,
              awayTeam,
              date: m.date,
              group: m.group,
              location: stadium ? stadium.name : 'Unknown',
              stadiumId: m.stadiumId,
              status: m.status,
              result: (m.resultHome != null && m.resultAway != null) 
                ? { home: m.resultHome, away: m.resultAway } 
                : undefined
          };
      }).filter(Boolean) as Match[];
  }, [db.matches, db.teams, db.stadiums]);

  // Keep a ref to matches to access the latest state inside the interval closure/async operations
  const matchesRef = useRef(matches);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  // Mock Tournament Results logic
  const tournamentResults = useMemo<TournamentPredictions | undefined>(() => {
      const sys = db.tournamentPredictions.find(tp => tp.userId === 'SYSTEM_RESULTS');
      if (sys) {
          return {
              championTeamId: sys.championTeamId,
              topScorer: { player: sys.topScorerPlayer || '', goals: sys.topScorerGoals || 0 },
              bestPlayer: sys.bestPlayer,
              bestGoalkeeper: sys.bestGoalkeeper
          };
      }
      return undefined;
  }, [db.tournamentPredictions]);

  const simulateLiveGame = () => {
      const scheduledMatches = db.matches.filter(m => m.status === MatchStatus.SCHEDULED);
      if (scheduledMatches.length > 0) {
        const randomMatch = scheduledMatches[0];
        const simHome = Math.floor(Math.random() * 4);
        const simAway = Math.floor(Math.random() * 4);
        
        db.updateMatch(randomMatch.id, {
            status: MatchStatus.FINISHED,
            resultHome: simHome,
            resultAway: simAway
        });
      }
  };

  // --- SYNC EXTERNAL API ---
  const syncWithExternalApi = useCallback(async () => {
      // Prevent multiple overlapping calls
      if (isSyncing) return { success: false, message: 'Já está sincronizando.' };
      
      setIsSyncing(true);
      try {
          const externalMatches = await fetchExternalMatches();
          if (externalMatches.length === 0) {
              console.log("Nenhum jogo retornado pela API externa (ou token inválido/rate limit).");
              setIsSyncing(false);
              return { success: false, message: 'Sem dados da API.' };
          }

          let updatedCount = 0;
          
          // Use matchesRef.current to ensure we are comparing against the latest state
          const currentMatches = matchesRef.current;

          for (const extMatch of externalMatches) {
              const internalMatch = findInternalMatch(extMatch, currentMatches);
              
              if (internalMatch) {
                  const newStatus = mapExternalStatusToInternal(extMatch.status);
                  
                  // Safe access to scores with optional chaining
                  const extHome = extMatch.score?.fullTime?.home;
                  const extAway = extMatch.score?.fullTime?.away;

                  // Atualiza apenas se mudou status ou placar
                  const currentHome = internalMatch.result?.home;
                  const currentAway = internalMatch.result?.away;

                  const scoreChanged = 
                      (extHome != null && currentHome !== extHome) || 
                      (extAway != null && currentAway !== extAway);
                  
                  const statusChanged = internalMatch.status !== newStatus;

                  if (scoreChanged || statusChanged) {
                       await db.updateMatch(internalMatch.id, {
                           status: newStatus,
                           // Use null coalescing to ensure undefined if null, or the value
                           resultHome: extHome ?? undefined,
                           resultAway: extAway ?? undefined
                       });
                       updatedCount++;
                  }
              }
          }
          setIsSyncing(false);
          return { success: true, message: `${updatedCount} jogos atualizados.` };

      } catch (error) {
          console.error("Erro no Sync:", error);
          setIsSyncing(false);
          return { success: false, message: 'Erro ao conectar na API.' };
      }
  }, [db, isSyncing]); 

  // --- AUTO SYNC POLLING EFFECT ---
  useEffect(() => {
    let intervalId: any;

    if (isAutoSyncEnabled) {
      console.log(`🔄 Auto-Sync ATIVO via Banco de Dados. Intervalo: ${syncInterval}ms`);
      // Run immediately
      syncWithExternalApi();
      
      intervalId = setInterval(() => {
        console.log("🔄 Auto-Sync: Buscando atualizações...");
        syncWithExternalApi();
      }, syncInterval || 60000);
    } else {
        console.log("⏹️ Auto-Sync PARADO (Configuração Global)");
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isAutoSyncEnabled, syncInterval, syncWithExternalApi]);

  const toggleAutoSync = () => {
      // Now toggles DB Value
      db.updateSystemConfig({ is_auto_sync_enabled: !isAutoSyncEnabled });
  };

  // --- ADMIN LIVE CONTROLS ---

  const startMatch = (matchId: string) => {
    db.updateMatch(matchId, {
        status: MatchStatus.LIVE,
        resultHome: 0,
        resultAway: 0
    });
  };

  const updateLiveScore = (matchId: string, home: number, away: number) => {
      // Keeps status as LIVE, just updates score
      db.updateMatch(matchId, {
          resultHome: home,
          resultAway: away
      });
  };

  const finishMatch = (matchId: string, home: number, away: number) => {
    db.updateMatch(matchId, {
        status: MatchStatus.FINISHED,
        resultHome: home,
        resultAway: away
    });
  };

  const lockDate = useMemo(() => {
    if (matches.length === 0) return new Date();
    const dates = matches.map(m => new Date(m.date).getTime());
    return new Date(Math.min(...dates));
  }, [matches]);

  return {
    matches,
    tournamentResults,
    lockDate,
    simulateLiveGame,
    syncWithExternalApi,
    isSyncing,
    isAutoSyncEnabled,
    toggleAutoSync,
    adminControls: {
        startMatch,
        updateLiveScore,
        finishMatch
    }
  };
};
