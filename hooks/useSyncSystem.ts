import { useState, useCallback, useRef } from "react";
import { Match, MatchStatus } from "../types";
import {
  fetchExternalStandings,
  fetchExternalMatches,
  fetchCompetitionTeams,
  findInternalMatch,
  getCurrentSeason,
  mapExternalStatusToInternal,
  type ExternalTeam,
} from "../services/liveScoreService";
import { supabase, isSupabaseEnabled } from "../services/supabase";

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

// ---------------------------------------------------------------------------
// buildTeamMap — given API teams + what we already know in memory,
// returns a map from externalTeamId → internal team record.
// Also returns a list of teams that need to be upserted into the DB.
// ---------------------------------------------------------------------------
function buildExternalTeamMap(
  externalTeams: ExternalTeam[],
  memoryTeams: any[],
): {
  teamByExtId: Map<number, any>;
  teamByCode: Map<string, any>;
  newTeamPayloads: any[];
} {
  const teamByExtId = new Map<number, any>();
  const teamByCode = new Map<string, any>();
  const newTeamPayloads: any[] = [];

  // Index memory teams for fast lookup
  for (const t of memoryTeams) {
    if (t.externalTeamId) teamByExtId.set(t.externalTeamId, t);
    if (t.code) teamByCode.set(t.code.toUpperCase(), t);
  }

  // Merge API teams into the map
  for (const et of externalTeams) {
    const tlaUpper = et.tla?.toUpperCase();
    const existing =
      (et.id ? teamByExtId.get(et.id) : undefined) ||
      (tlaUpper ? teamByCode.get(tlaUpper) : undefined);

    if (existing) {
      // Se já existe e temos o ID externo, atualizamos o ID externo se estiver faltando
      if (et.id && !existing.externalTeamId) existing.externalTeamId = et.id;
      
      // Indexamos nos dois mapas para garantir consistência
      if (et.id) teamByExtId.set(et.id, existing);
      if (tlaUpper) teamByCode.set(tlaUpper, existing);
    } else {
      // New team discovered via /teams endpoint — schedule for creation
      const teamName = et.name || "TBD";
      const teamCode = et.tla || teamName.substring(0, 3).toUpperCase();
      
      const payload = {
        name: teamName,
        code: teamCode,
        flag: et.crest || "/favicon.ico",
        externalTeamId: et.id,
        ranking: 999,
      };
      
      newTeamPayloads.push(payload);
      
      // CRITICAL: Update maps immediately so subsequent duplicates in the same list 
      // are skipped (marked as 'existing' but not yet in DB)
      if (et.id) teamByExtId.set(et.id, payload);
      if (payload.code) teamByCode.set(payload.code.toUpperCase(), payload);
    }
  }


  return { teamByExtId, teamByCode, newTeamPayloads };
}

export const useSyncSystem = (
  activeCompetitionCode: string,
  canWriteData: boolean,
  dbRef: any,
  getWcRankingMap: () => Promise<Record<string, number>>,
  batchProcessPointsForMatches: (matches: Match[]) => Promise<void>,
  recalculateUserGroupPoints: (groupIds: string[]) => Promise<void>,
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
            ...(prev[normalizedCode] || { competitionCode: normalizedCode }),
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

  // ---------------------------------------------------------------------------
  // syncMatchesAndStandings — MAIN PIPELINE
  // 1. Parallel fetch (teams + matches + standings)
  // 2. Build team map from memory + API teams, batch-upsert new ones
  // 3. Diff matches → batch upsert changed/new
  // 4. Batch upsert standings (1 request)
  // 5. Recalculate points
  // ---------------------------------------------------------------------------
  const syncMatchesAndStandings = useCallback(
    async (competitionCode: string, isManualRequest: boolean = false) => {
      const normalizedCode = normalizeCompetitionCode(competitionCode);
      const isManual = isManualRequest || normalizedCode === normalizeCompetitionCode(activeCompetitionCode);

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
      setIsSyncing(true);
      updateSyncStatus(normalizedCode, {
        isSyncing: true,
        lastOperation: "combined",
      });

      try {
        const season = getCurrentSeason();

        // ── FASE 1: Fetch Paralelo ──────────────────────────────────────────
        console.log(`[SYNC] Iniciando fetch paralelo para ${normalizedCode}...`);
        const [externalTeams, externalMatches, standingsData] = await Promise.all([
          fetchCompetitionTeams(normalizedCode, season),
          fetchExternalMatches(normalizedCode, season),
          fetchExternalStandings(normalizedCode, season),
        ]);

        if (!externalMatches || externalMatches.length === 0) {
          throw new Error("Nenhum jogo encontrado na API externa.");
        }

        // ── FASE 2: Construir mapa de times ─────────────────────────────────
        // Start with what we already have in memory
        const { teamByExtId, teamByCode, newTeamPayloads } = buildExternalTeamMap(
          externalTeams,
          dbRef.current.teams,
        );

        // Collect ALL teams referenced in matches and standings that aren't in the map yet
        const allReferencedExternalTeams = [
          ...externalMatches.flatMap((em) => [em.homeTeam, em.awayTeam]),
          ...(standingsData?.standings ?? []).flatMap((g) =>
            g.table.map((row) => row.team)
          ),
        ].filter(Boolean);

        for (const et of allReferencedExternalTeams) {
          if (!et) continue;
          const tlaUpper = et.tla?.toUpperCase();
          const alreadyMapped =
            (et.id && teamByExtId.has(et.id)) ||
            (tlaUpper && teamByCode.has(tlaUpper));

          if (!alreadyMapped) {
            const teamName = (et as any).name || "TBD";
            const teamCode = et.tla || teamName.substring(0, 3).toUpperCase();
            const payload = {
              name: teamName,
              code: teamCode,
              flag: (et as any).crest || "/favicon.ico",
              externalTeamId: et.id,
              ranking: 999,
            };
            newTeamPayloads.push(payload);
            // Pre-mark to avoid duplicates in this same loop
            if (et.id) teamByExtId.set(et.id, payload);
            if (payload.code) teamByCode.set(payload.code.toUpperCase(), payload);
          }
        }

        // Deduplicate payloads by code OR externalTeamId to handle collisions like "COR"
        const uniquePayloads = new Map<string, any>();
        for (const p of newTeamPayloads) {
          // A chave de unicidade deve ser o ID externo se disponível, senão o código
          const key = p.externalTeamId ? `ext_${p.externalTeamId}` : `code_${p.code}`;
          if (!uniquePayloads.has(key)) {
            uniquePayloads.set(key, p);
          }
        }
        const deduplicatedPayloads = Array.from(uniquePayloads.values());


        // Batch upsert all unknown teams (1 request)
        if (deduplicatedPayloads.length > 0 && isSupabaseEnabled() && supabase) {
          console.log(`[SYNC] Inserindo ${deduplicatedPayloads.length} times novos/atualizados...`);
          const { data: savedTeams, error: teamsError } = await supabase
            .from("teams")
            .upsert(deduplicatedPayloads, { onConflict: "externalTeamId" })
            .select("*");


          if (teamsError) {
            console.warn("[SYNC] Erro ao inserir times:", teamsError.message);
          } else if (savedTeams) {
            // CRITICAL: Re-index maps with REAL DB records that have actual UUID ids.
            // Before this point the map had placeholder payloads (no id).
            for (const t of savedTeams) {
              if (t.externalTeamId) teamByExtId.set(t.externalTeamId, t);
              if (t.code) teamByCode.set(t.code.toUpperCase(), t);
            }
          }
        }


        // ── FASE 3: Processar Matches ────────────────────────────────────────
        const rankingMap = normalizedCode === "WC" ? await getWcRankingMap() : {};

        const hydratedInternalMatches = dbRef.current.matches.map((m: any) => ({
          ...m,
          homeTeam: dbRef.current.teams.find((t: any) => t.id === m.homeTeamId),
          awayTeam: dbRef.current.teams.find((t: any) => t.id === m.awayTeamId),
        }));

        const matchUpserts: any[] = [];
        const finishedMatchesForPoints: Match[] = [];

        for (const em of externalMatches) {
          const status = mapExternalStatusToInternal(em.status);
          
          // Extração robusta do placar (tenta fullTime, depois regularTime)
          const homeScore = em.score?.fullTime?.home ?? em.score?.regularTime?.home;
          const awayScore = em.score?.fullTime?.away ?? em.score?.regularTime?.away;
          
          const result = homeScore != null ? { home: homeScore, away: awayScore } : undefined;

          const existing = findInternalMatch(em, hydratedInternalMatches);

          if (existing) {
            // Log para depuração se necessário
            // console.log(`[SYNC] Comparando ${em.homeTeam?.name}: API(${homeScore}) vs DB(${existing.resultHome})`);

            const hasChanged =
              existing.status !== status ||
              (homeScore != null && existing.resultHome !== homeScore) ||
              (awayScore != null && existing.resultAway !== awayScore);



            if (hasChanged) {
              // Removemos campos virtuais (objetos hidratados) antes de enviar para o banco
              const { homeTeam, awayTeam, result, ...pureMatch } = existing;

              matchUpserts.push({
                ...pureMatch,
                externalMatchId: String(em.id),
                status,
                resultHome: homeScore ?? null,
                resultAway: awayScore ?? null,
                date: em.utcDate,
              });





              if (status === MatchStatus.FINISHED && result) {
                finishedMatchesForPoints.push({
                  ...existing,
                  status,
                  result,
                } as Match);
              }
            }
          } else if (em.homeTeam && em.awayTeam) {
            // Novo jogo — resolve times pelo mapa
            const resolveTeam = (et: any) =>
              (et.id && teamByExtId.get(et.id)) ||
              (et.tla && teamByCode.get(et.tla.toUpperCase())) ||
              null;

            const homeTeam = resolveTeam(em.homeTeam);
            const awayTeam = resolveTeam(em.awayTeam);

            if (homeTeam && awayTeam) {
              matchUpserts.push({
                externalMatchId: String(em.id),
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                date: em.utcDate,
                group: em.group || em.stage || "Campeonato",
                competitionCode: normalizedCode,
                status,
                resultHome: result?.home ?? null,
                resultAway: result?.away ?? null,
                stage: em.stage,
                matchday: em.matchday,
              });
            } else {
              console.warn(`[SYNC] Não foi possível resolver times para o jogo ${em.id}: ${em.homeTeam?.name} vs ${em.awayTeam?.name}`);
            }
          } else {
            console.warn(`[SYNC] Jogo da API não encontrado no banco local: ${em.homeTeam?.name} vs ${em.awayTeam?.name} (${em.utcDate}). Verifique se a data/fuso-horário coincide.`);
          }
        }


        // Batch upsert matches (1 request!)
        let matchesUpdated = 0;
        if (matchUpserts.length > 0) {
          console.log(`[SYNC] Fazendo upsert de ${matchUpserts.length} jogos...`);

          // Separate updates (have id) from inserts (no id)
          // Deduplicate updates by internal ID
          const updateMap = new Map();
          matchUpserts.filter(m => m.id).forEach(m => updateMap.set(m.id, m));
          const toUpdate = Array.from(updateMap.values());

          // Deduplicate inserts by externalMatchId
          const insertMap = new Map();
          matchUpserts.filter(m => !m.id).forEach(m => insertMap.set(m.externalMatchId, m));
          const toInsert = Array.from(insertMap.values());

          if (toUpdate.length > 0) {
            console.log("[SYNC] Enviando atualizações de placar para o banco:", toUpdate);
            const { data: savedUpdates, error } = await supabase!
              .from("matches")
              .upsert(toUpdate, { onConflict: "id" })
              .select("*");

            if (error) console.warn("[SYNC] Erro ao atualizar matches:", error.message);
            else if (savedUpdates) {
              matchesUpdated += savedUpdates.length;
              if (dbRef.current.upsertMatch) {
                dbRef.current.upsertMatch(savedUpdates);
              }

            }
          }

          if (toInsert.length > 0 && isSupabaseEnabled()) {
            const { data: savedInserts, error } = await supabase!
              .from("matches")
              .upsert(toInsert, { onConflict: "externalMatchId" })
              .select("*");
            if (error) console.warn("[SYNC] Erro ao inserir matches:", error.message);
            else if (savedInserts) {
              matchesUpdated += savedInserts.length;
              if (dbRef.current.updateLocalMatches) {
                dbRef.current.updateLocalMatches(savedInserts);
              }
            }
          }
        }

        // Process points for finished matches
        if (finishedMatchesForPoints.length > 0) {
          await batchProcessPointsForMatches(finishedMatchesForPoints);
        }

        const matchesMessage =
          matchesUpdated > 0
            ? `${matchesUpdated} jogos atualizados.`
            : "Todos os jogos já estão atualizados.";

        // ── FASE 4: Batch Standings ──────────────────────────────────────────
        let standingsMessage = "Classificação não disponível.";
        let standingsSuccess = false;

        if (standingsData?.standings) {
          const standingUpserts: any[] = [];

          for (const group of standingsData.standings) {
            if (group.type !== "TOTAL") continue;

            for (const row of group.table) {
              const team =
                (row.team.id && teamByExtId.get(row.team.id)) ||
                (row.team.tla && teamByCode.get(row.team.tla.toUpperCase()));

              if (!team) {
                console.warn(`[SYNC] Time não encontrado para standings: ${row.team.name}`);
                continue;
              }

              standingUpserts.push({
                teamId: team.id,
                competitionCode: normalizedCode,
                season: standingsData.filters?.season || season,
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
              });
            }
          }

          if (standingUpserts.length > 0 && isSupabaseEnabled() && supabase) {
            // Deduplicate by composite key (teamId|competitionCode|group)
            // Some APIs return the same team+group combination multiple times
            const uniqueStandings = new Map<string, any>();
            for (const s of standingUpserts) {
              const key = `${s.teamId}|${s.competitionCode}|${s.group}`;
              // Last entry wins (most up-to-date data)
              uniqueStandings.set(key, s);
            }
            const deduplicatedStandings = Array.from(uniqueStandings.values());

            console.log(`[SYNC] Fazendo upsert de ${deduplicatedStandings.length} linhas de standings (${standingUpserts.length - deduplicatedStandings.length} duplicatas removidas)...`);
            const { error: standingsError } = await supabase
              .from("team_standings")
              .upsert(deduplicatedStandings, {
                onConflict: "teamId, competitionCode, group",
              });

            if (standingsError) {
              console.warn("[SYNC] Erro ao fazer upsert de standings:", standingsError.message);
              standingsMessage = `Erro nos standings: ${standingsError.message}`;
            } else {
              standingsMessage = "Classificação sincronizada com sucesso.";
              standingsSuccess = true;
            }
          } else {
            standingsMessage = "Classificação sincronizada (sem dados para upsert).";
            standingsSuccess = true;
          }
        }

        // ── FASE 5: Recalcular Pontos + Atualizar competição ─────────────────
        const combinedSuccess = matchesUpdated >= 0 && standingsSuccess;

        if (combinedSuccess && canWriteData) {
          await dbRef.current.updateCompetitionSync(
            normalizedCode,
            new Date().toISOString(),
          );
        }

        const affectedGroupIds = dbRef.current.groups
          .filter(
            (g: any) =>
              (g.competitionCode || "WC").toUpperCase() === normalizedCode,
          )
          .map((g: any) => g.id);

        if (affectedGroupIds.length > 0) {
          await recalculateUserGroupPoints(affectedGroupIds);
        }

        const combinedMessage = `${matchesMessage} ${standingsMessage}`;
        nextAllowedSyncAtRef.current = Date.now() + 30000;

        updateSyncStatus(normalizedCode, {
          isSyncing: false,
          lastSuccess: combinedSuccess,
          lastSuccessAt: combinedSuccess ? new Date().toISOString() : undefined,
          lastMessage: combinedMessage,
        });

        return { success: combinedSuccess, message: combinedMessage };
      } catch (err: any) {
        console.error("[SYNC] Erro no pipeline:", err);
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
      recalculateUserGroupPoints,
    ],
  );

  // ---------------------------------------------------------------------------
  // Legacy individual functions — kept for compatibility with AdminDashboard
  // They now delegate to the unified pipeline.
  // ---------------------------------------------------------------------------
  const syncWithExternalApi = useCallback(
    async (competitionCode: string) => {
      // For individual matches-only sync (legacy call), run the full pipeline.
      // The pipeline is idempotent so this is safe.
      return syncMatchesAndStandings(competitionCode);
    },
    [syncMatchesAndStandings],
  );

  const syncStandingsWithExternalApi = useCallback(
    async (competitionCode: string) => {
      // Also delegates — standings are part of the unified pipeline.
      return syncMatchesAndStandings(competitionCode);
    },
    [syncMatchesAndStandings],
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
