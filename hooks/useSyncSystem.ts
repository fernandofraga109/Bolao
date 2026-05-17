import { useState, useCallback, useRef } from "react";
import { Match, MatchStatus } from "../types";
import {
  fetchExternalStandings,
  fetchExternalMatches,
  fetchCompetitionTeams,
  fetchLiveMatchMinutes,
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
  rankingMap: Record<string, number> = {},
): {
  teamByExtId: Map<number, any>;
  teamByCode: Map<string, any>;
  newTeamPayloads: any[];
  existingTeamUpdates: any[];
} {
  const teamByExtId = new Map<number, any>();
  const teamByCode = new Map<string, any>();
  const newTeamPayloads: any[] = [];
  const existingTeamUpdates: any[] = [];

  // Index memory teams for fast lookup
  for (const t of memoryTeams) {
    if (t.externalTeamId) teamByExtId.set(t.externalTeamId, t);
    if (t.code) teamByCode.set(t.code.toUpperCase(), t);
  }

  // Merge API teams into the map
  for (const et of externalTeams) {
    const tlaUpper = et.tla?.toUpperCase();
    const existing = et.id
      ? teamByExtId.get(et.id)
      : (tlaUpper ? teamByCode.get(tlaUpper) : undefined);

    if (existing) {
      if (et.id) teamByExtId.set(et.id, existing);
      if (tlaUpper) teamByCode.set(tlaUpper, existing);

      // Build a DB update payload for fields that changed
      if (existing.id) {
        const patch: Record<string, any> = {
          id: existing.id,
          name: existing.name,
          code: existing.code,
          flag: existing.flag,
        };
        let hasPatch = false;

        if (et.id && !existing.externalTeamId) {
          existing.externalTeamId = et.id;
          patch.externalTeamId = et.id;
          hasPatch = true;
        }

        const newRanking = tlaUpper ? rankingMap[tlaUpper] : undefined;
        if (newRanking !== undefined && existing.ranking !== newRanking) {
          patch.ranking = newRanking;
          hasPatch = true;
        }

        if (hasPatch) existingTeamUpdates.push(patch);
      }
    } else {
      // New team discovered via /teams endpoint — schedule for creation
      const teamName = et.name || "TBD";
      const teamCode = et.tla || teamName.substring(0, 3).toUpperCase();

      const payload = {
        name: teamName,
        code: teamCode,
        flag: et.crest || "/favicon.ico",
        externalTeamId: et.id,
        ranking: rankingMap[teamCode.toUpperCase()] ?? null,
      };

      newTeamPayloads.push(payload);
      console.log(`[SYNC] Novo time detectado: ${teamName} (${teamCode}, extId=${et.id})`);

      // CRITICAL: Update maps immediately so subsequent duplicates in the same list
      // are skipped (marked as 'existing' but not yet in DB)
      if (et.id) teamByExtId.set(et.id, payload);
      if (payload.code) teamByCode.set(payload.code.toUpperCase(), payload);
    }
  }

  return { teamByExtId, teamByCode, newTeamPayloads, existingTeamUpdates };
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
    async (
      competitionCode: string,
      isManualRequest: boolean = false,
      options?: { isBackgroundSync?: boolean }
    ) => {
      const normalizedCode = normalizeCompetitionCode(competitionCode);
      const isManual = isManualRequest || normalizedCode === normalizeCompetitionCode(activeCompetitionCode);
      const isBackgroundSync = options?.isBackgroundSync ?? false;

      // Admins podem sempre sincronizar.
      // Background sync (disparado por usuários comuns) depende do RLS do Supabase
      // para controlar as permissões de escrita — não bloqueamos aqui.
      if (!canWriteData && !isBackgroundSync) {
        return {
          success: false,
          message: "Somente administradores podem salvar no banco.",
        };
      }

      if (isBackgroundSync) {
        console.log(`🌐 [BackgroundSync] Iniciando sync passivo para ${normalizedCode}...`);
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

        // ── FASE 1.5a: Buscar ranking map (usado nos dois pontos de criação de times) ──
        const rankingMap = await getWcRankingMap();

        // ── FASE 1.5: Upsert competition (satisfaz FK antes de matches/standings) ──
        const competitionMeta =
          (externalMatches[0] as any)?.competition ??
          (standingsData as any)?.competition;
        if (competitionMeta?.code && isSupabaseEnabled() && supabase) {
          await supabase.from("competitions").upsert(
            {
              code: competitionMeta.code,
              name: competitionMeta.name,
              emblem: competitionMeta.emblem ?? null,
              type: competitionMeta.type ?? null,
              last_sync: new Date().toISOString(),
            },
            { onConflict: "code" },
          );
        }

        // ── FASE 2: Construir mapa de times ─────────────────────────────────
        // Start with what we already have in memory
        const { teamByExtId, teamByCode, newTeamPayloads, existingTeamUpdates } = buildExternalTeamMap(
          externalTeams,
          dbRef.current.teams,
          normalizedCode === 'WC' ? rankingMap : {},
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
          const alreadyMapped = et.id
            ? teamByExtId.has(et.id)
            : (tlaUpper ? teamByCode.has(tlaUpper) : false);

          if (!alreadyMapped) {
            // Skip TBD placeholder entries (knockout slots not yet filled by the API)
            if (!et.id && (!et.tla || et.tla === "TBD")) continue;

            const teamName = (et as any).name || "TBD";
            const teamCode = et.tla || teamName.substring(0, 3).toUpperCase();
            console.log(`[SYNC] Novo time em jogo/standings: ${teamName} (${teamCode}, extId=${et.id})`);
            const payload = {
              name: teamName,
              code: teamCode,
              flag: (et as any).crest || "/favicon.ico",
              externalTeamId: et.id,
              ranking: normalizedCode === 'WC' ? (rankingMap[teamCode.toUpperCase()] ?? 999) : null,
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


        // Batch upsert all unknown teams
        // Estratégia de 2 passos para evitar o erro 409 (duplicate key em "code"):
        // Passo 1: Para times que já existem no DB pelo code mas sem externalTeamId,
        //          atribuir o externalTeamId antes do upsert principal.
        //          Isso evita que o upsert por externalTeamId tente inserir um novo
        //          registro que colide com a unique constraint de code.
        // Passo 2: Upsert principal por externalTeamId (agora sem conflito de code).
        if (deduplicatedPayloads.length > 0 && isSupabaseEnabled() && supabase) {
          console.log(`[SYNC] Inserindo ${deduplicatedPayloads.length} times novos/atualizados...`);

          // Passo 1: Adota times órfãos (têm code no DB mas falta externalTeamId)
          const payloadsWithExtId = deduplicatedPayloads.filter((p) => p.externalTeamId);
          for (const payload of payloadsWithExtId) {
            await supabase
              .from("teams")
              .update({ externalTeamId: payload.externalTeamId })
              .eq("code", payload.code)
              .is("externalTeamId", null) // só atualiza se ainda não tem
              .limit(1); // evita colidir com dois times de mesmo TLA (ex: COR)
            // Ignoramos o erro propositalmente — se o time não existir pelo code, tudo bem.
          }

          // Passo 2: Upsert principal — agora os times com code já têm externalTeamId,
          //          então o conflict target funciona corretamente.
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

        // Persist externalTeamId + ranking for teams matched via /api/teams response.
        if (existingTeamUpdates.length > 0 && isSupabaseEnabled() && supabase) {
          console.log(`[SYNC] Atualizando ${existingTeamUpdates.length} times existentes (externalTeamId/ranking via /api/teams)...`);
          const { error: updateError } = await supabase
            .from("teams")
            .upsert(existingTeamUpdates, { onConflict: "id" });
          if (updateError) {
            console.warn("[SYNC] Erro ao atualizar times existentes:", updateError.message);
          }
        }

        // Apply rankingMap only to teams that participate in WC matches.
        // Filtering by WC match participation prevents non-WC teams (from other competitions)
        // from accidentally receiving a FIFA ranking just because their code appears in the ranking file.
        if (normalizedCode === 'WC' && Object.keys(rankingMap).length > 0 && isSupabaseEnabled() && supabase) {
          const wcTeamIds = new Set<string>(
            (dbRef.current.matches as any[])
              .filter((m) => m.competitionCode === 'WC')
              .flatMap((m) => [m.homeTeamId, m.awayTeamId])
              .filter(Boolean)
          );
          const rankingPatches = (dbRef.current.teams as any[])
            .filter((t) => t.id && t.code && wcTeamIds.has(t.id))
            .reduce<any[]>((acc, t) => {
              const newRanking = rankingMap[t.code.toUpperCase()];
              if (newRanking !== undefined && t.ranking !== newRanking) {
                acc.push({ id: t.id, name: t.name, code: t.code, flag: t.flag, ranking: newRanking });
              }
              return acc;
            }, []);

          if (rankingPatches.length > 0) {
            console.log(`[SYNC] Atualizando ranking de ${rankingPatches.length} times via team-ranking.json...`);
            const { error: rankErr } = await supabase
              .from("teams")
              .upsert(rankingPatches, { onConflict: "id" });
            if (rankErr) console.warn("[SYNC] Erro ao atualizar rankings:", rankErr.message);
          }
        }

        // ── FASE 3: Processar Matches ────────────────────────────────────────
        const hydratedInternalMatches = dbRef.current.matches.map((m: any) => ({
          ...m,
          result: m.resultHome != null ? { home: m.resultHome, away: m.resultAway } : undefined,
          homeTeam: dbRef.current.teams.find((t: any) => t.id === m.homeTeamId),
          awayTeam: dbRef.current.teams.find((t: any) => t.id === m.awayTeamId),
        }));

        const matchUpserts: any[] = [];
        const finishedMatchesForPoints: Match[] = [];

        // Fetch live minutes if there are any IN_PLAY matches in this batch
        const hasLiveMatches = externalMatches.some(
          (em) => em.status === "IN_PLAY" || em.status === "PAUSED"
        );
        const liveMinuteMap = hasLiveMatches ? await fetchLiveMatchMinutes() : {};
        if (hasLiveMatches) {
          console.log(`[SYNC] Minutos ao vivo obtidos para ${Object.keys(liveMinuteMap).length} jogos.`);
        }

        for (const em of externalMatches) {
          const status = mapExternalStatusToInternal(em.status);
          
          const homeScore = em.score?.fullTime?.home;
          const awayScore = em.score?.fullTime?.away;
          
          const result = homeScore != null ? { home: homeScore, away: awayScore } : undefined;

          const existing = findInternalMatch(em, hydratedInternalMatches);

          if (existing) {
            // Resolve minute from the dedicated live endpoint (em.minute is null in the bulk endpoint)
            const liveMinute = liveMinuteMap[em.id] ?? em.minute ?? null;

            const hasChanged =
              existing.status !== status ||
              (homeScore != null && existing.result?.home !== homeScore) ||
              (awayScore != null && existing.result?.away !== awayScore) ||
              existing.minute !== liveMinute;



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
                minute: liveMinute,
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
                minute: em.minute ?? null,
              });
            } else {
              // Times com id/tla nulos = jogos de fase eliminatória ainda não definidos (TBD).
              // Comportamento esperado da API — serão resolvidos quando os times forem confirmados.
              console.debug(`[SYNC] Jogo ${em.id} ignorado: times ainda não definidos pela competição (TBD).`);
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

        // ── FASE 4b: Calcular pontos das predictions ─────────────────────────
        // IMPORTANTE: Processa TODOS os jogos FINISHED do banco local, não apenas
        // os que mudaram neste sync. Isso garante que pontos sejam calculados mesmo
        // quando o sync roda em jogos que já estavam FINISHED (hasChanged=false).
        // batchProcessPointsForMatches é idempotente: só faz upsert se pred.points mudou.
        const alreadyInBatch = new Set(finishedMatchesForPoints.map((m) => m.id));

        const additionalFinished = hydratedInternalMatches
          .filter(
            (m: any) =>
              m.status === MatchStatus.FINISHED &&
              m.resultHome != null &&
              m.resultAway != null &&
              m.homeTeam &&
              m.awayTeam &&
              !alreadyInBatch.has(m.id),
          )
          .map((m: any) => ({
            ...m,
            result: { home: m.resultHome, away: m.resultAway },
          })) as Match[];

        const allFinishedToProcess = [...finishedMatchesForPoints, ...additionalFinished];

        if (allFinishedToProcess.length > 0) {
          console.log(
            `[SYNC] Calculando pontos para ${allFinishedToProcess.length} jogos finalizados` +
            (finishedMatchesForPoints.length > 0 ? ` (${finishedMatchesForPoints.length} recém-finalizados + ${additionalFinished.length} já existentes)` : "") + "..."
          );
          await batchProcessPointsForMatches(allFinishedToProcess);
        }

        const matchesMessage =
          matchesUpdated > 0
            ? `${matchesUpdated} jogos atualizados.`
            : "Todos os jogos já estão atualizados.";

        // ── FASE 4: Batch Standings ──────────────────────────────────────────
        let standingsMessage = "Classificação não disponível.";
        let standingsSuccess = false;

        // Build team→group map from matches (WC standings API returns group:null;
        // group assignments only exist in match data for group-stage matches).
        const teamGroupFromMatches = new Map<number, string>();
        for (const em of externalMatches) {
          if (em.group && em.stage === "GROUP_STAGE") {
            if (em.homeTeam?.id) teamGroupFromMatches.set(em.homeTeam.id, em.group);
            if (em.awayTeam?.id) teamGroupFromMatches.set(em.awayTeam.id, em.group);
          }
        }

        if (standingsData?.standings) {
          const standingUpserts: any[] = [];

          for (const group of standingsData.standings) {
            if (group.type !== "TOTAL") continue;

            for (const row of group.table) {
              const team = row.team.id
                ? teamByExtId.get(row.team.id)
                : (row.team.tla ? teamByCode.get(row.team.tla.toUpperCase()) : undefined);

              if (!team) {
                console.warn(`[SYNC] Time não encontrado para standings: ${row.team.name}`);
                continue;
              }

              const resolvedGroup =
                group.group ||
                (row.team.id ? teamGroupFromMatches.get(row.team.id) ?? null : null);

              standingUpserts.push({
                teamId: team.id,
                competitionCode: normalizedCode,
                season: standingsData.filters?.season || season,
                stage: group.stage,
                type: group.type,
                group: resolvedGroup,
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
              const key = `${s.teamId}|${s.competitionCode}`;
              const existing = uniqueStandings.get(key);
              // Prefer entries with a specific group over null-group aggregate entries.
              // APIs like Football Data return both "Group A" rows AND an aggregate
              // null-group row for the same teams — null must not overwrite the group.
              if (!existing || (existing.group === null && s.group !== null)) {
                uniqueStandings.set(key, s);
              }
            }
            const deduplicatedStandings = Array.from(uniqueStandings.values());

            console.log(`[SYNC] Fazendo upsert de ${deduplicatedStandings.length} linhas de standings (${standingUpserts.length - deduplicatedStandings.length} duplicatas removidas)...`);
            const { error: standingsError } = await supabase
              .from("team_standings")
              .upsert(deduplicatedStandings, {
                onConflict: "teamId, competitionCode",
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

        // Atualiza o lastSync se o sync foi bem-sucedido.
        // Isso é crítico para o background sync funcionar corretamente:
        // sem atualizar o lastSync, o hook vê um timestamp velho e fica
        // re-disparando o sync em loop a cada tick.
        // canWriteData (admin) OU isBackgroundSync (usuário via RLS) podem gravar.
        if (combinedSuccess && (canWriteData || isBackgroundSync)) {
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
