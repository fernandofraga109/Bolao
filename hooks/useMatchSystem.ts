import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Match, MatchStatus, Team, TeamDB, TournamentPredictions } from "../types";
import { useDatabase } from "../contexts/DatabaseContext";
import { usePointsProcessor } from "./usePointsProcessor";
import { useSyncSystem, CompetitionSyncStatus } from "./useSyncSystem";
import { useBackgroundSync } from "./useBackgroundSync";
export type { CompetitionSyncStatus };

const normalizeCompetitionCode = (value?: string) =>
  (value || "WC").toUpperCase();

export const useMatchSystem = (
  activeCompetitionCode: string = "WC",
  canWriteData: boolean = false,
  onBackgroundSyncStart?: (code: string) => void,
  onBackgroundSyncEnd?: (code: string, success: boolean, message: string) => void,
) => {
  const db = useDatabase();
  const dbRef = useRef(db);

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  const wcRankingMapRef = useRef<Record<string, number> | null>(null);

  const getWcRankingMap = useCallback(async (): Promise<
    Record<string, number>
  > => {
    if (wcRankingMapRef.current) {
      return wcRankingMapRef.current;
    }

    try {
      const rankingFileUrl = new URL(
        "../data/team-ranking.json",
        import.meta.url,
      );
      const response = await fetch(rankingFileUrl);

      if (!response.ok) {
        console.warn(
          `[RANKING] Falha ao carregar team-ranking.json (HTTP ${response.status}).`,
        );
        return {};
      }

      const payload = await response.json().catch(() => ({}));
      const rankingMap: Record<string, number> = {};

      (payload.Results || []).forEach((team: any) => {
        const code = String(team?.IdCountry || "").toUpperCase();
        const rank = Number(team?.Rank);
        if (code && Number.isFinite(rank) && rank > 0) {
          rankingMap[code] = rank;
        }
      });

      wcRankingMapRef.current = rankingMap;
      return rankingMap;
    } catch (error) {
      console.warn("[RANKING] Erro ao processar team-ranking.json:", error);
      return {};
    }
  }, []);

  const { recalculateUserGroupPoints, batchProcessPointsForMatches, updateLocalPointsWithLive } = usePointsProcessor(dbRef);

  const {
    isSyncing,
    syncStatusByCompetition,
    syncWithExternalApi,
    syncStandingsWithExternalApi,
    syncMatchesAndStandings,
    updateSyncStatus,
    registerAdminOverride,
  } = useSyncSystem(
    activeCompetitionCode,
    canWriteData,
    dbRef,
    getWcRankingMap,
    batchProcessPointsForMatches,
    recalculateUserGroupPoints
  );

  // --- HYDRATION ---
  const matches: Match[] = useMemo(() => {
    const activeCode = normalizeCompetitionCode(activeCompetitionCode);
    return db.matches
      .filter((m) => normalizeCompetitionCode(m.competitionCode) === activeCode)
      .map((m) => {
        const homeTeam = db.teams.find((t) => t.id === m.homeTeamId);
        const awayTeam = db.teams.find((t) => t.id === m.awayTeamId);

        // Times ainda não carregados no estado local (ex: sync em andamento via Realtime).
        // Retornar null e filtrar depois para evitar crash no render.
        if (!homeTeam || !awayTeam) return null;

        return {
          ...m,
          homeTeam,
          awayTeam,
          status: m.status as MatchStatus,
          result: m.resultHome != null ? { home: m.resultHome, away: m.resultAway! } : undefined,
        } as Match;
      })
      .filter((m): m is Match => m !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [db.matches, db.teams, activeCompetitionCode]);

  useEffect(() => {
    const liveMatches = matches.filter(
      m => m.status === MatchStatus.LIVE && m.result != null
    );
    if (liveMatches.length > 0) {
      updateLocalPointsWithLive(liveMatches.map(m => m.id));
    }
  }, [matches]);

  const tournamentResults: TournamentPredictions | null = useMemo(() => {
    const comp = db.competitions.find(
      (c) =>
        normalizeCompetitionCode(c.code) ===
        normalizeCompetitionCode(activeCompetitionCode),
    );
    if (!comp) return null;

    // --- GROUP CLASSIFICATIONS ---
    // Admin override takes precedence over computed data
    let groupClassifications: Record<string, string[]> = {};

    if (comp.groupClassifications && Object.keys(comp.groupClassifications).length > 0) {
      // Use admin-set group classifications
      groupClassifications = { ...comp.groupClassifications };
    } else {
      // Dynamically compute actual groupClassifications (qualifiers) from teamStandings
      db.teamStandings.forEach((standing) => {
        if (
          normalizeCompetitionCode(standing.competitionCode) ===
            normalizeCompetitionCode(activeCompetitionCode) &&
          standing.group &&
          standing.group.startsWith("Grupo") &&
          standing.position != null &&
          (standing.position === 1 || standing.position === 2)
        ) {
          if (!groupClassifications[standing.group]) {
            groupClassifications[standing.group] = [];
          }
          groupClassifications[standing.group][standing.position - 1] = standing.teamId;
        }
      });
    }

    // --- KNOCKOUT CLASSIFICATIONS ---
    // Admin override takes precedence over computed data
    if (comp.knockoutClassifications && Object.keys(comp.knockoutClassifications).length > 0) {
      // Use admin-set knockout classifications
      if (comp.knockoutClassifications["Oitavas"]) {
        groupClassifications["Oitavas"] = comp.knockoutClassifications["Oitavas"];
      }
      if (comp.knockoutClassifications["Quartas"]) {
        groupClassifications["Quartas"] = comp.knockoutClassifications["Quartas"];
      }
      if (comp.knockoutClassifications["Semis"]) {
        groupClassifications["Semis"] = comp.knockoutClassifications["Semis"];
      }
    } else {
      // Populate knockout stage actual qualifiers based on matches that are scheduled/played with real teams
      const oitavasTeams = new Set<string>();
      const quartasTeams = new Set<string>();
      const semisTeams = new Set<string>();

      const isPlaceholder = (id: string) => {
        if (!id) return true;
        const lower = id.toLowerCase();
        return (
          lower === "placeholder" ||
          lower === "tbd" ||
          lower.startsWith("placeholder") ||
          lower.includes("_") ||
          /^[1-2][a-l]$/i.test(lower)
        );
      };

      db.matches.forEach((m) => {
        if (
          normalizeCompetitionCode(m.competitionCode) ===
          normalizeCompetitionCode(activeCompetitionCode)
        ) {
          const stage = (m.stage || "").toUpperCase();
          const groupStr = (m.group || "").toUpperCase();

          const isOitavas = stage.includes("ROUND_OF_16") || groupStr.includes("OITAVAS");
          const isQuartas = stage.includes("QUARTER") || groupStr.includes("QUARTAS");
          const isSemis = stage.includes("SEMI") || groupStr.includes("SEMI");

          if (isOitavas) {
            if (m.homeTeamId && !isPlaceholder(m.homeTeamId)) oitavasTeams.add(m.homeTeamId);
            if (m.awayTeamId && !isPlaceholder(m.awayTeamId)) oitavasTeams.add(m.awayTeamId);
          } else if (isQuartas) {
            if (m.homeTeamId && !isPlaceholder(m.homeTeamId)) quartasTeams.add(m.homeTeamId);
            if (m.awayTeamId && !isPlaceholder(m.awayTeamId)) quartasTeams.add(m.awayTeamId);
          } else if (isSemis) {
            if (m.homeTeamId && !isPlaceholder(m.homeTeamId)) semisTeams.add(m.homeTeamId);
            if (m.awayTeamId && !isPlaceholder(m.awayTeamId)) semisTeams.add(m.awayTeamId);
          }
        }
      });

      if (oitavasTeams.size > 0) {
        groupClassifications["Oitavas"] = Array.from(oitavasTeams);
      }
      if (quartasTeams.size > 0) {
        groupClassifications["Quartas"] = Array.from(quartasTeams);
      }
      if (semisTeams.size > 0) {
        groupClassifications["Semis"] = Array.from(semisTeams);
      }
    }

    return {
      topScorer: {
        player: comp.topScorerName || "",
        goals: comp.topScorerGoals || 0,
      },
      championTeamId: comp.championTeamId || "",
      bestPlayer: comp.bestPlayerName || "",
      bestGoalkeeper: comp.bestGoalkeeperName || "",
      mostGoalsTeamId: comp.mostGoalsTeamId || "",
      mostConcededTeamId: comp.mostConcededTeamId || "",
      groupClassifications,
    };
  }, [db.competitions, db.teamStandings, db.matches, activeCompetitionCode]);

  // Lê config do admin: se auto-sync está ativo e qual é o intervalo
  const isAutoSyncEnabled = db.systemConfig.is_auto_sync_enabled;
  const syncInterval = db.systemConfig.sync_interval_ms;

  // --- BACKGROUND SYNC (universal — roda para qualquer usuário logado) ---
  // Substitui o antigo setInterval que só rodava para admins.
  // Qualquer usuário autenticado verifica se o lastSync expirou e dispara
  // o sync passivamente, sem feedback visual.
  useBackgroundSync({
    competitions: db.competitions,
    groups: db.groups,
    syncIntervalMs: syncInterval || 5 * 60 * 1000,
    syncFn: (code) =>
      syncMatchesAndStandings(code, false, { isBackgroundSync: true }),
    enabled: isAutoSyncEnabled,
    onSyncStart: onBackgroundSyncStart,
    onSyncEnd: onBackgroundSyncEnd,
  });


  const toggleAutoSync = useCallback(() => {
    if (!canWriteData) return;
    db.updateSystemConfig({ is_auto_sync_enabled: !isAutoSyncEnabled });
  }, [canWriteData, db, isAutoSyncEnabled]);

  const lockDate = useMemo(() => {
    if (matches.length === 0) return null;
    const dates = matches.map((m) => new Date(m.date).getTime());
    return new Date(Math.min(...dates)).toISOString();
  }, [matches]);

  const computedSyncStatus = useMemo(() => {
    const computed: Record<string, CompetitionSyncStatus> = { ...syncStatusByCompetition };
    
    db.competitions.forEach(comp => {
      const dbSyncTime = comp.lastSync;
      if (dbSyncTime) {
        const local = computed[comp.code];
        if (!local || !local.lastSuccessAt || new Date(dbSyncTime) > new Date(local.lastSuccessAt)) {
          computed[comp.code] = {
            ...local,
            competitionCode: comp.code,
            lastSuccess: true,
            lastSuccessAt: dbSyncTime,
            lastAttemptAt: dbSyncTime,
            lastOperation: "combined",
            isSyncing: local?.isSyncing || false,
          };
        }
      }
    });
    
    return computed;
  }, [syncStatusByCompetition, db.competitions]);

  const simulateLiveGame = useCallback(async (matchId: string) => {
    // Implementação simplificada ou mantida de useMatchSystem original
    console.log("Simulando jogo ao vivo:", matchId);
    // ...
  }, []);

  return {
    matches,
    tournamentResults,
    lockDate,
    simulateLiveGame,
    syncWithExternalApi,
    syncStandingsWithExternalApi,
    syncMatchesAndStandings: (
      code: string,
      manual?: boolean,
      options?: { isBackgroundSync?: boolean }
    ) => syncMatchesAndStandings(code, manual, options),
    syncStatusByCompetition: computedSyncStatus,
    isSyncing,
    isAutoSyncEnabled,
    toggleAutoSync,
    adminControls: {
      startMatch: (id: string) => db.updateMatch(id, { status: MatchStatus.LIVE, resultHome: 0, resultAway: 0 }),
      updateLiveScore: (id: string, h: number, a: number) => { registerAdminOverride(id); return db.updateMatch(id, { status: MatchStatus.LIVE, resultHome: h, resultAway: a }); },
      finishMatch: (id: string, h: number, a: number) => { registerAdminOverride(id); return db.updateMatch(id, { status: MatchStatus.FINISHED, resultHome: h, resultAway: a }); },
    },
  };
};
