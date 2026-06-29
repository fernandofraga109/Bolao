import { useCallback } from 'react';
import { Match, MatchDB, MatchStatus, TournamentPredictions } from '../types';
import {
  calculatePoints,
  calculatePointsRegulamento2,
  getR1MatchScoringResult,
  getKnockoutAdvancingTeamId,
  calculateTournamentPoints,
  calculateTournamentPointsRegulamento2,
  calculateExtraPhasePoints,
  getExtraPhaseKey,
  getMatchPhase,
  isTournamentFinalFinished,
} from '../utils/scoring';
import { supabase } from '../services/supabase';

/**
 * Executa `fn` sobre `items` com no máximo `limit` operações simultâneas.
 * Usado para recalcular grupos em paralelo sem inundar o Supabase com dezenas
 * de requisições de uma vez.
 */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await fn(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
}

export const usePointsProcessor = (dbRef: any) => {
  const recalculateUserGroupPoints = useCallback(
    async (groupIds: string[]) => {
      if (!groupIds || groupIds.length === 0) return;
      const uniqueGroupIds = Array.from(new Set(groupIds));
      console.log(
        `🔄 Iniciando recálculo in-memory para ${uniqueGroupIds.length} grupos:`,
        uniqueGroupIds
      );

      // Fetch fresh matches from database to guarantee we aren't using stale React state
      // during asynchronous sync operations
      const { data: dbMatches, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'FINISHED');

      const rawMatches = matchesError
        ? (dbRef.current.matches as MatchDB[])
        : (dbMatches as MatchDB[]);
      const teams = dbRef.current.teams as any[];
      const finishedMatchesMap = new Map<string, Match>();
      rawMatches.forEach((m) => {
        if (m.status === MatchStatus.FINISHED && m.resultHome != null && m.resultAway != null) {
          finishedMatchesMap.set(m.id, {
            ...m,
            homeTeam: teams.find((t: any) => t.id === m.homeTeamId),
            awayTeam: teams.find((t: any) => t.id === m.awayTeamId),
            result: { home: m.resultHome, away: m.resultAway },
            score: m.score,
            penaltiesHome: m.penaltiesHome,
            penaltiesAway: m.penaltiesAway,
          } as Match);
        }
      });

      // Busca todos os dados necessários em 4 queries únicas (IN groupIds)
      // em vez de 4 queries POR grupo — reduz de 4×N para 4 round-trips totais.
      const hasR2Groups = uniqueGroupIds.some((gid) => {
        const g = (dbRef.current.groups as any[]).find((g: any) => g.id === gid);
        return g?.ruleset === 'regulamento_2';
      });

      const [
        { data: allPreds, error: predsError },
        { data: allTournPreds, error: tournGlobalError },
        epGlobalResult,
        { data: allMembers, error: ugGlobalError },
      ] = await Promise.all([
        supabase
          .from('predictions')
          .select('userId, matchId, groupId, homeScore, awayScore, points, timestamp, tieWinnerTeamId')
          .in('groupId', uniqueGroupIds),
        supabase.from('tournament_predictions').select('*').in('groupId', uniqueGroupIds),
        hasR2Groups
          ? supabase.from('extra_phase_predictions').select('*').in('groupId', uniqueGroupIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase
          .from('user_groups')
          .select('userId, groupId, role, joinedAt')
          .in('groupId', uniqueGroupIds),
      ]);

      if (predsError) console.error('❌ Erro ao buscar predições em lote:', predsError);
      if (tournGlobalError) console.error('❌ Erro ao buscar predições de torneio em lote:', tournGlobalError);
      if (ugGlobalError) console.error('❌ Erro ao buscar membros em lote:', ugGlobalError);

      // Cache de competição entre grupos: 1 fetch por competitionCode único.
      const competitionPromises = new Map<string, Promise<any>>();
      const getCompetition = (code: string): Promise<any> => {
        if (!competitionPromises.has(code)) {
          competitionPromises.set(
            code,
            Promise.resolve(
              supabase
                .from('competitions')
                .select('*')
                .eq('code', code)
                .single()
                .then((r) => r.data)
            )
          );
        }
        return competitionPromises.get(code)!;
      };

      // Pré-busca competitions para todos os códigos únicos em paralelo
      const uniqueCompCodes = Array.from(new Set(
        uniqueGroupIds.map((gid) => {
          const g = (dbRef.current.groups as any[]).find((g: any) => g.id === gid);
          return g?.competitionCode || 'WC';
        })
      ));
      await Promise.all(uniqueCompCodes.map((code) => getCompetition(code)));

      // Coletores globais — preenchidos pelo processGroup e persistidos em batch no final
      const allUserGroupUpdates: any[] = [];
      const allPredPointsUpdates: any[] = [];

      const processGroup = async (groupId: string): Promise<void> => {
        // Resolve effective underdog threshold for this group
        const allGroups = dbRef.current.groups as any[];
        const group = allGroups.find((g: any) => g.id === groupId);
        const isRegulamento2 = group?.ruleset === 'regulamento_2';

        const globalMinRankDiff: number = dbRef.current.systemConfig?.underdog_min_rank_diff ?? 10;
        const effectiveMinRankDiff: number = group?.underdog_min_rank_diff ?? globalMinRankDiff;
        const compCode = group?.competitionCode || 'WC';

        // Filtra dados pré-carregados em memória (sem queries adicionais)
        const preds = predsError ? [] : (allPreds || []).filter((p: any) => p.groupId === groupId);
        const tournPreds = tournGlobalError ? [] : (allTournPreds || []).filter((p: any) => p.groupId === groupId);
        const members = ugGlobalError ? null : (allMembers || []).filter((m: any) => m.groupId === groupId);
        const compData = await getCompetition(compCode);

        if (predsError) {
          console.error(`❌ Erro ao buscar predições do grupo ${groupId} (lote falhou)`);
          return;
        }

        if (ugGlobalError) {
          console.error(`❌ Erro ao buscar membros do grupo ${groupId} (lote falhou)`);
          return;
        }

        // Extra phase predictions (only for Regulamento 2) — filtrados do lote
        let extraPhasePreds: any[] = [];
        if (isRegulamento2) {
          if (epGlobalResult.error) {
            console.error(
              `❌ Erro ao buscar palpites extras de fase do grupo ${groupId}:`,
              epGlobalResult.error
            );
          } else if (epGlobalResult.data) {
            extraPhasePreds = epGlobalResult.data.filter((ep: any) => ep.groupId === groupId);
          }
        }

        // --- GROUP CLASSIFICATIONS for tournament points ---
        // Admin override takes immediate precedence (always).
        // Fallback: auto-compute from standings positions 1 & 2, but ONLY after
        // all group-stage matches for this competition are FINISHED.
        let resolvedGroupClassifications: Record<string, string[]> | undefined = undefined;

        const adminGroupClassif = compData?.groupClassifications as Record<string, string[]> | null | undefined;
        const hasAdminOverride = !!adminGroupClassif && Object.keys(adminGroupClassif).length > 0;

        if (hasAdminOverride) {
          resolvedGroupClassifications = { ...adminGroupClassif! };
          console.log(`[Points] ✅ groupClassifications: usando override do admin para ${compCode}`);
        } else {
          // Check if all group-stage matches are finished.
          // We identify group stage matches by their `group` field (GROUP_A..L or Grupo A..L)
          // instead of using getMatchPhase, which is a catch-all that would incorrectly
          // include ROUND_OF_32 / LAST_32 matches as "groups".
          const GROUP_STAGE_PATTERN = /^(GROUP[_\s]+[A-L]|Grupo\s+[A-L])$/i;
          const allLocalMatches = dbRef.current.matches as any[];
          const compGroupMatches = allLocalMatches.filter((m: any) => {
            if ((m.competitionCode || 'WC').toUpperCase() !== compCode.toUpperCase()) return false;
            return GROUP_STAGE_PATTERN.test((m.group || '').trim());
          });

          const groupStageComplete =
            compGroupMatches.length > 0 &&
            compGroupMatches.every((m: any) => m.status === MatchStatus.FINISHED);

          if (groupStageComplete) {
            console.log(`[Points] ✅ Fase de grupos completa para ${compCode}. Buscando standings...`);
            const { data: standingsData } = await supabase
              .from('team_standings')
              .select('teamId, group, position')
              .eq('competitionCode', compCode)
              .lte('position', 2);

            if (standingsData && standingsData.length > 0) {
              resolvedGroupClassifications = {};
              standingsData.forEach((s: any) => {
                const raw = (s.group as string | null)?.trim();
                if (!raw) return;
                // Normalize API format GROUP_A → Grupo A (also handles Grupo A)
                const apiMatch = /^GROUP[_\s]+([A-Z])$/i.exec(raw);
                const g = apiMatch
                  ? `Grupo ${apiMatch[1].toUpperCase()}`
                  : raw.startsWith('Grupo')
                  ? raw
                  : null;
                if (!g) return;
                if (!resolvedGroupClassifications![g]) resolvedGroupClassifications![g] = [];
                resolvedGroupClassifications![g][(s.position as number) - 1] = s.teamId;
              });
              const groupCount = Object.keys(resolvedGroupClassifications).length;
              console.log(`[Points] ✅ ${groupCount} grupos resolvidos via standings para ${compCode}`);
            }
          } else {
            console.log(`[Points] ⏳ Fase de grupos ainda não encerrada para ${compCode} (${compGroupMatches.filter((m: any) => m.status !== MatchStatus.FINISHED).length} jogos pendentes). Pontos de classificados não aplicados.`);
          }
        }

        // Merge admin knockoutClassifications (Oitavas, Quartas, Semis) into
        // resolvedGroupClassifications so calculateTournamentPointsRegulamento2
        // can award 5pts per correct knockout pick.
        const adminKnockoutClassif = compData?.knockoutClassifications as Record<string, string[]> | null | undefined;
        if (adminKnockoutClassif && Object.keys(adminKnockoutClassif).length > 0) {
          if (!resolvedGroupClassifications) resolvedGroupClassifications = {};
          Object.entries(adminKnockoutClassif).forEach(([phase, teams]) => {
            if (Array.isArray(teams) && teams.length > 0) {
              resolvedGroupClassifications![phase] = teams;
            }
          });
          console.log(`[Points] ✅ knockoutClassifications mesclados para ${compCode}: ${Object.keys(adminKnockoutClassif).join(', ')}`);
        }

        const tournamentResults: TournamentPredictions | null = compData
          ? {
              championTeamId: compData.championTeamId || undefined,
              topScorer: compData.topScorerName
                ? { player: compData.topScorerName, goals: compData.topScorerGoals || 0 }
                : undefined,
              topScorerPlayerIds:
                compData.topScorerPlayerIds && compData.topScorerPlayerIds.length > 0
                  ? compData.topScorerPlayerIds
                  : undefined,
              bestPlayer: compData.bestPlayerName || undefined,
              bestGoalkeeper: compData.bestGoalkeeperName || undefined,
              mostGoalsTeamId: compData.mostGoalsTeamId || undefined,
              mostConcededTeamId: compData.mostConcededTeamId || undefined,
              mostGoalsTeamIds:
                compData.mostGoalsTeamIds && compData.mostGoalsTeamIds.length > 0
                  ? compData.mostGoalsTeamIds
                  : undefined,
              mostConcededTeamIds:
                compData.mostConcededTeamIds && compData.mostConcededTeamIds.length > 0
                  ? compData.mostConcededTeamIds
                  : undefined,
              groupClassifications: resolvedGroupClassifications || undefined,
            }
          : null;

        // 5. Calculate total points per user and track which predictions need their points column updated
        const pointsByUser: Record<string, number> = {};
        const predPointsUpdates: Array<{
          userId: string;
          matchId: string;
          groupId: string;
          homeScore: number;
          awayScore: number;
          points: number;
          tieWinnerTeamId?: string;
        }> = [];

        // Build group matches context map for placar isolado checks
        const matchPredictionsMap = new Map<
          string,
          Array<{ userId: string; homeScore: number; awayScore: number }>
        >();
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
              const realWhoClassifiesId = getKnockoutAdvancingTeamId(match);
              const predWhoClassifiesId = (p as any).tieWinnerTeamId as string | undefined;
              const r1Result = getR1MatchScoringResult(
                match,
                match.result?.home ?? 0,
                match.result?.away ?? 0
              );

              pts = calculatePoints(
                p.homeScore,
                p.awayScore,
                r1Result.home,
                r1Result.away,
                match.homeTeam?.ranking,
                match.awayTeam?.ranking,
                effectiveMinRankDiff,
                predWhoClassifiesId,
                realWhoClassifiesId
              );
            }

            pointsByUser[p.userId] += pts;
            if (p.points !== pts) {
              predPointsUpdates.push({
                userId: p.userId,
                matchId: p.matchId,
                groupId: p.groupId,
                homeScore: p.homeScore,
                awayScore: p.awayScore,
                points: pts,
                tieWinnerTeamId: (p as any).tieWinnerTeamId,
              });
            }
          }
        });

        // 6. Calculate and add tournament predictions points
        if (tournamentResults) {
          // Resolve player names from UUIDs for scoring comparisons
          const playerUuids = (tournPreds || [])
            .flatMap((tp) => [tp.topScorerPlayerId, tp.bestPlayerId, tp.bestGoalkeeperId])
            .filter(Boolean) as string[];

          const playerNameById = new Map<string, string>();
          if (playerUuids.length > 0) {
            const { data: playersData } = await supabase
              .from('players')
              .select('id, name')
              .in('id', playerUuids);
            (playersData || []).forEach((p: any) => playerNameById.set(p.id, p.name));
          }

          if (isRegulamento2) {
            // Regulamento 2: artilheiro sempre por UUID dos jogadores — nunca por nome.
            const groupTournPreds = (tournPreds || []).map((tp) => ({
              userId: tp.userId,
              championTeamId: tp.championTeamId || undefined,
              topScorerPlayerId: tp.topScorerPlayerId || undefined,
            }));

            // Build per-user match predictions map for knockout coherence check
            const matchPredsByUser = new Map<string, Record<string, { home: number; away: number }>>();
            (preds || []).forEach((p) => {
              if (!matchPredsByUser.has(p.userId)) matchPredsByUser.set(p.userId, {});
              matchPredsByUser.get(p.userId)![p.matchId] = { home: p.homeScore, away: p.awayScore };
            });

            // Source matches for coherence: ALL matches in the competition (not just finished),
            // because the feeder match (e.g. a 16-Avos game) needs to be found by team IDs
            // regardless of its current status.
            const allCompMatches = (dbRef.current.matches as any[]).filter(
              (m: any) => (m.competitionCode || 'WC').toUpperCase() === compCode.toUpperCase()
            );
            const phaseSourceMatches = allCompMatches.map((m: any) => ({
              id: m.id,
              homeTeamId: m.homeTeamId ?? null,
              awayTeamId: m.awayTeamId ?? null,
              stage: m.stage,
              group: m.group,
            }));

            (tournPreds || []).forEach((tp) => {
              if (!pointsByUser[tp.userId]) pointsByUser[tp.userId] = 0;
              const predTourn: TournamentPredictions = {
                championTeamId: tp.championTeamId || undefined,
                topScorerPlayerId: tp.topScorerPlayerId || undefined,
                bestPlayerId: tp.bestPlayerId || undefined,
                bestGoalkeeperId: tp.bestGoalkeeperId || undefined,
                mostGoalsTeamId: tp.mostGoalsTeamId || undefined,
                mostConcededTeamId: tp.mostConcededTeamId || undefined,
                groupClassifications: tp.groupClassifications || undefined,
              };

              const pts = calculateTournamentPointsRegulamento2(
                predTourn,
                tournamentResults,
                groupTournPreds,
                tp.userId,
                matchPredsByUser.get(tp.userId) || {},
                phaseSourceMatches
              );
              if (pts > 0) {
                console.log(`🏆 Pontos de Torneio (Regulamento 2) para ${tp.userId}: +${pts}`);
                pointsByUser[tp.userId] += pts;
              }
            });
          } else {
            // Regulamento 1: só calcula pontos de torneio se a final estiver finalizada
            const isFinalFinished = isTournamentFinalFinished(rawMatches);
            if (isFinalFinished) {
              // Regulamento 1: Stateless tournament points
              (tournPreds || []).forEach((tp) => {
                if (!pointsByUser[tp.userId]) pointsByUser[tp.userId] = 0;
                const tsName = tp.topScorerPlayerId
                  ? playerNameById.get(tp.topScorerPlayerId)
                  : undefined;
                const predTourn: TournamentPredictions = {
                  championTeamId: tp.championTeamId || undefined,
                  topScorer: tsName ? { player: tsName, goals: tp.topScorerGoals || 0 } : undefined,
                  bestPlayer: tp.bestPlayerId ? playerNameById.get(tp.bestPlayerId) : undefined,
                  bestGoalkeeper: tp.bestGoalkeeperId
                    ? playerNameById.get(tp.bestGoalkeeperId)
                    : undefined,
                };

                const pts = calculateTournamentPoints(predTourn, tournamentResults);
                if (pts > 0) {
                  pointsByUser[tp.userId] += pts;
                }
              });
            }
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

          // Admin overrides for biggest goal diff per phase
          const biggestGoalDiffMatchIds: Record<string, string[]> =
            compData?.biggestGoalDiffMatchIds ||
            Object.fromEntries(
              Object.entries(compData?.biggestGoalDiffMatches || {}).map(
                ([phase, matchId]) => [phase, matchId ? [matchId] : []]
              )
            );

          extraPhasePreds.forEach((ep) => {
            if (!pointsByUser[ep.userId]) pointsByUser[ep.userId] = 0;

            // Filter matches belonging to this phase
            const epPhase = ep.phase; // e.g. 'groups', 'oitavas', 'quartas', 'semis'
            const phaseMatchesFiltered = phaseMatches.filter((m) => {
              const phaseMapped = getExtraPhaseKey(m.stage, m.group);
              return phaseMapped === epPhase;
            });

            const officialMatchIds = biggestGoalDiffMatchIds[epPhase] || undefined;

            const pts = calculateExtraPhasePoints(
              { phase: ep.phase, matchId: ep.matchId || undefined },
              phaseMatchesFiltered,
              officialMatchIds
            );

            if (pts > 0) {
              console.log(
                `⚡ Pontos de Palpite Extra da Fase ${ep.phase} para ${ep.userId}: +${pts}`
              );
              pointsByUser[ep.userId] += pts;
            }
          });
        }

        // 8. Membros já foram buscados no Promise.all acima (preserva metadados).
        if (!preds || preds.length === 0) {
          const existingMembers = (dbRef.current.userGroups as any[]).filter(
            (ug: any) => ug.groupId === groupId
          );
          const hasExistingPoints = existingMembers.some((m: any) => (m.points ?? 0) > 0);
          if (hasExistingPoints) {
            console.warn(
              `⚠️ Empty predictions for group ${groupId} with existing points — skipping update`
            );
            return;
          }
        }

        // Coleta user_groups updates no array global (batch upsert no final)
        if (members && members.length > 0) {
          const finalUpdates = members.map((u) => ({
            ...u,
            points: pointsByUser[u.userId] || 0,
          }));
          console.log(`📤 [${groupId}] ${finalUpdates.length} usuários para atualizar`);
          allUserGroupUpdates.push(...finalUpdates);
        }

        // Coleta predictions.points updates no array global (batch upsert no final)
        if (predPointsUpdates.length > 0) {
          allPredPointsUpdates.push(...predPointsUpdates);
        }
      };

      // Recalcula os grupos EM PARALELO (concorrência limitada) em vez de em
      // série — principal ganho de performance do recálculo (Fase 5 do sync).
      await mapWithConcurrency(uniqueGroupIds, 6, processGroup);

      // 2 upserts batch únicos para todos os grupos (em vez de 2×N por grupo)
      if (allUserGroupUpdates.length > 0) {
        console.log(`📤 Batch upsert de ${allUserGroupUpdates.length} entradas de user_groups...`);
        const { error: ugBatchError } = await supabase
          .from('user_groups')
          .upsert(allUserGroupUpdates, { onConflict: 'userId,groupId' });
        if (ugBatchError) {
          console.error('❌ Erro ao atualizar user_groups em batch:', ugBatchError);
        } else {
          dbRef.current.updateLocalUserGroups(allUserGroupUpdates);
          console.log(`✨ ${uniqueGroupIds.length} grupos sincronizados com sucesso`);
        }
      }

      if (allPredPointsUpdates.length > 0) {
        console.log(`📦 Batch upsert de ${allPredPointsUpdates.length} predictions.points...`);
        const { error: predBatchError } = await supabase
          .from('predictions')
          .upsert(allPredPointsUpdates, { onConflict: '"userId", "matchId", "groupId"', defaultToNull: false });
        if (predBatchError) {
          console.error('❌ Erro ao atualizar predictions.points em batch:', predBatchError);
        }
      }

      // Refresh predictions in local state so the UI reflects any
      // predictions that were inserted directly in the DB (bypassing Realtime).
      await dbRef.current.refetchPredictions();
    },
    [dbRef]
  );

  const batchProcessPointsForMatches = useCallback(
    async (finishedMatches: Match[]) => {
      if (finishedMatches.length === 0) return;

      const updatesToUpsert: any[] = [];

      for (const match of finishedMatches) {
        const matchPredictions = dbRef.current.predictions.filter(
          (p: any) => p.matchId === match.id
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
            const realWhoClassifiesId2 = getKnockoutAdvancingTeamId(match);
            const predWhoClassifiesId2 = (pred as any).tieWinnerTeamId as string | undefined;
            const r1Result2 = getR1MatchScoringResult(
              match,
              match.result?.home || 0,
              match.result?.away || 0
            );

            pts = calculatePoints(
              pred.homeScore,
              pred.awayScore,
              r1Result2.home,
              r1Result2.away,
              match.homeTeam.ranking,
              match.awayTeam.ranking,
              effectiveMinRankDiff,
              predWhoClassifiesId2,
              realWhoClassifiesId2
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
        console.log(`📦 Persistindo pontos para ${updatesToUpsert.length} palpites (predictions.points)...`);
        const { error: batchPredError } = await supabase
          .from('predictions')
          .upsert(updatesToUpsert, { onConflict: '"userId", "matchId", "groupId"', defaultToNull: false });
        if (batchPredError) {
          console.error('❌ Erro ao persistir predictions.points em batch:', batchPredError);
        }
      }
    },
    [dbRef]
  );

  const updateLocalPointsWithLive = useCallback(
    (liveMatchIds: string[]) => {
      if (liveMatchIds.length === 0) return;

      const rawMatches = dbRef.current.matches as any[];
      const teams = dbRef.current.teams as any[];
      const allPredictions = dbRef.current.predictions as any[];
      const allUserGroups = dbRef.current.userGroups as any[];

      const hydratedMatchesMap = new Map<string, any>();
      rawMatches.forEach((m) => {
        if (
          (m.status === MatchStatus.FINISHED || m.status === MatchStatus.LIVE) &&
          m.resultHome != null &&
          m.resultAway != null
        ) {
          hydratedMatchesMap.set(m.id, {
            ...m,
            homeTeam: teams.find((t: any) => t.id === m.homeTeamId),
            awayTeam: teams.find((t: any) => t.id === m.awayTeamId),
            score: m.score,
            penaltiesHome: m.penaltiesHome,
            penaltiesAway: m.penaltiesAway,
          });
        }
      });

      const affectedGroupIds = Array.from(
        new Set(
          allPredictions
            .filter((p: any) => liveMatchIds.includes(p.matchId))
            .map((p: any) => p.groupId)
            .filter(Boolean)
        )
      );
      if (affectedGroupIds.length === 0) return;

      const updates: any[] = [];
      const allGroups = dbRef.current.groups as any[];
      const globalMinRankDiff: number = dbRef.current.systemConfig?.underdog_min_rank_diff ?? 10;

      for (const groupId of affectedGroupIds) {
        const group = allGroups.find((g: any) => g.id === groupId);
        const isRegulamento2 = group?.ruleset === 'regulamento_2';
        const effectiveMinRankDiff: number = group?.underdog_min_rank_diff ?? globalMinRankDiff;

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
                  const predsForMatch = matchPredictionsGroup.filter(
                    (pg) => pg.matchId === p.matchId
                  );
                  total += calculatePointsRegulamento2(
                    p.homeScore,
                    p.awayScore,
                    match.resultHome ?? 0,
                    match.resultAway ?? 0,
                    phase,
                    predsForMatch,
                    p.userId
                  );
                } else {
                  const realWhoClassifiesId3 = getKnockoutAdvancingTeamId({
                    ...match,
                    result: match.resultHome != null ? { home: match.resultHome, away: match.resultAway ?? 0 } : undefined,
                  });
                  const predWhoClassifiesId3 = (p as any).tieWinnerTeamId as string | undefined;
                  const r1Result3 = getR1MatchScoringResult(
                    match,
                    match.resultHome ?? 0,
                    match.resultAway ?? 0
                  );

                  total += calculatePoints(
                    p.homeScore,
                    p.awayScore,
                    r1Result3.home,
                    r1Result3.away,
                    match.homeTeam?.ranking,
                    match.awayTeam?.ranking,
                    effectiveMinRankDiff,
                    predWhoClassifiesId3,
                    realWhoClassifiesId3
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
    },
    [dbRef]
  );

  return {
    recalculateUserGroupPoints,
    batchProcessPointsForMatches,
    updateLocalPointsWithLive,
  };
};
