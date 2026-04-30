import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Match, MatchStatus, Team, TeamDB, TournamentPredictions } from "../types";
import { calculatePoints } from "../utils/scoring";
import { useDatabase } from "../contexts/DatabaseContext";
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
  const syncingCompetitionsRef = useRef<Set<string>>(new Set());
  const nextAllowedSyncAtRef = useRef(0);
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
          stage: m.stage,
          matchday: m.matchday,
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
    console.log("Simulação desativada para proteger integridade dos dados.");
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
      if (syncingCompetitionsRef.current.has(normalizedCompetitionCode)) {
        updateSyncStatus(normalizedCompetitionCode, {
          lastOperation: "matches",
          lastAttemptAt: new Date().toISOString(),
          lastSuccess: false,
          lastMessage:
            "Sincronizacao ignorada: esta competicao ja esta em andamento.",
        });
        return {
          success: false,
          message: "Esta competição já está sincronizando.",
        };
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

      syncingCompetitionsRef.current.add(normalizedCompetitionCode);
      setIsSyncing(true);
      updateSyncStatus(normalizedCompetitionCode, {
        lastOperation: "matches",
        lastAttemptAt: new Date().toISOString(),
        isSyncing: true,
      });
      try {
        const isWorldCupSync = normalizedCompetitionCode === "WC";
        const wcRankingMap = isWorldCupSync ? await getWcRankingMap() : {};

        const externalMatches = await fetchExternalMatches(
          normalizedCompetitionCode,
        );
        if (externalMatches.length === 0) {
          console.log(
            "Nenhum jogo retornado pela API externa (ou token inválido/rate limit).",
          );
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
        const matchesToUpsert: any[] = [];

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

        const buildUniqueTeamCode = (
          baseCode: string,
          externalId?: number,
          preferredName?: string,
        ) => {
          const cleanedBase =
            (baseCode || "TBD")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 3) || "TBD";

          const codeExists = (value: string) =>
            currentDb.teams.some((t) => t.code.toUpperCase() === value);

          if (!codeExists(cleanedBase)) {
            return cleanedBase;
          }

          const acronym = (preferredName || "")
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 3);

          if (acronym && !codeExists(acronym)) {
            return acronym;
          }

          if (typeof externalId === "number") {
            const suffix = String(externalId).slice(-3);
            const withId = `${cleanedBase}${suffix}`.slice(0, 6);
            if (!codeExists(withId)) {
              return withId;
            }
          }

          let idx = 1;
          while (idx < 1000) {
            const candidate = `${cleanedBase}${idx}`.slice(0, 6);
            if (!codeExists(candidate)) {
              return candidate;
            }
            idx += 1;
          }

          return `${cleanedBase}${Date.now()}`.slice(0, 10);
        };

        for (const extMatch of externalMatches) {
          if (!extMatch.homeTeam?.tla || !extMatch.awayTeam?.tla) {
            skippedUndefinedTeams++;
            continue;
          }

          const ensureTeam = async (team: {
            id: number;
            name: string;
            shortName?: string;
            tla: string;
            crest?: string;
          }) => {
            const normalizedCode = (team.tla || "TBD").toUpperCase();
            const externalId =
              typeof team.id === "number" && Number.isFinite(team.id)
                ? team.id
                : undefined;
            const cacheKey = externalId
              ? `ext:${externalId}`
              : `code:${normalizedCode}`;

            const cachedId = ensuredTeams.get(cacheKey);
            if (cachedId) return cachedId;

            const existing =
              (typeof externalId === "number"
                ? currentDb.teams.find((t) => t.externalTeamId === externalId)
                : undefined) ||
              (!externalId
                ? currentDb.teams.find(
                    (t) => t.code.toUpperCase() === normalizedCode,
                  )
                : undefined);

            const crestUrl =
              team.crest ||
              (typeof team.id === "number"
                ? `https://crests.football-data.org/${team.id}.svg`
                : "");
            const teamName = team.name || team.shortName || team.tla;

            if (existing) {
              const rankingFromMap = wcRankingMap[normalizedCode];
              const shouldRefreshRanking =
                isWorldCupSync &&
                rankingFromMap > 0 &&
                (!existing.ranking || existing.ranking === 999);

              const shouldBackfillExternalId =
                typeof externalId === "number" &&
                existing.externalTeamId == null;

              if (
                (crestUrl && existing.flag !== crestUrl) ||
                shouldRefreshRanking ||
                shouldBackfillExternalId
              ) {
                const updated = await currentDb.upsertTeam({
                  ...existing,
                  flag: crestUrl,
                  ranking: shouldRefreshRanking
                    ? rankingFromMap
                    : existing.ranking,
                  externalTeamId: shouldBackfillExternalId
                    ? externalId
                    : existing.externalTeamId,
                });
                ensuredTeams.set(cacheKey, updated.id);
                return updated.id;
              }
              ensuredTeams.set(cacheKey, existing.id);
              return existing.id;
            }

            const uniqueCode = buildUniqueTeamCode(
              normalizedCode,
              externalId,
              teamName,
            );

            const newTeam: TeamDB = {
              id: crypto.randomUUID(),
              name: teamName,
              code: uniqueCode,
              flag: crestUrl || "/favicon.ico",
              ranking: wcRankingMap[normalizedCode] || 999,
              pot: 4,
              externalTeamId: externalId,
            };

            const persisted = await currentDb.upsertTeam(newTeam);
            ensuredTeams.set(cacheKey, persisted.id);
            return persisted.id;
          };

          const homeTeamId = await ensureTeam(extMatch.homeTeam);
          const awayTeamId = await ensureTeam(extMatch.awayTeam);

          if (!homeTeamId || !awayTeamId) {
            skippedUndefinedTeams++;
            continue;
          }

          const existingByExternalId = currentDb.matches.find(
            (m) => m.externalMatchId === String(extMatch.id),
          );
          const internalMatch = existingByExternalId
            ? undefined
            : findInternalMatch(extMatch, currentMatches);
          const targetId = existingByExternalId?.id || internalMatch?.id;
          const status = mapExternalStatusToInternal(extMatch.status);

          // Safety: Only accept scores if match is LIVE or FINISHED
          const isGameInPlay =
            status === MatchStatus.LIVE || status === MatchStatus.FINISHED;
          const resHome = isGameInPlay ? extMatch.score?.fullTime?.home : null;
          const resAway = isGameInPlay ? extMatch.score?.fullTime?.away : null;

          const matchData = {
            id: targetId || crypto.randomUUID(),
            status: status,
            group: normalizeMatchGroup(extMatch.group, extMatch.stage),
            competitionCode: normalizedCompetitionCode,
            date: extMatch.utcDate,
            stage: extMatch.stage,
            matchday: extMatch.matchday,
            resultHome: resHome ?? undefined,
            resultAway: resAway ?? undefined,
            homeTeamId,
            awayTeamId,
            externalMatchId: String(extMatch.id),
          };

          if (targetId) {
            const existing = currentMatches.find((m) => m.id === targetId);
            const hasChanged =
              !existing ||
              existing.status !== matchData.status ||
              (existing.result?.home !== matchData.resultHome &&
                matchData.resultHome !== undefined) ||
              (existing.result?.away !== matchData.resultAway &&
                matchData.resultAway !== undefined) ||
              existing.group !== matchData.group ||
              existing.date !== matchData.date;

            if (hasChanged) {
              matchesToUpsert.push({ ...matchData, id: targetId });
              updatedCount++;
            }
          } else {
            matchesToUpsert.push({
              ...matchData,
              id: crypto.randomUUID(),
              stadiumId: null,
            });
            insertedCount++;
          }
        }

        // 2. Batch Update to Database
        if (matchesToUpsert.length > 0) {
          await currentDb.upsertMatch(matchesToUpsert as any);
        }

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
          updatedMatches: matchesToUpsert, // Return for point processing
        };
      } catch (error: any) {
        console.error("Erro no Sync:", error);

        const rawMessage = String(error?.message || "");
        const normalizedMessage = rawMessage.toLowerCase();

        if (
          normalizedMessage.includes("permission denied") &&
          normalizedMessage.includes("teams")
        ) {
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
      } finally {
        syncingCompetitionsRef.current.delete(normalizedCompetitionCode);
        setIsSyncing(syncingCompetitionsRef.current.size > 0);
      }
    },
    [canWriteData, getWcRankingMap, updateSyncStatus],
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
        const isWorldCupSync = normalizedCompetitionCode === "WC";
        const wcRankingMap = isWorldCupSync ? await getWcRankingMap() : {};
        const season = getCurrentSeason();
        const data = await fetchExternalStandings(
          normalizedCompetitionCode,
          season,
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

            const existing =
              (typeof row.team?.id === "number"
                ? currentDb.teams.find((t) => t.externalTeamId === row.team.id)
                : undefined) ||
              currentDb.teams.find((t) => t.code.toUpperCase() === code);

            const rankingFromMap = wcRankingMap[code];
            const resolvedRanking =
              existing?.ranking && existing.ranking !== 999
                ? existing.ranking
                : rankingFromMap || existing?.ranking || 999;

            const payload: Team = {
              id: existing?.id || crypto.randomUUID(),
              name: row.team?.name || existing?.name || code,
              code: existing?.code || code,
              flag: row.team?.crest || existing?.flag || "/favicon.ico",
              ranking: resolvedRanking,
              pot: existing?.pot,
              externalTeamId: row.team?.id,
              standingsCompetitionCode: normalizedCompetitionCode,
              standingsSeason: data.filters?.season || season,
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

            const hasChanged =
              !existing ||
              existing.standingsPoints !== payload.standingsPoints ||
              existing.standingsPosition !== payload.standingsPosition ||
              existing.standingsPlayedGames !== payload.standingsPlayedGames ||
              existing.standingsForm !== payload.standingsForm;

            if (hasChanged) {
              await currentDb.upsertTeam(payload);
              upsertedTeams++;
            }
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
    [canWriteData, getWcRankingMap, normalizeGroupName, updateSyncStatus],
  );

  const batchProcessPointsForMatches = async (finishedMatches: Match[]) => {
    if (finishedMatches.length === 0) return;

    // 1. Get all match IDs
    const matchIds = finishedMatches.map((m) => m.id);

    // 2. Get all predictions for these matches
    const { data: predictions, error: pError } = await supabase
      .from("predictions")
      .select("*")
      .in("matchId", matchIds);

    if (pError || !predictions || predictions.length === 0) return;

    const updatesToUpsert: any[] = [];

    for (const pred of predictions) {
      const match = finishedMatches.find((m) => m.id === pred.matchId);
      if (!match || !match.result || !match.homeTeam || !match.awayTeam)
        continue;

      const hR = match.result.home;
      const aR = match.result.away;

      // 3. Calculate points using centralized utility (including rankings for Zebra bonus)
      const pts = calculatePoints(
        pred.homeScore,
        pred.awayScore,
        hR,
        aR,
        match.homeTeam?.ranking || 999,
        match.awayTeam?.ranking || 999,
      );

      // 4. Collect update if changed
      if (pred.points !== pts) {
        updatesToUpsert.push({
          userId: pred.userId,
          matchId: pred.matchId,
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
          points: pts,
          groupId: pred.groupId,
        });
      }
    }

    // 5. Batch update
    if (updatesToUpsert.length > 0) {
      await dbRef.current.upsertPrediction(updatesToUpsert);
      console.log(
        `✨ Processamento em lote concluído: ${updatesToUpsert.length} palpites atualizados.`,
      );
    }
  };

  const syncMatchesAndStandings = useCallback(
    async (competitionCode: string) => {
      const normalizedCode = competitionCode.toUpperCase();
      const runStartedAt = new Date().toISOString();

      updateSyncStatus(normalizedCode, { isSyncing: true });

      try {
        // 1. Sync Matches
        const matchRes = await syncWithExternalApi(normalizedCode);

        // 2. After sync, trigger points processing for any newly FINISHED match
        const freshMatches = (matchRes as any).updatedMatches || [];
        const newlyFinished = freshMatches
          .filter(
            (m: any) =>
              m.status === MatchStatus.FINISHED &&
              (m.resultHome !== undefined || m.resultAway !== undefined),
          )
          .map((m: any) => ({
            id: m.id,
            result: { home: m.resultHome, away: m.resultAway },
          }));

        if (newlyFinished.length > 0) {
          await batchProcessPointsForMatches(newlyFinished as any);
        }

        // 3. Sync Standings
        const standingRes = await syncStandingsWithExternalApi(normalizedCode);

        const combinedSuccess = matchRes.success || standingRes.success;
        const combinedMessage = `Jogos: ${matchRes.message} | Tabela: ${standingRes.message}`;

        updateSyncStatus(normalizedCode, {
          lastOperation: "combined",
          lastAttemptAt: runStartedAt,
          lastSuccess: combinedSuccess,
          lastSuccessAt: combinedSuccess ? new Date().toISOString() : undefined,
          lastMessage: combinedMessage,
          isSyncing: false,
        });

        // 4. Persist sync timestamp in database for this competition
        if (combinedSuccess && canWriteData) {
          await dbRef.current.updateCompetitionSync(
            normalizedCode,
            new Date().toISOString(),
          );
        }

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
      matches,
      updateSyncStatus,
    ],
  );

  // --- AUTO SYNC POLLING EFFECT ---
  useEffect(() => {
    let intervalId: any;

    if (canWriteData && isAutoSyncEnabled) {
      console.log(`🔄 Auto-Sync GLOBAL ATIVO. Intervalo: ${syncInterval}ms`);

      const runGlobalSync = async () => {
        // Find all unique competition codes from existing groups
        const activeCodes = Array.from(
          new Set(
            db.groups.map((g) => (g.competitionCode || "WC").toUpperCase()),
          ),
        );

        console.log(
          `🔄 Auto-Sync: Atualizando ${activeCodes.length} competições...`,
          activeCodes,
        );

        for (const code of activeCodes) {
          await syncWithExternalApi(code);
        }
      };

      intervalId = setInterval(() => {
        void runGlobalSync();
      }, syncInterval || 60000);
    } else {
      console.log("⏹️ Auto-Sync PARADO (Configuração Global)");
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    canWriteData,
    isAutoSyncEnabled,
    syncInterval,
    syncWithExternalApi,
    db.groups,
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
