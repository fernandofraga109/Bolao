import { useCallback } from "react";
import { Match, MatchDB, MatchStatus } from "../types";
import {
  calculatePoints,
  calculatePointsRegulamento2,
  calculateTournamentPoints,
  calculateTournamentPointsRegulamento2,
  calculateExtraPhasePoints,
  getMatchPhase,
  TournamentPredictions
} from "../utils/scoring";
import { supabase } from "../services/supabase";

export const usePointsProcessor = (dbRef: any) => {
  const recalculateUserGroupPoints = useCallback(async (groupIds: string[]) => {
    if (!groupIds || groupIds.length === 0) return;
    const uniqueGroupIds = Array.from(new Set(groupIds));
    console.log(`🔄 Iniciando recálculo in-memory para ${uniqueGroupIds.length} grupos:`, uniqueGroupIds);

    // Fetch fresh matches from database to guarantee we aren't using stale React state
    // during asynchronous sync operations
    const { data: dbMatches, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .eq("status", "FINISHED");

    const rawMatches = matchesError ? (dbRef.current.matches as MatchDB[]) : (dbMatches as MatchDB[]);
    const teams = dbRef.current.teams as any[];
    const finishedMatchesMap = new Map<string, Match>();
    rawMatches.forEach(m => {
      if (m.status === MatchStatus.FINISHED && m.resultHome != null && m.resultAway != null) {
        finishedMatchesMap.set(m.id, {
          ...m,
          homeTeam: teams.find((t: any) => t.id === m.homeTeamId),
          awayTeam: teams.find((t: any) => t.id === m.awayTeamId),
          result: { home: m.resultHome, away: m.resultAway },
        } as Match);
      }
    });

    for (const groupId of uniqueGroupIds) {
      // Resolve effective underdog threshold for this group
      const allGroups = dbRef.current.groups as any[];
      const group = allGroups.find((g: any) => g.id === groupId);
      const isRegulamento2 = group?.ruleset === 'regulamento_2';

      const globalMinRankDiff: number =
        dbRef.current.systemConfig?.underdog_min_rank_diff ?? 10;
      const effectiveMinRankDiff: number =
        group?.underdog_min_rank_diff ?? globalMinRankDiff;

      // 1. Fetch all predictions for the group from the DB (always fresh — never local state)
      const { data: preds, error } = await supabase
        .from("predictions")
        .select("userId, matchId, groupId, homeScore, awayScore, points, timestamp")
        .eq("groupId", groupId);

      if (error) {
        console.error(`❌ Erro ao buscar predições do grupo ${groupId}:`, error);
        continue;
      }

      // 2. Fetch tournament predictions for the group
      const { data: tournPreds, error: tournError } = await supabase
        .from("tournament_predictions")
        .select("*")
        .eq("groupId", groupId);

      if (tournError) {
        console.error(`❌ Erro ao buscar predições do torneio do grupo ${groupId}:`, tournError);
      }

      // 3. Fetch extra phase predictions for the group (only for Regulamento 2)
      let extraPhasePreds: any[] = [];
      if (isRegulamento2) {
        const { data: epPreds, error: epError } = await supabase
          .from("extra_phase_predictions")
          .select("*")
          .eq("groupId", groupId);
        
        if (epError) {
          console.error(`❌ Erro ao buscar palpites extras de fase do grupo ${groupId}:`, epError);
        } else if (epPreds) {
          extraPhasePreds = epPreds;
        }
      }

      // 4. Fetch the current competition's actual results
      const compCode = group?.competitionCode || "WC";
      const { data: compData } = await supabase
        .from("competitions")
        .select("*")
        .eq("code", compCode)
        .single();
      
      const tournamentResults: TournamentPredictions | null = compData
        ? {
            championTeamId: compData.championTeamId || undefined,
            topScorer: compData.topScorerName
              ? { player: compData.topScorerName, goals: compData.topScorerGoals || 0 }
              : undefined,
            bestPlayer: compData.bestPlayerName || undefined,
            bestGoalkeeper: compData.bestGoalkeeperName || undefined,
            mostGoalsTeamId: compData.mostGoalsTeamId || undefined,
            mostConcededTeamId: compData.mostConcededTeamId || undefined,
          }
        : null;

      // 5. Calculate total points per user and track which predictions need their points column updated
      const pointsByUser: Record<string, number> = {};
      const predPointsUpdates: Array<{
        userId: string; matchId: string; groupId: string;
        homeScore: number; awayScore: number; points: number;
      }> = [];

      // Build group matches context map for placar isolado checks
      const matchPredictionsMap = new Map<string, Array<{ userId: string; homeScore: number; awayScore: number }>>();
      (preds || []).forEach((p) => {
        const item = { userId: p.userId, homeScore: p.homeScore, awayScore: p.awayScore };
        const existing = matchPredictionsMap.get(p.matchId) || [];
        existing.push(item);
        matchPredictionsMap.set(p.matchId, existing);
      });

      (preds || []).forEach((p) => {
        if (!pointsByUser[p.userId]) pointsByUser[p.userId] = 0;

        const match = finishedMatchesMap.get(p.matchId);
        if (match) {
          let pts = 0;
          if (isRegulamento2) {
            const phase = getMatchPhase(match.stage, match.group);
            const matchPredictionsGroup = matchPredictionsMap.get(p.matchId) || [];
            pts = calculatePointsRegulamento2(
              p.homeScore,
              p.awayScore,
              match.result?.home ?? 0,
              match.result?.away ?? 0,
              phase,
              matchPredictionsGroup,
              p.userId
            );

          } else {
            pts = calculatePoints(
              p.homeScore,
              p.awayScore,
              match.result?.home ?? 0,
              match.result?.away ?? 0,
              match.homeTeam?.ranking,
              match.awayTeam?.ranking,
              effectiveMinRankDiff
            );
          }

          pointsByUser[p.userId] += pts;
          if (p.points !== pts) {
            predPointsUpdates.push({
              userId: p.userId, matchId: p.matchId, groupId: p.groupId,
              homeScore: p.homeScore, awayScore: p.awayScore, points: pts,
            });
          }
        }
      });

      // 6. Calculate and add tournament predictions points
      if (tournamentResults) {
        if (isRegulamento2) {
          const groupTournPreds = (tournPreds || []).map((tp) => ({
            userId: tp.userId,
            championTeamId: tp.championTeamId || undefined,
            topScorerPlayer: tp.topScorerPlayer || undefined,
          }));

          (tournPreds || []).forEach((tp) => {
            if (!pointsByUser[tp.userId]) pointsByUser[tp.userId] = 0;
            const predTourn: TournamentPredictions = {
              championTeamId: tp.championTeamId || undefined,
              topScorer: tp.topScorerPlayer
                ? { player: tp.topScorerPlayer, goals: tp.topScorerGoals || 0 }
                : undefined,
              bestPlayer: tp.bestPlayer || undefined,
              bestGoalkeeper: tp.bestGoalkeeper || undefined,
              mostGoalsTeamId: tp.mostGoalsTeamId || undefined,
              mostConcededTeamId: tp.mostConcededTeamId || undefined,
              groupClassifications: tp.groupClassifications || undefined,
            };

            const pts = calculateTournamentPointsRegulamento2(
              predTourn,
              tournamentResults,
              groupTournPreds,
              tp.userId
            );
            if (pts > 0) {
              console.log(`🏆 Pontos de Torneio (Regulamento 2) para ${tp.userId}: +${pts}`);
              pointsByUser[tp.userId] += pts;
            }
          });
        } else {
          // Regulamento 1: Stateless tournament points
          (tournPreds || []).forEach((tp) => {
            if (!pointsByUser[tp.userId]) pointsByUser[tp.userId] = 0;
            const predTourn: TournamentPredictions = {
              championTeamId: tp.championTeamId || undefined,
              topScorer: tp.topScorerPlayer
                ? { player: tp.topScorerPlayer, goals: tp.topScorerGoals || 0 }
                : undefined,
              bestPlayer: tp.bestPlayer || undefined,
              bestGoalkeeper: tp.bestGoalkeeper || undefined,
            };

            const pts = calculateTournamentPoints(predTourn, tournamentResults);
            if (pts > 0) {
              pointsByUser[tp.userId] += pts;
            }
          });
        }
      }

      // 7. Calculate and add extra phase predictions points (only for Regulamento 2)
      if (isRegulamento2 && extraPhasePreds.length > 0) {
        // Hydrate all phase matches
        const phaseMatches = rawMatches.map((m) => ({
          id: m.id,
          resultHome: m.resultHome,
          resultAway: m.resultAway,
          status: m.status,
          stage: m.stage,
          group: m.group,
        }));

        extraPhasePreds.forEach((ep) => {
          if (!pointsByUser[ep.userId]) pointsByUser[ep.userId] = 0;

          // Filter matches belonging to this phase
          const epPhase = ep.phase; // e.g. 'groups', 'oitavas', 'quartas', 'semi'
          const phaseMatchesFiltered = phaseMatches.filter((m) => {
            const phaseMapped = getMatchPhase(m.stage, m.group);
            return phaseMapped === epPhase;
          });

          const pts = calculateExtraPhasePoints(
            { phase: ep.phase, matchId: ep.matchId || undefined },
            phaseMatchesFiltered
          );

          if (pts > 0) {
            console.log(`⚡ Pontos de Palpite Extra da Fase ${ep.phase} para ${ep.userId}: +${pts}`);
            pointsByUser[ep.userId] += pts;
          }
        });
      }

      // 8. Buscamos os membros atuais para preservar metadados
      const { data: members, error: ugError } = await supabase
        .from("user_groups")
        .select("userId, groupId, role, joinedAt")
        .eq("groupId", groupId);

      if (ugError) {
        console.error(`❌ Erro ao buscar membros do grupo ${groupId}:`, ugError);
        continue;
      }

      if (!preds || preds.length === 0) {
        const existingMembers = (dbRef.current.userGroups as any[]).filter(
          (ug: any) => ug.groupId === groupId
        );
        const hasExistingPoints = existingMembers.some((m: any) => (m.points ?? 0) > 0);
        if (hasExistingPoints) {
          console.warn(`⚠️ Empty predictions for group ${groupId} with existing points — skipping update`);
          continue;
        }
      }

      if (members && members.length > 0) {
        const finalUpdates = members.map((u) => ({
          ...u,
          points: pointsByUser[u.userId] || 0,
        }));

        console.log(`📤 Enviando classificação atualizada para o grupo ${groupId} (${finalUpdates.length} usuários)`);

        const { error: upsertError } = await supabase
          .from("user_groups")
          .upsert(finalUpdates, { onConflict: "userId,groupId" });

        if (upsertError) {
          console.error(`❌ Erro ao atualizar pontos do grupo ${groupId}:`, upsertError);
        } else {
          dbRef.current.updateLocalUserGroups(finalUpdates);
          console.log(`✨ Classificação sincronizada com sucesso para o grupo ${groupId}`);
        }
      }

      // 9. Persist calculated points back to predictions.points in the DB.
      if (predPointsUpdates.length > 0) {
        const { error: predError } = await supabase
          .from("predictions")
          .upsert(predPointsUpdates, { onConflict: '"userId", "matchId", "groupId"' });
        if (predError) {
          console.error(`❌ Error updating prediction points for group ${groupId}:`, predError);
        } else {
          console.log(`✓ Updated points column for ${predPointsUpdates.length} predictions in group ${groupId}`);
        }
      }
    }

    // Refresh predictions in local state so the UI reflects any
    // predictions that were inserted directly in the DB (bypassing Realtime).
    await dbRef.current.refetchPredictions();
  }, [dbRef]);

  const batchProcessPointsForMatches = useCallback(
    async (finishedMatches: Match[]) => {
      if (finishedMatches.length === 0) return;

      const updatesToUpsert: any[] = [];

      for (const match of finishedMatches) {
        const matchPredictions = dbRef.current.predictions.filter(
          (p: any) => p.matchId === match.id,
        );

        for (const pred of matchPredictions) {
          const allGroups = dbRef.current.groups as any[];
          const predGroup = allGroups.find((g: any) => g.id === pred.groupId);
          const isRegulamento2 = predGroup?.ruleset === 'regulamento_2';

          const globalMinRankDiff: number =
            dbRef.current.systemConfig?.underdog_min_rank_diff ?? 10;
          const effectiveMinRankDiff: number =
            predGroup?.underdog_min_rank_diff ?? globalMinRankDiff;

          let pts = 0;
          if (isRegulamento2) {
            const phase = getMatchPhase(match.stage, match.group);
            const matchPredictionsGroup = matchPredictions
              .filter((p: any) => p.groupId === pred.groupId)
              .map((p: any) => ({
                userId: p.userId,
                homeScore: p.homeScore,
                awayScore: p.awayScore,
              }));

            pts = calculatePointsRegulamento2(
              pred.homeScore,
              pred.awayScore,
              match.result?.home || 0,
              match.result?.away || 0,
              phase,
              matchPredictionsGroup,
              pred.userId
            );
          } else {
            pts = calculatePoints(
              pred.homeScore,
              pred.awayScore,
              match.result?.home || 0,
              match.result?.away || 0,
              match.homeTeam.ranking,
              match.awayTeam.ranking,
              effectiveMinRankDiff,
            );
          }

          if (pred.points !== pts) {
            updatesToUpsert.push({
              userId: pred.userId,
              matchId: pred.matchId,
              groupId: pred.groupId,
              homeScore: pred.homeScore,
              awayScore: pred.awayScore,
              points: pts,
              timestamp: pred.timestamp || new Date().toISOString(),
            });
          }
        }
      }

      if (updatesToUpsert.length > 0) {
        console.log(`📦 Processando pontos para ${updatesToUpsert.length} palpites...`);
        const groupIdsToRecalculate = Array.from(
          new Set(updatesToUpsert.map((u) => u.groupId).filter(Boolean)),
        );
        if (groupIdsToRecalculate.length > 0) {
          await recalculateUserGroupPoints(groupIdsToRecalculate);
        }
      }
    },
    [dbRef, recalculateUserGroupPoints],
  );

  const updateLocalPointsWithLive = useCallback((liveMatchIds: string[]) => {
    if (liveMatchIds.length === 0) return;

    const rawMatches = dbRef.current.matches as any[];
    const teams = dbRef.current.teams as any[];
    const allPredictions = dbRef.current.predictions as any[];
    const allUserGroups = dbRef.current.userGroups as any[];

    const hydratedMatchesMap = new Map<string, any>();
    rawMatches.forEach(m => {
      if (
        (m.status === MatchStatus.FINISHED || m.status === MatchStatus.LIVE) &&
        m.resultHome != null && m.resultAway != null
      ) {
        hydratedMatchesMap.set(m.id, {
          ...m,
          homeTeam: teams.find((t: any) => t.id === m.homeTeamId),
          awayTeam: teams.find((t: any) => t.id === m.awayTeamId),
        });
      }
    });

    const affectedGroupIds = Array.from(new Set(
      allPredictions
        .filter((p: any) => liveMatchIds.includes(p.matchId))
        .map((p: any) => p.groupId)
        .filter(Boolean)
    ));
    if (affectedGroupIds.length === 0) return;

    const updates: any[] = [];
    const allGroups = dbRef.current.groups as any[];
    const globalMinRankDiff: number =
      dbRef.current.systemConfig?.underdog_min_rank_diff ?? 10;

    for (const groupId of affectedGroupIds) {
      const group = allGroups.find((g: any) => g.id === groupId);
      const isRegulamento2 = group?.ruleset === 'regulamento_2';
      const effectiveMinRankDiff: number =
        group?.underdog_min_rank_diff ?? globalMinRankDiff;

      const members = allUserGroups.filter((ug: any) => ug.groupId === groupId);
      const groupPreds = allPredictions.filter((p: any) => p.groupId === groupId);
      
      const matchPredictionsGroup = groupPreds.map((p: any) => ({
        userId: p.userId,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        matchId: p.matchId,
      }));

      for (const member of members) {
        let total = 0;
        groupPreds
          .filter((p: any) => p.userId === member.userId)
          .forEach((p: any) => {
            const match = hydratedMatchesMap.get(p.matchId);
            if (match) {
              if (isRegulamento2) {
                const phase = getMatchPhase(match.stage, match.group);
                const predsForMatch = matchPredictionsGroup.filter((pg) => pg.matchId === p.matchId);
                total += calculatePointsRegulamento2(
                  p.homeScore, p.awayScore,
                  match.resultHome ?? 0, match.resultAway ?? 0,
                  phase,
                  predsForMatch,
                  p.userId
                );
              } else {
                total += calculatePoints(
                  p.homeScore, p.awayScore,
                  match.resultHome ?? 0, match.resultAway ?? 0,
                  match.homeTeam?.ranking, match.awayTeam?.ranking,
                  effectiveMinRankDiff
                );
              }
            }
          });
        updates.push({ userId: member.userId, groupId, points: total });
      }
    }

    if (updates.length > 0) {
      dbRef.current.updateLocalUserGroups(updates);
    }
  }, [dbRef]);

  return {
    recalculateUserGroupPoints,
    batchProcessPointsForMatches,
    updateLocalPointsWithLive,
  };
};
