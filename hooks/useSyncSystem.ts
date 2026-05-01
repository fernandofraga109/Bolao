import { useState, useCallback, useRef, useEffect } from "react";
import { Match, MatchStatus, TeamDB, TournamentPredictions } from "../types";
import {
  fetchExternalStandings,
  fetchExternalMatches,
  findInternalMatch,
  getCurrentSeason,
  mapExternalStatusToInternal,
} from "../services/liveScoreService";
import { supabase } from "../services/supabase";

const normalizeCompetitionCode = (value?: string) =>
  (value || "WC").toUpperCase();

type SyncOperation = "matches" | "standings" | "combined";

export interface CompetitionSyncStatus {
  competitionCode: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastOperation?: SyncOperation;
  lastMessage?: string;
  lastSuccess?: boolean;
  isSyncing?: boolean;
}

const SYNC_STATUS_STORAGE_KEY = "bolao_sync_status_by_competition";

export const useSyncSystem = (
  activeCompetitionCode: string,
  canWriteData: boolean,
  dbRef: any,
  getWcRankingMap: () => Promise<Record<string, number>>,
  batchProcessPointsForMatches: (matches: Match[]) => Promise<void>,
  recalculateUserGroupPoints: (groupIds: string[]) => Promise<void>
) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusByCompetition, setSyncStatusByCompetition] = useState<
    Record<string, CompetitionSyncStatus>
  >(() => {
    try {
      const raw = localStorage.getItem(SYNC_STATUS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, CompetitionSyncStatus>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });

  const syncingCompetitionsRef = useRef<Set<string>>(new Set());
  const nextAllowedSyncAtRef = useRef(0);

  const updateSyncStatus = useCallback(
    (
      competitionCode: string,
      patch: Partial<CompetitionSyncStatus> &
        Pick<CompetitionSyncStatus, "lastOperation">,
    ) => {
      const normalizedCode = normalizeCompetitionCode(competitionCode);
      setSyncStatusByCompetition((prev) => {
        const next = {
          ...prev,
          [normalizedCode]: {
            ...(prev[normalizedCode] || {
              competitionCode: normalizedCode,
            }),
            ...patch,
            lastAttemptAt: new Date().toISOString(),
          },
        };
        localStorage.setItem(SYNC_STATUS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const syncWithExternalApi = useCallback(
    async (competitionCode: string) => {
      const normalizedCode = normalizeCompetitionCode(competitionCode);
      const isManual = competitionCode === activeCompetitionCode;

      if (!canWriteData) {
        return {
          success: false,
          message: "Somente administradores podem salvar no banco.",
        };
      }

      const now = Date.now();
      if (!isManual && now < nextAllowedSyncAtRef.current) {
        return {
          success: false,
          message: "Aguardando intervalo entre sincronizações.",
        };
      }

      if (syncingCompetitionsRef.current.has(normalizedCode)) {
        return { success: false, message: "Sincronização já em andamento." };
      }

      syncingCompetitionsRef.current.add(normalizedCode);
      updateSyncStatus(normalizedCode, {
        isSyncing: true,
        lastOperation: "matches",
      });
      setIsSyncing(true);

      try {
        const externalMatches = await fetchExternalMatches(normalizedCode);
        if (!externalMatches || externalMatches.length === 0) {
          throw new Error("Nenhum jogo encontrado na API externa.");
        }

        const rankingMap =
          normalizedCode === "WC" ? await getWcRankingMap() : {};

        const matchesToProcess = externalMatches.map((em) => {
          const status = mapExternalStatusToInternal(em.status);
          const result = em.score?.fullTime?.home != null ? {
            home: em.score.fullTime.home,
            away: em.score.fullTime.away,
          } : undefined;

          return { em, status, result };
        });

        let updatedCount = 0;
        const finishedMatches: Match[] = [];

        const hydratedInternalMatches = dbRef.current.matches.map((m: any) => ({
          ...m,
          homeTeam: dbRef.current.teams.find((t: any) => t.id === m.homeTeamId),
          awayTeam: dbRef.current.teams.find((t: any) => t.id === m.awayTeamId),
        }));

        for (const { em, status, result } of matchesToProcess) {
          const existing = findInternalMatch(em, hydratedInternalMatches);

          if (existing) {
            const hasChanged =
              existing.status !== status ||
              existing.result?.home !== result?.home ||
              existing.result?.away !== result?.away;

            if (hasChanged) {
              const updatedMatch = {
                ...existing,
                status,
                result,
                date: em.utcDate,
              };

              await dbRef.current.updateMatch(existing.id, {
                status,
                resultHome: result?.home,
                resultAway: result?.away,
                date: em.utcDate,
              });

              if (status === MatchStatus.FINISHED && result) {
                finishedMatches.push(updatedMatch as Match);
              }
              updatedCount++;
            }
          } else if (isSupabaseEnabled() && supabase) {
            // Match does NOT exist, CREATE it
            const getOrCreateTeam = async (externalTeam: any) => {
              if (!externalTeam) return null;
              
              // Find in memory
              let team = dbRef.current.teams.find(t => t.externalTeamId === externalTeam.id || t.code === externalTeam.tla);
              if (team) return team;

              // Find in DB
              const { data: remoteTeam } = await supabase
                .from("teams")
                .select("*")
                .or(`code.eq.${externalTeam.tla},externalTeamId.eq.${externalTeam.id}`)
                .maybeSingle();
              if (remoteTeam) return remoteTeam;

              // Create it
              const newTeamPayload = {
                name: externalTeam.name,
                code: externalTeam.tla || (externalTeam.name || "TBD").substring(0, 3).toUpperCase(),
                flag: externalTeam.crest || "/favicon.ico",
                externalTeamId: externalTeam.id,
                ranking: 999
              };
              const { data: createdTeam } = await supabase
                .from("teams")
                .upsert(newTeamPayload, { onConflict: "code" })
                .select("*")
                .single();
              return createdTeam;
            };

            const homeTeam = await getOrCreateTeam(em.homeTeam);
            const awayTeam = await getOrCreateTeam(em.awayTeam);

            if (homeTeam && awayTeam) {
              const newMatchData = {
                externalMatchId: String(em.id),
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                date: em.utcDate,
                group: em.group || em.stage || "Campeonato",
                competitionCode: normalizedCode,
                status: status,
                resultHome: result?.home,
                resultAway: result?.away,
                stage: em.stage,
                matchday: em.matchday
              };

              await dbRef.current.upsertMatch(newMatchData as any);
              updatedCount++;
            }
          }
        }

        if (finishedMatches.length > 0) {
          await batchProcessPointsForMatches(finishedMatches);
        }

        const message =
          updatedCount > 0
            ? `${updatedCount} jogos atualizados.`
            : "Todos os jogos já estão atualizados.";

        updateSyncStatus(normalizedCode, {
          isSyncing: false,
          lastSuccess: true,
          lastSuccessAt: new Date().toISOString(),
          lastMessage: message,
        });

        nextAllowedSyncAtRef.current = Date.now() + 30000;
        return { success: true, message };
      } catch (err: any) {
        updateSyncStatus(normalizedCode, {
          isSyncing: false,
          lastSuccess: false,
          lastMessage: err.message,
        });
        return { success: false, message: err.message };
      } finally {
        syncingCompetitionsRef.current.delete(normalizedCode);
        setIsSyncing(false);
      }
    },
    [
      activeCompetitionCode,
      canWriteData,
      dbRef,
      getWcRankingMap,
      updateSyncStatus,
      batchProcessPointsForMatches,
    ],
  );

  const syncStandingsWithExternalApi = useCallback(
    async (competitionCode: string) => {
      const normalizedCode = normalizeCompetitionCode(competitionCode);

      if (!canWriteData) {
        return {
          success: false,
          message: "Somente administradores podem salvar no banco.",
        };
      }

      updateSyncStatus(normalizedCode, {
        isSyncing: true,
        lastOperation: "standings",
      });

      try {
        const standingsData = await fetchExternalStandings(normalizedCode);
        if (!standingsData || !standingsData.standings) {
          throw new Error("Classificação não disponível para esta competição.");
        }

        for (const group of standingsData.standings) {
          // Process only the TOTAL standings table, ignore HOME/AWAY splits
          if (group.type !== "TOTAL") continue;

          for (const row of group.table) {
            // 1. Try to find team in current memory
            let team = dbRef.current.teams.find(
              (t: any) =>
                t && (t.externalTeamId === row.team.id ||
                t.code === row.team.tla ||
                t.name === row.team.name),
            );

            // 2. If not in memory, try to find in Supabase directly (might be newly created)
            if (!team && isSupabaseEnabled() && supabase) {
              const { data: remoteTeam } = await supabase
                .from("teams")
                .select("*")
                .or(`code.eq.${row.team.tla},externalTeamId.eq.${row.team.id}`)
                .maybeSingle();
              
              if (remoteTeam) {
                team = remoteTeam as any;
              }
            }

            // 3. If still not found, create it on the fly
            if (!team && isSupabaseEnabled() && supabase) {
              const newTeamPayload = {
                name: row.team.name,
                code: row.team.tla || row.team.name.substring(0, 3).toUpperCase(),
                flag: row.team.crest || "/favicon.ico",
                externalTeamId: row.team.id,
                ranking: 999
              };

              const { data: createdTeam, error: createError } = await supabase
                .from("teams")
                .upsert(newTeamPayload, { onConflict: "code" })
                .select("*")
                .single();
              
              if (!createError && createdTeam) {
                team = createdTeam as any;
              }
            }

            if (team) {
              const standingData: any = {
                teamId: team.id,
                competitionCode: normalizedCode,
                season: standingsData.filters?.season || getCurrentSeason(),
                stage: group.stage,
                type: group.type,
                group: group.group || "Temporada Regular",
                position: row.position,
                playedGames: row.playedGames,
                form: row.form,
                won: row.won,
                draw: row.draw,
                lost: row.lost,
                points: row.points,
                goalsFor: row.goalsFor,
                goalsAgainst: row.goalsAgainst,
                goalDifference: row.goalDifference,
                updatedAt: new Date().toISOString(),
              };

              await supabase.from("team_standings").upsert(standingData, {
                onConflict: "teamId, competitionCode",
              });
            }
          }
        }

        const message = "Classificação sincronizada com sucesso.";
        updateSyncStatus(normalizedCode, {
          isSyncing: false,
          lastSuccess: true,
          lastSuccessAt: new Date().toISOString(),
          lastMessage: message,
        });

        return { success: true, message };
      } catch (err: any) {
        updateSyncStatus(normalizedCode, {
          isSyncing: false,
          lastSuccess: false,
          lastMessage: err.message,
        });
        return { success: false, message: err.message };
      }
    },
    [canWriteData, dbRef, updateSyncStatus],
  );

  const syncMatchesAndStandings = useCallback(
    async (competitionCode: string) => {
      const normalizedCode = normalizeCompetitionCode(competitionCode);

      try {
        updateSyncStatus(normalizedCode, {
          isSyncing: true,
          lastOperation: "combined",
        });

        const matchResult = await syncWithExternalApi(normalizedCode);
        const standingsResult = await syncStandingsWithExternalApi(normalizedCode);

        const combinedSuccess = matchResult.success && standingsResult.success;
        const combinedMessage = `${matchResult.message} ${standingsResult.message}`;

        updateSyncStatus(normalizedCode, {
          isSyncing: true,
          lastSuccess: combinedSuccess,
          lastSuccessAt: combinedSuccess ? new Date().toISOString() : undefined,
          lastMessage: combinedMessage,
        });

        if (combinedSuccess && canWriteData) {
          await dbRef.current.updateCompetitionSync(
            normalizedCode,
            new Date().toISOString(),
          );
        }

        const affectedGroupIds = dbRef.current.groups
          .filter(
            (g: any) => (g.competitionCode || "WC").toUpperCase() === normalizedCode,
          )
          .map((g: any) => g.id);

        if (affectedGroupIds.length > 0) {
          await recalculateUserGroupPoints(affectedGroupIds);
        }

        updateSyncStatus(normalizedCode, { isSyncing: false });
        return { success: combinedSuccess, message: combinedMessage };
      } catch (err: any) {
        updateSyncStatus(normalizedCode, {
          isSyncing: false,
          lastMessage: err.message,
        });
        return { success: false, message: err.message };
      }
    },
    [
      syncWithExternalApi,
      syncStandingsWithExternalApi,
      updateSyncStatus,
      canWriteData,
      dbRef,
      recalculateUserGroupPoints,
    ],
  );

  return {
    isSyncing,
    syncStatusByCompetition,
    syncWithExternalApi,
    syncStandingsWithExternalApi,
    syncMatchesAndStandings,
    updateSyncStatus,
  };
};
