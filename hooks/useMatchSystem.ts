import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Match, MatchStatus, Team, TeamDB, TournamentPredictions } from "../types";
import { useDatabase } from "../contexts/DatabaseContext";
import { usePointsProcessor } from "./usePointsProcessor";
import { useSyncSystem, CompetitionSyncStatus, TBD_HOME_TEAM_ID, TBD_AWAY_TEAM_ID } from "./useSyncSystem";
import { useBackgroundSync } from "./useBackgroundSync";
import { CURRENT_VERSION } from "../data/releases";
export type { CompetitionSyncStatus };

const normalizeCompetitionCode = (value?: string) =>
  (value || "WC").toUpperCase();

export const useMatchSystem = (
  activeCompetitionCode: string = "WC",
  canWriteData: boolean = false,
  onBackgroundSyncStart?: (code: string) => void,
  onBackgroundSyncEnd?: (code: string, success: boolean, message: string) => void,
  onVersionOutdated?: () => void,
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
        // Para jogos TBD (sentinela UUID), usar placeholder visual; palpites serão bloqueados.
        const isHomeTbd = !m.homeTeamId || m.homeTeamId === TBD_HOME_TEAM_ID;
        const isAwayTbd = !m.awayTeamId || m.awayTeamId === TBD_AWAY_TEAM_ID;
        if (!homeTeam && !isHomeTbd) return null;
        if (!awayTeam && !isAwayTbd) return null;

        const TBD_TEAM = { id: "", name: "A Definir", code: "TBD", flag: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23475569'/%3E%3Ctext x='32' y='44' font-family='Arial' font-size='28' font-weight='bold' fill='%23ffffff' text-anchor='middle'%3E%3F%3C/text%3E%3C/svg%3E", ranking: undefined };
        const resolvedHome = homeTeam ?? TBD_TEAM;
        const resolvedAway = awayTeam ?? TBD_TEAM;

        return {
          ...m,
          homeTeam: resolvedHome,
          awayTeam: resolvedAway,
          status: m.status as MatchStatus,
          result: m.resultHome != null ? { home: m.resultHome, away: m.resultAway! } : undefined,
          score: m.score,
          penaltiesHome: m.penaltiesHome,
          penaltiesAway: m.penaltiesAway,
        } as Match;
      })
      .filter((m): m is Match => m !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [db.matches, db.teams, activeCompetitionCode]);

  useEffect(() => {
    const liveMatches = matches.filter(
      m => (m.status === MatchStatus.LIVE || m.status === MatchStatus.DELAYED) && m.result != null
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
      // ONLY after all group-stage matches are FINISHED (same gate as usePointsProcessor)
      const GROUP_STAGE_PATTERN = /^(GROUP[_\s]+[A-L]|Grupo\s+[A-L])$/i;
      const compGroupMatches = db.matches.filter((m) => {
        if ((m.competitionCode || 'WC').toUpperCase() !== normalizeCompetitionCode(activeCompetitionCode)) return false;
        return GROUP_STAGE_PATTERN.test((m.group || '').trim());
      });

      const groupStageComplete =
        compGroupMatches.length > 0 &&
        compGroupMatches.every((m) => m.status === MatchStatus.FINISHED);

      if (groupStageComplete) {
        db.teamStandings.forEach((standing) => {
          if (
            normalizeCompetitionCode(standing.competitionCode) !==
              normalizeCompetitionCode(activeCompetitionCode) ||
            !standing.group ||
            standing.position == null ||
            (standing.position !== 1 && standing.position !== 2)
          ) return;

          // Normalize API format GROUP_A → Grupo A (also handles already-normalized Grupo A)
          const raw = standing.group.trim();
          const apiMatch = /^GROUP[_\s]+([A-Z])$/i.exec(raw);
          const normalizedGroup = apiMatch
            ? `Grupo ${apiMatch[1].toUpperCase()}`
            : raw.startsWith("Grupo")
            ? raw
            : null;
          if (!normalizedGroup) return;

          if (!groupClassifications[normalizedGroup]) {
            groupClassifications[normalizedGroup] = [];
          }
          groupClassifications[normalizedGroup][standing.position - 1] = standing.teamId;
        });
      }
    }

    // --- KNOCKOUT CLASSIFICATIONS ---
    // Admin override takes precedence over computed data
    if (comp.knockoutClassifications && Object.keys(comp.knockoutClassifications).length > 0) {
      // Use admin-set knockout classifications
      if (comp.knockoutClassifications["DezesseisAvos"]) {
        groupClassifications["DezesseisAvos"] = comp.knockoutClassifications["DezesseisAvos"];
      }
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
      const dezesseisAvosTeams = new Set<string>();
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

          const isDezesseisAvos = stage.includes("ROUND_OF_32") || stage.includes("LAST_32") || groupStr.includes("16_AVOS") || groupStr.includes("16AVOS");
          const isOitavas = stage.includes("ROUND_OF_16") || groupStr.includes("OITAVAS");
          const isQuartas = stage.includes("QUARTER") || groupStr.includes("QUARTAS");
          const isSemis = stage.includes("SEMI") || groupStr.includes("SEMI");

          if (isDezesseisAvos) {
            if (m.homeTeamId && !isPlaceholder(m.homeTeamId)) dezesseisAvosTeams.add(m.homeTeamId);
            if (m.awayTeamId && !isPlaceholder(m.awayTeamId)) dezesseisAvosTeams.add(m.awayTeamId);
          } else if (isOitavas) {
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

      if (dezesseisAvosTeams.size > 0) {
        groupClassifications["DezesseisAvos"] = Array.from(dezesseisAvosTeams);
      }
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
      topScorerPlayerId: undefined, // user predictions have this, not actual
      topScorerPlayerIds: comp.topScorerPlayerIds || [],
      championTeamId: comp.championTeamId || "",
      bestPlayer: comp.bestPlayerName || "",
      bestGoalkeeper: comp.bestGoalkeeperName || "",
      mostGoalsTeamId: comp.mostGoalsTeamId || "",
      mostConcededTeamId: comp.mostConcededTeamId || "",
      mostGoalsTeamIds: comp.mostGoalsTeamIds || [],
      mostConcededTeamIds: comp.mostConcededTeamIds || [],
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
      syncMatchesAndStandings(code, false, { 
        isBackgroundSync: true,
        onSyncStart: onBackgroundSyncStart 
      }),
    enabled: isAutoSyncEnabled,
    onSyncStart: onBackgroundSyncStart,
    onSyncEnd: onBackgroundSyncEnd,
    currentVersion: CURRENT_VERSION,
    onVersionOutdated,
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
      finishMatch: async (id: string, h: number, a: number) => {
        registerAdminOverride(id);
        await db.updateMatch(id, { status: MatchStatus.FINISHED, resultHome: h, resultAway: a });
        
        // Obter a partida para determinar os grupos afetados por este campeonato
        const match = dbRef.current.matches.find((m: any) => m.id === id);
        if (match) {
          const compCode = (match.competitionCode || "WC").toUpperCase();
          const affectedGroupIds = (dbRef.current.groups || [])
            .filter((g: any) => (g.competitionCode || "WC").toUpperCase() === compCode)
            .map((g: any) => g.id);

          if (affectedGroupIds.length > 0) {
            console.log(`[ADMIN] Jogo finalizado manualmente. Recalculando pontos para os grupos:`, affectedGroupIds);
            await recalculateUserGroupPoints(affectedGroupIds);
          }
        }
      },
    },
  };
};
