import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Match, MatchStatus, TeamDB, TournamentPredictions } from "../types";
import { useDatabase } from "../contexts/DatabaseContext";
import {
  fetchExternalStandings,
  fetchExternalMatches,
  findInternalMatch,
  mapExternalStatusToInternal,
} from "../services/liveScoreService";

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

export const useMatchSystem = (
  activeCompetitionCode: string = "WC",
  canWriteData: boolean = false,
) => {
  const db = useDatabase();
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
  const dbRef = useRef(db);
  const isSyncingRef = useRef(false);
  const nextAllowedSyncAtRef = useRef(0);

  const updateSyncStatus = useCallback(
    (
      competitionCode: string,
      patch: Partial<CompetitionSyncStatus> &
        Pick<CompetitionSyncStatus, "lastOperation">,
    ) => {
      const normalizedCode = normalizeCompetitionCode(competitionCode);
      setSyncStatusByCompetition((prev) => {
        const current = prev[normalizedCode] || {
          competitionCode: normalizedCode,
        };
        return {
          ...prev,
          [normalizedCode]: {
            ...current,
            competitionCode: normalizedCode,
            ...patch,
          },
        };
      });
    },
    [],
  );

  useEffect(() => {
    localStorage.setItem(
      SYNC_STATUS_STORAGE_KEY,
      JSON.stringify(syncStatusByCompetition),
    );
  }, [syncStatusByCompetition]);

  useEffect(() => {
    dbRef.current = db;
  }, [db]);

  // Use DB config instead of local state
  const isAutoSyncEnabled = db.systemConfig.is_auto_sync_enabled;
  const syncInterval = db.systemConfig.sync_interval_ms;

  // Hydrate Matches (Join with Teams and Stadiums)
  const matches: Match[] = useMemo(() => {
    if (!db.matches) return []; // Safety check
    const hydrated = db.matches
      .map((m) => {
        const homeTeam = db.teams.find((t) => t.id === m.homeTeamId);
        const awayTeam = db.teams.find((t) => t.id === m.awayTeamId);
        const stadium = db.stadiums.find((s) => s.id === m.stadiumId);

        if (!homeTeam || !awayTeam) return null;

        return {
          id: m.id,
          homeTeam,
          awayTeam,
          date: m.date,
          group: m.group,
          competitionCode: normalizeCompetitionCode(m.competitionCode),
          location: stadium ? stadium.name : "Unknown",
          stadiumId: m.stadiumId,
          status: m.status,
          result:
            m.resultHome != null && m.resultAway != null
              ? { home: m.resultHome, away: m.resultAway }
              : undefined,
        };
      })
      .filter(Boolean) as Match[];

    return hydrated.filter(
      (match) =>
        normalizeCompetitionCode(match.competitionCode) ===
        normalizeCompetitionCode(activeCompetitionCode),
    );
  }, [db.matches, db.teams, db.stadiums, activeCompetitionCode]);

  // Keep a ref to matches to access the latest state inside the interval closure/async operations
  const matchesRef = useRef(matches);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  // Mock Tournament Results logic
  const tournamentResults = useMemo<TournamentPredictions | undefined>(() => {
    const sys = db.tournamentPredictions.find(
      (tp) => tp.userId === "SYSTEM_RESULTS",
    );
    if (sys) {
      return {
        championTeamId: sys.championTeamId,
        topScorer: {
          player: sys.topScorerPlayer || "",
          goals: sys.topScorerGoals || 0,
        },
        bestPlayer: sys.bestPlayer,
        bestGoalkeeper: sys.bestGoalkeeper,
      };
    }
    return undefined;
  }, [db.tournamentPredictions]);

  const simulateLiveGame = () => {
    const scheduledMatches = db.matches.filter(
      (m) => m.status === MatchStatus.SCHEDULED,
    );
    if (scheduledMatches.length > 0) {
      const randomMatch = scheduledMatches[0];
      const simHome = Math.floor(Math.random() * 4);
      const simAway = Math.floor(Math.random() * 4);

      db.updateMatch(randomMatch.id, {
        status: MatchStatus.FINISHED,
        resultHome: simHome,
        resultAway: simAway,
      });
    }
  };

  // --- SYNC EXTERNAL API ---
  const syncWithExternalApi = useCallback(
    async (competitionCode = activeCompetitionCode) => {
      const normalizedCompetitionCode =
        normalizeCompetitionCode(competitionCode);

      if (!canWriteData) {
        return {
          success: false,
          message:
            "Somente administradores podem sincronizar e persistir dados no banco.",
        };
      }

      // Prevent multiple overlapping calls
      if (isSyncingRef.current) {
        updateSyncStatus(normalizedCompetitionCode, {
          lastOperation: "matches",
          lastAttemptAt: new Date().toISOString(),
          lastSuccess: false,
          lastMessage: "Sincronizacao ignorada: ja existe uma em andamento.",
        });
        return { success: false, message: "Já está sincronizando." };
      }

      const now = Date.now();
      if (now < nextAllowedSyncAtRef.current) {
        const waitSeconds = Math.ceil(
          (nextAllowedSyncAtRef.current - now) / 1000,
        );
        updateSyncStatus(normalizedCompetitionCode, {
          lastOperation: "matches",
          lastAttemptAt: new Date().toISOString(),
          lastSuccess: false,
          lastMessage: `Rate limit ativo. Tente novamente em ${waitSeconds}s.`,
        });
        return {
          success: false,
          message: `Aguardando limite da API. Tente novamente em ${waitSeconds}s.`,
        };
      }

      isSyncingRef.current = true;
      setIsSyncing(true);
      updateSyncStatus(normalizedCompetitionCode, {
        lastOperation: "matches",
        lastAttemptAt: new Date().toISOString(),
        isSyncing: true,
      });
      try {
        const externalMatches = await fetchExternalMatches(
          normalizedCompetitionCode,
        );
        if (externalMatches.length === 0) {
          console.log(
            "Nenhum jogo retornado pela API externa (ou token inválido/rate limit).",
          );
          isSyncingRef.current = false;
          setIsSyncing(false);
          updateSyncStatus(normalizedCompetitionCode, {
            lastOperation: "matches",
            lastSuccess: false,
            lastMessage: "Sem dados de jogos na API.",
            isSyncing: false,
          });
          return { success: false, message: "Sem dados da API." };
        }

        const currentDb = dbRef.current;

        let updatedCount = 0;
        let insertedCount = 0;
        let skippedUndefinedTeams = 0;
        const ensuredTeams = new Map<string, string>();

        const normalizeMatchGroup = (group?: string | null, stage?: string) => {
          const raw = (group || stage || "Copa do Mundo").trim();
          const underscorePattern = /^GROUP_([A-Z])$/i.exec(raw);
          if (underscorePattern) return `Grupo ${underscorePattern[1]}`;

          const spacedPattern = /^GROUP\s+([A-Z])$/i.exec(raw);
          if (spacedPattern) return `Grupo ${spacedPattern[1]}`;

          return raw;
        };

        // Use matchesRef.current to ensure we are comparing against the latest state
        const currentMatches = matchesRef.current;

        for (const extMatch of externalMatches) {
          if (!extMatch.homeTeam?.tla || !extMatch.awayTeam?.tla) {
            skippedUndefinedTeams++;
            continue;
          }

          const homeCode = extMatch.homeTeam.tla.toLowerCase();
          const awayCode = extMatch.awayTeam.tla.toLowerCase();

          const ensureTeam = async (
            code: string,
            team: {
              id: number;
              name: string;
              shortName?: string;
              tla: string;
              crest?: string;
            },
          ) => {
            const normalizedCode = code.toUpperCase();
            const cachedId = ensuredTeams.get(normalizedCode);
            if (cachedId) return cachedId;

            const existing = currentDb.teams.find(
              (t) => t.id === code || t.code.toLowerCase() === code,
            );

            const crestUrl =
              team.crest ||
              (typeof team.id === "number"
                ? `https://crests.football-data.org/${team.id}.svg`
                : "");
            const teamName = team.name || team.shortName || team.tla;

            if (existing) {
              if (crestUrl && existing.flag !== crestUrl) {
                const updated = await currentDb.upsertTeam({
                  ...existing,
                  flag: crestUrl,
                });
                ensuredTeams.set(normalizedCode, updated.id);
                return updated.id;
              }
              ensuredTeams.set(normalizedCode, existing.id);
              return existing.id;
            }

            const newTeam: TeamDB = {
              id: crypto.randomUUID(),
              name: teamName,
              code: code.toUpperCase(),
              flag: crestUrl || "/favicon.ico",
              ranking: 999,
              pot: 4,
            };

            const persisted = await currentDb.upsertTeam(newTeam);
            ensuredTeams.set(normalizedCode, persisted.id);
            return persisted.id;
          };

          const homeTeamId = await ensureTeam(homeCode, extMatch.homeTeam);
          const awayTeamId = await ensureTeam(awayCode, extMatch.awayTeam);

          const existingByExternalId = currentDb.matches.find(
            (m) => m.externalMatchId === String(extMatch.id),
          );
          const internalMatch = findInternalMatch(extMatch, currentMatches);

          if (internalMatch || existingByExternalId) {
            const targetId = internalMatch?.id || existingByExternalId!.id;
            const newStatus = mapExternalStatusToInternal(extMatch.status);
            const newGroup = normalizeMatchGroup(
              extMatch.group,
              extMatch.stage,
            );

            // Safe access to scores with optional chaining
            const extHome = extMatch.score?.fullTime?.home;
            const extAway = extMatch.score?.fullTime?.away;

            // Atualiza apenas se mudou status ou placar
            const currentHome =
              internalMatch?.result?.home ?? existingByExternalId?.resultHome;
            const currentAway =
              internalMatch?.result?.away ?? existingByExternalId?.resultAway;

            const scoreChanged =
              (extHome != null && currentHome !== extHome) ||
              (extAway != null && currentAway !== extAway);

            const currentStatus =
              internalMatch?.status ?? existingByExternalId?.status;
            const statusChanged = currentStatus !== newStatus;

            const currentGroup =
              internalMatch?.group ?? existingByExternalId?.group;
            const groupChanged = currentGroup !== newGroup;

            if (scoreChanged || statusChanged || groupChanged) {
              await currentDb.updateMatch(targetId, {
                status: newStatus,
                group: newGroup,
                competitionCode: normalizedCompetitionCode,
                // Use null coalescing to ensure undefined if null, or the value
                resultHome: extHome ?? undefined,
                resultAway: extAway ?? undefined,
              });
              updatedCount++;
            }
          } else {
            const newStatus = mapExternalStatusToInternal(extMatch.status);
            const extHome = extMatch.score?.fullTime?.home;
            const extAway = extMatch.score?.fullTime?.away;

            const newMatchId = crypto.randomUUID();

            await currentDb.upsertMatch({
              id: newMatchId,
              externalMatchId: String(extMatch.id),
              homeTeamId,
              awayTeamId,
              date: extMatch.utcDate,
              group: normalizeMatchGroup(extMatch.group, extMatch.stage),
              competitionCode: normalizedCompetitionCode,
              stadiumId: null,
              status: newStatus,
              resultHome: extHome ?? undefined,
              resultAway: extAway ?? undefined,
            });
            insertedCount++;
          }
        }

        isSyncingRef.current = false;
        setIsSyncing(false);
        const successMessage = `${updatedCount} atualizados, ${insertedCount} inseridos${skippedUndefinedTeams > 0 ? `, ${skippedUndefinedTeams} pulados (times indefinidos)` : ""}.`;
        updateSyncStatus(normalizedCompetitionCode, {
          lastOperation: "matches",
          lastSuccess: true,
          lastSuccessAt: new Date().toISOString(),
          lastMessage: successMessage,
          isSyncing: false,
        });
        return {
          success: true,
          message: successMessage,
        };
      } catch (error: any) {
        console.error("Erro no Sync:", error);

        const rawMessage = String(error?.message || "");
        const normalizedMessage = rawMessage.toLowerCase();

        if (
          normalizedMessage.includes("permission denied") &&
          normalizedMessage.includes("teams")
        ) {
          isSyncingRef.current = false;
          setIsSyncing(false);
          updateSyncStatus(normalizedCompetitionCode, {
            lastOperation: "matches",
            lastSuccess: false,
            lastMessage:
              "Sem permissao para gravar em teams. Aplique a policy SQL de sync.",
            isSyncing: false,
          });
          return {
            success: false,
            message:
              "Sem permissão para gravar em teams. Aplique a policy SQL de sync para authenticated em teams/matches e tente novamente.",
          };
        }

        const rateLimitMatch = /RATE_LIMIT_(\d+)/.exec(error?.message || "");
        if (rateLimitMatch) {
          const waitSeconds = Number(rateLimitMatch[1]) || 30;
          nextAllowedSyncAtRef.current = Date.now() + waitSeconds * 1000;
        }

        isSyncingRef.current = false;
        setIsSyncing(false);
        updateSyncStatus(normalizedCompetitionCode, {
          lastOperation: "matches",
          lastSuccess: false,
          lastMessage: error?.message || "Erro ao salvar jogos no banco.",
          isSyncing: false,
        });
        return {
          success: false,
          message: error?.message || "Erro ao salvar dados no banco.",
        };
      }
    },
    [activeCompetitionCode, canWriteData, updateSyncStatus],
  );

  const normalizeGroupName = useCallback((groupName: string) => {
    const m = /^Group\s+([A-Z])$/i.exec(groupName.trim());
    if (!m) return groupName;
    return `Grupo ${m[1]}`;
  }, []);

  const syncStandingsWithExternalApi = useCallback(
    async (competitionCode = activeCompetitionCode) => {
      const normalizedCompetitionCode =
        normalizeCompetitionCode(competitionCode);

      if (!canWriteData) {
        return {
          success: false,
          message:
            "Somente administradores podem sincronizar e persistir dados no banco.",
        };
      }

      updateSyncStatus(normalizedCompetitionCode, {
        lastOperation: "standings",
        lastAttemptAt: new Date().toISOString(),
        isSyncing: true,
      });
      try {
        const data = await fetchExternalStandings(
          normalizedCompetitionCode,
          "2026",
        );
        if (!data || !Array.isArray(data.standings)) {
          updateSyncStatus(normalizedCompetitionCode, {
            lastOperation: "standings",
            lastSuccess: false,
            lastMessage: "Sem dados de tabela na API.",
            isSyncing: false,
          });
          return { success: false, message: "Sem dados de tabela na API." };
        }

        const groupsData = data.standings.filter(
          (entry) => entry.type === "TOTAL" && Array.isArray(entry.table),
        );

        if (groupsData.length === 0) {
          updateSyncStatus(normalizedCompetitionCode, {
            lastOperation: "standings",
            lastSuccess: false,
            lastMessage: "Nenhum grupo valido encontrado na tabela.",
            isSyncing: false,
          });
          return { success: false, message: "Nenhum grupo válido na tabela." };
        }

        const currentDb = dbRef.current;
        const updatedAt = new Date().toISOString();
        let upsertedTeams = 0;

        for (const groupEntry of groupsData) {
          const resolvedStandingsGroup = normalizeGroupName(
            groupEntry.group ||
              (groupEntry.stage === "REGULAR_SEASON"
                ? "Temporada Regular"
                : groupEntry.stage || "Classificacao Geral"),
          );

          for (const row of groupEntry.table) {
            const code = (row.team?.tla || "").toUpperCase();
            if (!code) continue;

            const existing = currentDb.teams.find(
              (t) =>
                t.code.toUpperCase() === code ||
                (typeof row.team?.id === "number" &&
                  t.externalTeamId === row.team.id),
            );

            const payload: TeamDB = {
              id: existing?.id || crypto.randomUUID(),
              name: row.team?.name || existing?.name || code,
              code,
              flag: row.team?.crest || existing?.flag || "/favicon.ico",
              ranking: existing?.ranking || 999,
              pot: existing?.pot,
              externalTeamId: row.team?.id,
              standingsCompetitionCode: normalizedCompetitionCode,
              standingsSeason: "2026",
              standingsStage: groupEntry.stage,
              standingsType: groupEntry.type,
              standingsGroup: resolvedStandingsGroup,
              standingsPosition: row.position,
              standingsPlayedGames: row.playedGames,
              standingsForm: row.form,
              standingsWon: row.won,
              standingsDraw: row.draw,
              standingsLost: row.lost,
              standingsPoints: row.points,
              standingsGoalsFor: row.goalsFor,
              standingsGoalsAgainst: row.goalsAgainst,
              standingsGoalDifference: row.goalDifference,
              standingsUpdatedAt: updatedAt,
            };

            await currentDb.upsertTeam(payload);
            upsertedTeams++;
          }
        }

        const successMessage = `${upsertedTeams} linhas de tabela atualizadas.`;
        updateSyncStatus(normalizedCompetitionCode, {
          lastOperation: "standings",
          lastSuccess: true,
          lastSuccessAt: new Date().toISOString(),
          lastMessage: successMessage,
          isSyncing: false,
        });
        return {
          success: true,
          message: successMessage,
        };
      } catch (error: any) {
        updateSyncStatus(normalizedCompetitionCode, {
          lastOperation: "standings",
          lastSuccess: false,
          lastMessage: error?.message || "Erro ao sincronizar tabela.",
          isSyncing: false,
        });
        return {
          success: false,
          message: error?.message || "Erro ao sincronizar tabela.",
        };
      }
    },
    [activeCompetitionCode, canWriteData, normalizeGroupName, updateSyncStatus],
  );

  const syncMatchesAndStandings = useCallback(
    async (competitionCode = activeCompetitionCode) => {
      const normalizedCompetitionCode =
        normalizeCompetitionCode(competitionCode);
      const runStartedAt = new Date().toISOString();

      if (!canWriteData) {
        return {
          success: false,
          message:
            "Somente administradores podem sincronizar e persistir dados no banco.",
          matchesResult: {
            success: false,
            message:
              "Operacao bloqueada para usuario sem permissao de escrita.",
          },
          standingsResult: {
            success: false,
            message:
              "Operacao bloqueada para usuario sem permissao de escrita.",
          },
        };
      }

      const standingsResult = await syncStandingsWithExternalApi(
        normalizedCompetitionCode,
      );
      const matchesResult = await syncWithExternalApi(
        normalizedCompetitionCode,
      );

      const combinedSuccess = matchesResult.success || standingsResult.success;
      const combinedMessage = `Jogos: ${matchesResult.message} | Tabela: ${standingsResult.message}`;

      updateSyncStatus(normalizedCompetitionCode, {
        lastOperation: "combined",
        lastAttemptAt: runStartedAt,
        lastSuccess: combinedSuccess,
        lastSuccessAt: combinedSuccess ? new Date().toISOString() : undefined,
        lastMessage: combinedMessage,
        isSyncing: false,
      });

      return {
        success: combinedSuccess,
        message: combinedMessage,
        matchesResult,
        standingsResult,
      };
    },
    [
      activeCompetitionCode,
      canWriteData,
      syncStandingsWithExternalApi,
      syncWithExternalApi,
      updateSyncStatus,
    ],
  );

  // --- AUTO SYNC POLLING EFFECT ---
  useEffect(() => {
    let intervalId: any;

    if (canWriteData && isAutoSyncEnabled) {
      console.log(
        `🔄 Auto-Sync ATIVO via Banco de Dados. Intervalo: ${syncInterval}ms`,
      );
      // Run immediately
      void syncWithExternalApi(activeCompetitionCode);

      intervalId = setInterval(() => {
        console.log("🔄 Auto-Sync: Buscando atualizações...");
        void syncWithExternalApi(activeCompetitionCode);
      }, syncInterval || 60000);
    } else {
      console.log("⏹️ Auto-Sync PARADO (Configuração Global)");
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    activeCompetitionCode,
    canWriteData,
    isAutoSyncEnabled,
    syncInterval,
    syncWithExternalApi,
  ]);

  const toggleAutoSync = useCallback(() => {
    if (!canWriteData) return;
    // Now toggles DB Value
    db.updateSystemConfig({ is_auto_sync_enabled: !isAutoSyncEnabled });
  }, [canWriteData, db, isAutoSyncEnabled]);

  // --- ADMIN LIVE CONTROLS ---

  const startMatch = (matchId: string) => {
    db.updateMatch(matchId, {
      status: MatchStatus.LIVE,
      resultHome: 0,
      resultAway: 0,
    });
  };

  const updateLiveScore = (matchId: string, home: number, away: number) => {
    // Keeps status as LIVE, just updates score
    db.updateMatch(matchId, {
      resultHome: home,
      resultAway: away,
    });
  };

  const finishMatch = (matchId: string, home: number, away: number) => {
    db.updateMatch(matchId, {
      status: MatchStatus.FINISHED,
      resultHome: home,
      resultAway: away,
    });
  };

  const lockDate = useMemo(() => {
    if (matches.length === 0) return new Date();
    const dates = matches.map((m) => new Date(m.date).getTime());
    return new Date(Math.min(...dates));
  }, [matches]);

  return {
    matches,
    tournamentResults,
    lockDate,
    simulateLiveGame,
    syncWithExternalApi,
    syncStandingsWithExternalApi,
    syncMatchesAndStandings,
    syncStatusByCompetition,
    isSyncing,
    isAutoSyncEnabled,
    toggleAutoSync,
    adminControls: {
      startMatch,
      updateLiveScore,
      finishMatch,
    },
  };
};
