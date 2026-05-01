import { useCallback } from "react";
import { Match, MatchStatus, PredictionDB } from "../types";
import { calculatePoints } from "../utils/scoring";
import { supabase } from "../services/supabase";

export const usePointsProcessor = (dbRef: any) => {
  const recalculateUserGroupPoints = useCallback(async (groupIds: string[]) => {
    if (!groupIds || groupIds.length === 0) return;
    const uniqueGroupIds = Array.from(new Set(groupIds));
    console.log(`🔄 Iniciando recálculo para ${uniqueGroupIds.length} grupos:`, uniqueGroupIds);

    for (const groupId of uniqueGroupIds) {
      // 1. Fetch all predictions for this group
      const { data: preds, error } = await supabase
        .from("predictions")
        .select("userId, points")
        .eq("groupId", groupId);

      if (error) {
        console.error(`❌ Erro ao buscar predições do grupo ${groupId}:`, error);
        continue;
      }

      // 2. Aggregate points by userId
      const pointsByUser: Record<string, number> = {};
      (preds || []).forEach((p) => {
        if (!pointsByUser[p.userId]) pointsByUser[p.userId] = 0;
        pointsByUser[p.userId] += (p.points || 0);
      });

      // 3. Fetch existing user_groups to preserve role/joinedAt
      const { data: existingGroupUsers, error: ugError } = await supabase
        .from("user_groups")
        .select("userId, groupId, role, joinedAt")
        .eq("groupId", groupId);

      if (ugError) {
        console.error(`❌ Erro ao buscar membros do grupo ${groupId}:`, ugError);
        continue;
      }

      if (existingGroupUsers && existingGroupUsers.length > 0) {
        const finalUpdates = existingGroupUsers.map((u) => ({
          ...u,
          points: pointsByUser[u.userId] || 0,
        }));

        console.log(`📤 Enviando ${finalUpdates.length} atualizações de pontos para o grupo ${groupId}`);
        const { error: upsertError } = await supabase
          .from("user_groups")
          .upsert(finalUpdates, { onConflict: "userId, groupId" });
        
        if (upsertError) {
          console.error(`❌ Erro ao fazer upsert em user_groups para o grupo ${groupId}:`, upsertError);
        } else {
          console.log(`✨ Pontos recalculados com sucesso para o grupo ${groupId}`);
          // Optimistic local update
          dbRef.current.updateLocalUserGroups(finalUpdates);
        }
      } else {
        console.warn(`⚠️ Nenhum membro encontrado em user_groups para o grupo ${groupId}`);
      }
    }
  }, []);

  const batchProcessPointsForMatches = useCallback(
    async (finishedMatches: Match[]) => {
      if (finishedMatches.length === 0) return;

      const updatesToUpsert: any[] = [];

      for (const match of finishedMatches) {
        const matchPredictions = dbRef.current.predictions.filter(
          (p: any) => p.matchId === match.id,
        );

        for (const pred of matchPredictions) {
          const pts = calculatePoints(
            pred.homeScore,
            pred.awayScore,
            match.result?.home || 0,
            match.result?.away || 0,
            match.homeTeam.ranking,
            match.awayTeam.ranking,
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
        await dbRef.current.upsertPrediction(updatesToUpsert);

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

  return {
    recalculateUserGroupPoints,
    batchProcessPointsForMatches,
  };
};
