import { useCallback } from "react";
import { Match, MatchDB, MatchStatus, PredictionDB } from "../types";
import { calculatePoints } from "../utils/scoring";
import { supabase } from "../services/supabase";

export const usePointsProcessor = (dbRef: any) => {
  const recalculateUserGroupPoints = useCallback(async (groupIds: string[]) => {
    if (!groupIds || groupIds.length === 0) return;
    const uniqueGroupIds = Array.from(new Set(groupIds));
    console.log(`🔄 Iniciando recálculo in-memory para ${uniqueGroupIds.length} grupos:`, uniqueGroupIds);

    // Hydrate raw MatchDB rows with team objects so calculatePoints can access rankings
    const rawMatches = dbRef.current.matches as MatchDB[];
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
      const globalMinRankDiff: number =
        dbRef.current.systemConfig?.underdog_min_rank_diff ?? 10;
      const effectiveMinRankDiff: number =
        group?.underdog_min_rank_diff ?? globalMinRankDiff;

      // 1. Buscamos todas as predições (raw scores) do grupo
      // Nota: Não confiamos na coluna 'points' do banco, pois ela pode estar
      // desatualizada se o sync anterior foi feito por um usuário sem permissão de escrita.
      const { data: preds, error } = await supabase
        .from("predictions")
        .select("userId, matchId, homeScore, awayScore")
        .eq("groupId", groupId);

      if (error) {
        console.error(`❌ Erro ao buscar predições do grupo ${groupId}:`, error);
        continue;
      }

      // 2. Calculamos os pontos totais por usuário baseados nos resultados oficiais
      const pointsByUser: Record<string, number> = {};

      (preds || []).forEach((p) => {
        if (!pointsByUser[p.userId]) pointsByUser[p.userId] = 0;

        const match = finishedMatchesMap.get(p.matchId);
        if (match) {
          const pts = calculatePoints(
            p.homeScore,
            p.awayScore,
            match.result?.home ?? 0,
            match.result?.away ?? 0,
            match.homeTeam?.ranking,
            match.awayTeam?.ranking,
            effectiveMinRankDiff
          );
          pointsByUser[p.userId] += pts;
        }
      });

      // 3. Buscamos os membros atuais para preservar metadados
      const { data: members, error: ugError } = await supabase
        .from("user_groups")
        .select("userId, groupId, role, joinedAt")
        .eq("groupId", groupId);

      if (ugError) {
        console.error(`❌ Erro ao buscar membros do grupo ${groupId}:`, ugError);
        continue;
      }

      if (members && members.length > 0) {
        const finalUpdates = members.map((u) => ({
          ...u,
          points: pointsByUser[u.userId] || 0,
        }));

        console.log(`📤 Enviando classificação atualizada para o grupo ${groupId} (${finalUpdates.length} usuários)`);

        const successfulUpdates: typeof finalUpdates = [];
        for (const update of finalUpdates) {
          const { data: updated, error: updateError } = await supabase
            .from("user_groups")
            .update({ points: update.points })
            .eq("userId", update.userId)
            .eq("groupId", update.groupId)
            .select("userId, groupId, points");

          if (updateError) {
            console.error(`❌ Erro ao atualizar pontos do membro ${update.userId}:`, updateError);
          } else if (!updated || updated.length === 0) {
            console.error(`❌ Update matched 0 rows:`, { userId: update.userId, groupId: update.groupId });
          } else {
            successfulUpdates.push(update);
          }
        }

        if (successfulUpdates.length > 0) {
          dbRef.current.updateLocalUserGroups(successfulUpdates);
        }

        if (successfulUpdates.length === finalUpdates.length) {
          console.log(`✨ Classificação sincronizada com sucesso para o grupo ${groupId}`);
        } else {
          console.warn(`⚠️ ${successfulUpdates.length}/${finalUpdates.length} pontos atualizados no grupo ${groupId}`);
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
          const globalMinRankDiff: number =
            dbRef.current.systemConfig?.underdog_min_rank_diff ?? 10;
          const effectiveMinRankDiff: number =
            predGroup?.underdog_min_rank_diff ?? globalMinRankDiff;

          const pts = calculatePoints(
            pred.homeScore,
            pred.awayScore,
            match.result?.home || 0,
            match.result?.away || 0,
            match.homeTeam.ranking,
            match.awayTeam.ranking,
            effectiveMinRankDiff,
          );

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
        try {
          // Tentamos salvar os pontos na tabela de predictions.
          // Em background sync de usuários comuns, isso falhará para palpites de outros usuários via RLS.
          // Isso é OK, pois o recalculateUserGroupPoints agora calcula em memória.
          await dbRef.current.upsertPrediction(updatesToUpsert);
        } catch (err) {
          console.debug("[SYNC] Upsert de predictions limitado por RLS (comportamento esperado em background sync).");
        }

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
      const effectiveMinRankDiff: number =
        group?.underdog_min_rank_diff ?? globalMinRankDiff;

      const members = allUserGroups.filter((ug: any) => ug.groupId === groupId);
      const groupPreds = allPredictions.filter((p: any) => p.groupId === groupId);
      for (const member of members) {
        let total = 0;
        groupPreds
          .filter((p: any) => p.userId === member.userId)
          .forEach((p: any) => {
            const match = hydratedMatchesMap.get(p.matchId);
            if (match) {
              total += calculatePoints(
                p.homeScore, p.awayScore,
                match.resultHome ?? 0, match.resultAway ?? 0,
                match.homeTeam?.ranking, match.awayTeam?.ranking,
                effectiveMinRankDiff
              );
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
