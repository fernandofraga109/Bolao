import { useCallback } from "react";
import { Match, MatchStatus, PredictionDB } from "../types";
import { calculatePoints } from "../utils/scoring";
import { supabase } from "../services/supabase";

export const usePointsProcessor = (dbRef: any) => {
  const recalculateUserGroupPoints = useCallback(async (groupIds: string[]) => {
    if (!groupIds || groupIds.length === 0) return;
    const uniqueGroupIds = Array.from(new Set(groupIds));
    console.log(`🔄 Iniciando recálculo in-memory para ${uniqueGroupIds.length} grupos:`, uniqueGroupIds);

    // Precisamos dos matches atuais para os resultados oficiais e rankings
    const allMatches = dbRef.current.matches as Match[];
    const finishedMatchesMap = new Map<string, Match>();
    allMatches.forEach(m => {
      if (m.status === MatchStatus.FINISHED && m.resultHome != null && m.resultAway != null) {
        finishedMatchesMap.set(m.id, m);
      }
    });

    for (const groupId of uniqueGroupIds) {
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
            match.resultHome ?? 0,
            match.resultAway ?? 0,
            match.homeTeam?.ranking,
            match.awayTeam?.ranking
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

        let anyFailed = false;
        for (const update of finalUpdates) {
          const { error: updateError } = await supabase
            .from("user_groups")
            .update({ points: update.points })
            .eq("userId", update.userId)
            .eq("groupId", update.groupId);
          if (updateError) {
            console.error(`❌ Erro ao atualizar pontos do membro ${update.userId}:`, updateError);
            anyFailed = true;
          }
        }

        if (!anyFailed) {
          console.log(`✨ Classificação sincronizada com sucesso para o grupo ${groupId}`);
          dbRef.current.updateLocalUserGroups(finalUpdates);
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

  return {
    recalculateUserGroupPoints,
    batchProcessPointsForMatches,
  };
};
