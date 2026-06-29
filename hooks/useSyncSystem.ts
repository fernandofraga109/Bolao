import { useState, useCallback, useRef } from "react";
import { Match, MatchStatus } from "../types";
import { getExtraPhaseKey } from "../utils/scoring";
import {
  fetchExternalStandings,
  fetchExternalMatches,
  fetchCompetitionTeams,
  fetchLiveMatchMinutes,
  fetchLiveMatchDetails,
  fetchLiveStats,
  matchLiveFixtureToInternal,
  fetchCompetitionScorers,
  findInternalMatch,
  getCurrentSeason,
  mapExternalStatusToInternal,
  shouldUpdateByLastUpdated,
  isStaleApiData,
  type ExternalTeam,
} from "../services/liveScoreService";
import { supabase, isSupabaseEnabled } from "../services/supabase";
import { persistScorers } from "./usePlayerSync";
import { SyncProfiler } from "../utils/syncProfiler";

// Map team codes to ISO 3166-1 alpha-2 country codes for flagcdn.com
const teamCodeToCountryCode: Record<string, string> = {
  'USA': 'us',
  'MEX': 'mx',
  'CAN': 'ca',
  'ESP': 'es',
  'ARG': 'ar',
  'FRA': 'fr',
  'ENG': 'gb-eng',
  'BRA': 'br',
  'POR': 'pt',
  'NED': 'nl',
  'BEL': 'be',
  'GER': 'de',
  'CRO': 'hr',
  'MAR': 'ma',
  'COL': 'co',
  'URU': 'uy',
  'SUI': 'ch',
  'JPN': 'jp',
  'SEN': 'sn',
  'IRN': 'ir',
  'KOR': 'kr',
  'ECU': 'ec',
  'AUT': 'at',
  'AUS': 'au',
  'NOR': 'no',
  'PAN': 'pa',
  'EGY': 'eg',
  'ALG': 'dz',
  'SCO': 'gb-sct',
  'PAR': 'py',
  'TUN': 'tn',
  'CIV': 'ci',
  'UZB': 'uz',
  'QAT': 'qa',
  'KSA': 'sa',
  'RSA': 'za',
  'JOR': 'jo',
  'CPV': 'cv',
  'GHA': 'gh',
  'CUW': 'cw',
  'HAI': 'ht',
  'NZL': 'nz',
};

const getFlagUrl = (teamCode: string): string => {
  const flagProvider = import.meta.env.VITE_FLAG_PROVIDER;
  
  // If not set or not 'flagcdn', return empty to use whatever is in the DB
  if (flagProvider !== 'flagcdn') {
    return '';
  }
  
  const countryCode = teamCodeToCountryCode[teamCode.toUpperCase()];
  if (countryCode) {
    return `https://flagcdn.com/w160/${countryCode}.png`;
  }
  // Fallback to crest from API or default
  return '/favicon.ico';
};

const normalizeCompetitionCode = (value?: string) =>
  (value || "WC").toUpperCase();

/**
 * Extrai o resultado efetivo de um jogo do payload da football-data API.
 * O campo `fullTime` inclui penalties em jogos de mata-mata, então
 * calculamos o resultado real como regularTime + extraTime (sem penalties).
 */
export const extractMatchResult = (score: any) => {
  const duration = score?.duration as "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | undefined;
  const regularTime = score?.regularTime;
  const extraTime = score?.extraTime;
  const penalties = score?.penalties;
  const fullTime = score?.fullTime;

  if (duration === "EXTRA_TIME" || duration === "PENALTY_SHOOTOUT") {
    const rtHome = regularTime?.home ?? 0;
    const rtAway = regularTime?.away ?? 0;
    const etHome = extraTime?.home ?? 0;
    const etAway = extraTime?.away ?? 0;
    return {
      home: rtHome + etHome,
      away: rtAway + etAway,
      penaltiesHome: duration === "PENALTY_SHOOTOUT" ? (penalties?.home ?? null) : null,
      penaltiesAway: duration === "PENALTY_SHOOTOUT" ? (penalties?.away ?? null) : null,
      regularHome: regularTime?.home ?? null,
      regularAway: regularTime?.away ?? null,
      extraTimeHome: extraTime?.home ?? null,
      extraTimeAway: extraTime?.away ?? null,
    };
  }

  // REGULAR ou fallback
  return {
    home: fullTime?.home ?? null,
    away: fullTime?.away ?? null,
    penaltiesHome: null,
    penaltiesAway: null,
    regularHome: regularTime?.home ?? (fullTime?.home ?? null),
    regularAway: regularTime?.away ?? (fullTime?.away ?? null),
    extraTimeHome: null,
    extraTimeAway: null,
  };
};

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
        flag: getFlagUrl(teamCode),
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

  const petitionsRef = useRef<Set<string>>(new Set());
  const syncingCompetitionsRef = useRef<Set<string>>(new Set());
  const adminOverridesRef = useRef<Map<string, number>>(new Map());

  const registerAdminOverride = useCallback((matchId: string) => {
    adminOverridesRef.current.set(matchId, Date.now());
    // Garbage collect expired entries (> 2 min)
    const now = Date.now();
    for (const [id, ts] of adminOverridesRef.current) {
      if (now - ts > 2 * 60 * 1000) adminOverridesRef.current.delete(id);
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
      options?: { isBackgroundSync?: boolean; onSyncStart?: (code: string) => void }
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

      if (syncingCompetitionsRef.current.has(normalizedCode)) {
        return { success: false, message: "Sincronização já em andamento." };
      }

      // Tenta adquirir o lock distribuído no banco
      // useBackgroundSync já verificou lastSync antes de chamar esta função
      const profiler = new SyncProfiler(normalizedCode);
      const lockAcquired = await dbRef.current.acquireSyncLock(normalizedCode);
      if (!lockAcquired) {
        console.log(`🔒 [SYNC] Sync bloqueado por outra instância para ${normalizedCode}`);
        // Retorna sucesso silencioso - outra instância está sincronizando
        return { success: true, message: "" };
      }
      profiler.mark("lock_acquire", "lock");

      // Lock adquirido! Notifica que o sync iniciou (para mostrar toast azul)
      if (options?.onSyncStart) {
        options.onSyncStart(normalizedCode);
      }

      syncingCompetitionsRef.current.add(normalizedCode);
      setIsSyncing(true);
      updateSyncStatus(normalizedCode, {
        isSyncing: true,
        lastOperation: "combined",
      });

      try {
        profiler.mark("setup", "cpu");

        // ── FASE 1: Fetch Paralelo ──────────────────────────────────────────
        // A season é resolvida SERVER-SIDE nos proxies (api/_lib/seasonPolicy).
        // O cliente não envia season — abas stale não conseguem injetar uma.
        console.log(`[SYNC] Iniciando fetch paralelo para ${normalizedCode}...`);
        const [externalTeams, externalMatches, standingsData, scorersData] = await Promise.all([
          fetchCompetitionTeams(normalizedCode),
          fetchExternalMatches(normalizedCode),
          fetchExternalStandings(normalizedCode),
          fetchCompetitionScorers(normalizedCode),
        ]);
        profiler.mark("api_fetch", "api");

        if (!externalMatches || externalMatches.length === 0) {
          throw new Error("Nenhum jogo encontrado na API externa.");
        }

        // ── FASE 1.5a: Buscar ranking map (usado nos dois pontos de criação de times) ──
        const rankingMap = await getWcRankingMap();
        profiler.mark("ranking_map", "cpu");

        // ── FASE 1.5: Upsert competition (satisfaz FK antes de matches/standings) ──
        const competitionMeta =
          (externalMatches[0] as any)?.competition ??
          (standingsData as any)?.competition;
        
        // Extrair artilheiro dos dados da API
        // Hardcoded para Regulamento 1 até definirmos o fluxo real
        const topScorerName = '-';
        const topScorerGoals = scorersData?.scorers?.[0]?.goals;
        
        // Extrair campeão dos dados da API (season.winner)
        const seasonWinnerExternalId = (externalMatches[0] as any)?.season?.winner;
        
        if (topScorerName) {
          console.log(`[SYNC] Artilheiro encontrado: ${topScorerName} (${topScorerGoals} gols)`);
        }
        
        if (seasonWinnerExternalId) {
          console.log(`[SYNC] Campeão encontrado na API (externalTeamId): ${seasonWinnerExternalId}`);
        }
        
        if (competitionMeta?.code && isSupabaseEnabled() && supabase) {
          const competitionPayload: any = {
            code: competitionMeta.code,
            name: competitionMeta.name,
            emblem: competitionMeta.emblem ?? null,
            type: competitionMeta.type ?? null,
            last_sync: new Date().toISOString(),
            topScorerName: topScorerName ?? null,
            topScorerGoals: topScorerGoals ?? null,
          };
          
          // O championTeamId será atualizado depois de construirmos o mapa de times
          // Por agora, salvamos sem ele
          await supabase.from("competitions").upsert(
            competitionPayload,
            { onConflict: "code" },
          );
        }
        profiler.mark("upsert_competition", "db_write");

        // ── FASE 1.6: Persistir artilheiros (alimenta a aba Artilharia) ──────
        // Reaproveita `scorersData` já buscado na FASE 1 — NENHUMA chamada extra
        // à API externa. Escreve em players + tournament_players.
        // Gating igual ao resto do pipeline: admin (canWriteData) ou background
        // sync (usuário comum, autorizado pelo RLS de INSERT/UPDATE).
        let scorerExtIdToUuid: Map<number, string> | undefined;
        if (scorersData && (canWriteData || isBackgroundSync)) {
          try {
            const scorerResult = await persistScorers(normalizedCode, scorersData);
            scorerExtIdToUuid = scorerResult.extIdToUuid;
            if (scorerResult.error) {
              console.warn(`[SYNC] Erro ao persistir artilheiros: ${scorerResult.error}`);
            } else if (scorerResult.synced > 0) {
              console.log(`[SYNC] ${scorerResult.synced} artilheiros persistidos para ${normalizedCode}.`);
            }
          } catch (scorerErr) {
            console.warn("[SYNC] Falha ao persistir artilheiros:", scorerErr);
          }
        }
        profiler.mark("persist_scorers", "db_write");

        // ── FASE 1.7: Atualizar topScorerPlayerIds na competição ─────────────
        if (scorersData?.scorers?.length && scorerExtIdToUuid && isSupabaseEnabled() && supabase) {
          const maxGoals = scorersData.scorers[0].goals;
          const topScorerUuids = scorersData.scorers
            .filter((s) => s.goals === maxGoals)
            .map((s) => scorerExtIdToUuid!.get(s.player.id))
            .filter((uuid): uuid is string => !!uuid);
          if (topScorerUuids.length > 0) {
            const { error: tsUpdateError } = await supabase
              .from("competitions")
              .update({ topScorerPlayerIds: topScorerUuids })
              .eq("code", normalizedCode);
            if (tsUpdateError) {
              console.warn(`[SYNC] Erro ao atualizar topScorerPlayerIds: ${tsUpdateError.message}`);
            } else {
              console.log(`[SYNC] topScorerPlayerIds atualizado: ${topScorerUuids.length} jogador(es) com ${maxGoals} gol(s).`);
            }
          }
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
              flag: getFlagUrl(teamCode),
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
            
            // Agora que temos o mapa atualizado com UUIDs, podemos converter o campeão
            if (seasonWinnerExternalId && competitionMeta?.code && isSupabaseEnabled() && supabase) {
              const championTeam = teamByExtId.get(seasonWinnerExternalId);
              if (championTeam && championTeam.id) {
                console.log(`[SYNC] Atualizando campeão ${championTeam.name} (UUID: ${championTeam.id})`);
                await supabase
                  .from("competitions")
                  .update({ championTeamId: championTeam.id })
                  .eq("code", competitionMeta.code);
              } else {
                console.warn(`[SYNC] Campeão externalTeamId ${seasonWinnerExternalId} não encontrado no mapa de times`);
              }
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
                acc.push({ id: t.id, name: t.name, code: t.code, flag: getFlagUrl(t.code), ranking: newRanking });
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
        profiler.mark("teams_upsert", "db_write");

        // ── FASE 2.5: Calcular time(s) com mais gols/sofridos em UM jogo ──
        // Varre todos os jogos finalizados da competição para encontrar recordes.
        // Empates são permitidos: mantemos o conjunto de times que atingiu a
        // maior marca em cada categoria.
        const finishedMatches = externalMatches.filter(
          (em) => em.status === "FINISHED" && em.score?.fullTime?.home != null && em.score?.fullTime?.away != null
        );

        let mostGoalsScore = -1;
        const mostGoalsTeamExternalIds = new Set<number>();
        let mostConcededScore = -1;
        const mostConcededTeamExternalIds = new Set<number>();

        for (const match of finishedMatches) {
          const extracted = extractMatchResult(match.score);
          const homeGoals = extracted.home ?? 0;
          const awayGoals = extracted.away ?? 0;
          const homeTeamId = match.homeTeam?.id;
          const awayTeamId = match.awayTeam?.id;

          // Time(s) com mais gols em um jogo
          if (homeTeamId) {
            if (homeGoals > mostGoalsScore) {
              mostGoalsScore = homeGoals;
              mostGoalsTeamExternalIds.clear();
              mostGoalsTeamExternalIds.add(homeTeamId);
            } else if (homeGoals === mostGoalsScore) {
              mostGoalsTeamExternalIds.add(homeTeamId);
            }
          }
          if (awayTeamId) {
            if (awayGoals > mostGoalsScore) {
              mostGoalsScore = awayGoals;
              mostGoalsTeamExternalIds.clear();
              mostGoalsTeamExternalIds.add(awayTeamId);
            } else if (awayGoals === mostGoalsScore) {
              mostGoalsTeamExternalIds.add(awayTeamId);
            }
          }

          // Time(s) com mais gols sofridos em um jogo
          if (homeTeamId) {
            if (awayGoals > mostConcededScore) {
              mostConcededScore = awayGoals;
              mostConcededTeamExternalIds.clear();
              mostConcededTeamExternalIds.add(homeTeamId);
            } else if (awayGoals === mostConcededScore) {
              mostConcededTeamExternalIds.add(homeTeamId);
            }
          }
          if (awayTeamId) {
            if (homeGoals > mostConcededScore) {
              mostConcededScore = homeGoals;
              mostConcededTeamExternalIds.clear();
              mostConcededTeamExternalIds.add(awayTeamId);
            } else if (homeGoals === mostConcededScore) {
              mostConcededTeamExternalIds.add(awayTeamId);
            }
          }
        }

        // Converter externalTeamIds para UUIDs e atualizar competitions
        if (competitionMeta?.code && isSupabaseEnabled() && supabase) {
          const updates: any = {};

          if (mostGoalsScore > 0 && mostGoalsTeamExternalIds.size > 0) {
            const mostGoalsTeamUuids = Array.from(mostGoalsTeamExternalIds)
              .map((extId) => teamByExtId.get(extId)?.id)
              .filter((uuid): uuid is string => !!uuid);
            if (mostGoalsTeamUuids.length > 0) {
              updates.mostGoalsTeamIds = mostGoalsTeamUuids;
              updates.mostGoalsTeamId = mostGoalsTeamUuids[0];
              const teamNames = mostGoalsTeamUuids
                .map((uuid) => dbRef.current.teams.find((t: any) => t.id === uuid)?.name || uuid)
                .join(", ");
              console.log(`[SYNC] Time(s) com mais gols em um jogo: ${teamNames} (${mostGoalsScore} gols)`);
            }
          }

          if (mostConcededScore > 0 && mostConcededTeamExternalIds.size > 0) {
            const mostConcededTeamUuids = Array.from(mostConcededTeamExternalIds)
              .map((extId) => teamByExtId.get(extId)?.id)
              .filter((uuid): uuid is string => !!uuid);
            if (mostConcededTeamUuids.length > 0) {
              updates.mostConcededTeamIds = mostConcededTeamUuids;
              updates.mostConcededTeamId = mostConcededTeamUuids[0];
              const teamNames = mostConcededTeamUuids
                .map((uuid) => dbRef.current.teams.find((t: any) => t.id === uuid)?.name || uuid)
                .join(", ");
              console.log(`[SYNC] Time(s) com mais gols sofridos em um jogo: ${teamNames} (${mostConcededScore} gols)`);
            }
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("competitions")
              .update(updates)
              .eq("code", competitionMeta.code);
          }
        }
        profiler.mark("goal_records", "db_write");

        // ── FASE 3: Processar Matches ────────────────────────────────────────
        const hydratedInternalMatches = dbRef.current.matches.map((m: any) => ({
          ...m,
          result: m.resultHome != null ? { home: m.resultHome, away: m.resultAway } : undefined,
          homeTeam: dbRef.current.teams.find((t: any) => t.id === m.homeTeamId),
          awayTeam: dbRef.current.teams.find((t: any) => t.id === m.awayTeamId),
          score: m.score,
          penaltiesHome: m.penaltiesHome,
          penaltiesAway: m.penaltiesAway,
          regularHome: m.regularHome,
          regularAway: m.regularAway,
          extraTimeHome: m.extraTimeHome,
          extraTimeAway: m.extraTimeAway,
        }));

        const matchUpserts: any[] = [];
        const finishedMatchesForPoints: Match[] = [];
        let scoreOrStatusChanges = 0; // conta apenas mudanças reais de placar/status
        profiler.mark("hydrate_matches", "cpu");

        // Fetch live minutes if there are any IN_PLAY matches in this batch
        const hasLiveMatches = externalMatches.some(
          (em) => em.status === "IN_PLAY" || em.status === "PAUSED"
        );
        const liveMinuteMap = hasLiveMatches ? await fetchLiveMatchMinutes() : {};
        if (hasLiveMatches) {
          console.log(`[SYNC] Minutos ao vivo obtidos para ${Object.keys(liveMinuteMap).length} jogos.`);
        }
        profiler.mark("live_minutes", "api");

        for (const em of externalMatches) {
          // Proteção contra dados obsoletos da API (cache desatualizado):
          // Se a API diz IN_PLAY mas lastUpdated é muito antigo E o endpoint ao vivo
          // não confirma o jogo, ignoramos — os dados provavelmente estão incorretos.
          if (isStaleApiData(em.status, em.lastUpdated, 30)) {
            const confirmedLive = em.id in liveMinuteMap;
            if (!confirmedLive) {
              console.warn(
                `[SYNC] Jogo ${em.id} (${em.homeTeam?.tla} x ${em.awayTeam?.tla}) ignorado: ` +
                `API diz ${em.status} mas lastUpdated=${em.lastUpdated} é muito antigo e não confirmado pelo endpoint ao vivo.`
              );
              continue;
            }
          }

          const status = mapExternalStatusToInternal(em.status);

          const extracted = extractMatchResult(em.score);
          const homeScore = extracted.home;
          const awayScore = extracted.away;
          const penaltiesHome = extracted.penaltiesHome;
          const penaltiesAway = extracted.penaltiesAway;
          const regularHome = extracted.regularHome;
          const regularAway = extracted.regularAway;
          const extraTimeHome = extracted.extraTimeHome;
          const extraTimeAway = extracted.extraTimeAway;

          const result = homeScore != null ? { home: homeScore, away: awayScore } : undefined;

          const existing = findInternalMatch(em, hydratedInternalMatches);

          if (existing) {
            // Jogo bloqueado pelo admin — pular completamente
            if (existing.syncLocked) {
              console.log(`[SYNC] Jogo ${em.id} (${em.homeTeam?.tla} x ${em.awayTeam?.tla}) bloqueado pelo admin. Pulando.`);
              continue;
            }

            // Resolve minute from the dedicated live endpoint (em.minute is null in the bulk endpoint)
            const liveMinute = liveMinuteMap[em.id] ?? em.minute ?? null;

            // DEBUG: Log detalhado para jogos ao vivo ou com problemas
            const isTargetMatch = em.id === 554901 || existing.status === MatchStatus.LIVE;
            if (isTargetMatch) {
              console.log(`[SYNC DEBUG] Jogo ${em.id} (${em.homeTeam?.tla} x ${em.awayTeam?.tla}):`, {
                existingStatus: existing.status,
                newStatus: status,
                existingResult: existing.result,
                newResult: { home: homeScore, away: awayScore },
                existingLastSyncAt: existing.lastSyncAt,
                apiLastUpdated: em.lastUpdated,
                existingMinute: existing.minute,
                liveMinute: liveMinute,
              });
            }

            const isPenaltyShootout = em.score?.duration === "PENALTY_SHOOTOUT";
            const isKnockoutScore = em.score?.duration === "EXTRA_TIME" || isPenaltyShootout;
            const hasChanged =
              existing.status !== status ||
              (homeScore != null && existing.result?.home !== homeScore) ||
              (awayScore != null && existing.result?.away !== awayScore) ||
              existing.minute !== liveMinute ||
              (penaltiesHome != null && existing.penaltiesHome !== penaltiesHome) ||
              (penaltiesAway != null && existing.penaltiesAway !== penaltiesAway) ||
              // Se a API sinaliza pênaltis mas o banco ainda não tem os valores, forçar update
              (isPenaltyShootout && (existing.penaltiesHome == null || existing.penaltiesAway == null)) ||
              // Flat cols: forçar update se a API tem dados de regularTime/extraTime mas o banco não
              (isKnockoutScore && (existing.regularHome == null || existing.extraTimeHome == null)) ||
              // Verifica lastUpdated da API para detectar outras mudanças (horário, adiamento, etc)
              shouldUpdateByLastUpdated(em.lastUpdated, existing.lastSyncAt, 30);

            if (isTargetMatch) {
              console.log(`[SYNC DEBUG] Jogo ${em.id} hasChanged:`, hasChanged);
            }

            if (hasChanged) {
              // Conta mudanças reais de placar ou status (exclui simples updates de timestamp)
              const isScoreOrStatusChange =
                existing.status !== status ||
                (homeScore != null && existing.result?.home !== homeScore) ||
                (awayScore != null && existing.result?.away !== awayScore) ||
                (penaltiesHome != null && existing.penaltiesHome !== penaltiesHome) ||
                (penaltiesAway != null && existing.penaltiesAway !== penaltiesAway);
              if (isScoreOrStatusChange) scoreOrStatusChanges++;

              // Proteção: se o admin editou este jogo há menos de 2 min, não sobrescrever
              const overrideTs = adminOverridesRef.current.get(existing.id);
              if (overrideTs && Date.now() - overrideTs < 2 * 60 * 1000) {
                console.log(`[SYNC] Jogo ${existing.id} protegido por override do admin (${Math.round((Date.now() - overrideTs) / 1000)}s atrás). Pulando.`);
                continue;
              }

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
                lastSyncAt: new Date().toISOString(),
                score: em.score,
                penaltiesHome: penaltiesHome ?? null,
                penaltiesAway: penaltiesAway ?? null,
                regularHome: regularHome ?? null,
                regularAway: regularAway ?? null,
                extraTimeHome: extraTimeHome ?? null,
                extraTimeAway: extraTimeAway ?? null,
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
                lastSyncAt: new Date().toISOString(),
                score: em.score,
                penaltiesHome: penaltiesHome ?? null,
                penaltiesAway: penaltiesAway ?? null,
                regularHome: regularHome ?? null,
                regularAway: regularAway ?? null,
                extraTimeHome: extraTimeHome ?? null,
                extraTimeAway: extraTimeAway ?? null,
                liveDetails: undefined, // Novo jogo: sem liveDetails ainda
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
        profiler.mark("match_diff", "cpu");


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
        profiler.mark("matches_upsert", "db_write");

        // ── FASE 3.2: Calcular e persistir os jogos com maior diferença de gols por fase ──
        // Baseado nos jogos finalizados do banco local (recém-sync + já existentes).
        if (competitionMeta?.code && isSupabaseEnabled() && supabase) {
          const finishedInternal = (dbRef.current.matches as any[]).filter(
            (m) =>
              (m.competitionCode || "").toUpperCase() === normalizedCode &&
              m.status === MatchStatus.FINISHED &&
              m.resultHome != null &&
              m.resultAway != null,
          );

          const diffsByPhase: Record<string, { id: string; diff: number }[]> = {};
          for (const m of finishedInternal) {
            const phase = getExtraPhaseKey(m.stage, m.group);
            if (!phase) continue;
            if (!diffsByPhase[phase]) diffsByPhase[phase] = [];
            diffsByPhase[phase].push({
              id: m.id,
              diff: Math.abs(m.resultHome - m.resultAway),
            });
          }

          const computedBiggestDiffIds: Record<string, string[]> = {};
          for (const [phase, entries] of Object.entries(diffsByPhase)) {
            if (entries.length === 0) continue;
            const maxDiff = Math.max(...entries.map((e) => e.diff));
            computedBiggestDiffIds[phase] = entries
              .filter((e) => e.diff === maxDiff)
              .map((e) => e.id);
          }

          if (Object.keys(computedBiggestDiffIds).length > 0 && dbRef.current.updateCompetitionAwards) {
            try {
              await dbRef.current.updateCompetitionAwards(competitionMeta.code, {
                biggestGoalDiffMatchIds: computedBiggestDiffIds,
              });
              console.log(
                `[SYNC] biggestGoalDiffMatchIds atualizado: ${JSON.stringify(computedBiggestDiffIds)}`,
              );
            } catch (diffUpdateError: any) {
              console.warn(
                `[SYNC] Erro ao atualizar biggestGoalDiffMatchIds: ${diffUpdateError.message}`,
              );
            }
          }
        }
        profiler.mark("biggest_diff_calc", "cpu");

        // ── FASE 3.5: Detalhes ao vivo (api-sports) — minuto a minuto ────────
        // Segunda API, SÓ cosmética (relógio, eventos, árbitro, estádio). NÃO
        // entra em pontuação. Roda DENTRO do lock principal do sync, que já é
        // serializado por competição entre instâncias (acquireSyncLock). Por
        // isso NÃO precisa de lock próprio: basta um gate simples — só chama a
        // api-sports se há jogo ao vivo E já passou o intervalo mínimo desde o
        // último fetch (liveDetailsLastSync). Intervalo configurável pelo admin
        // (system_config). Default 50s.
        const LIVE_DETAILS_INTERVAL_MS =
          dbRef.current.systemConfig?.live_details_interval_ms ?? 50 * 1000;
        if (hasLiveMatches && (canWriteData || isBackgroundSync)) {
          const competition = (dbRef.current.competitions as any[])?.find(
            (c) => c.code === normalizedCode,
          );
          const lastSyncMs = competition?.liveDetailsLastSync
            ? new Date(competition.liveDetailsLastSync).getTime()
            : 0;
          const elapsedMs = Date.now() - lastSyncMs;
          const shouldFetchLive = elapsedMs >= LIVE_DETAILS_INTERVAL_MS;

          if (shouldFetchLive) {
            try {
              const liveFixtures = await fetchLiveMatchDetails();

              // Casa os fixtures ao vivo com os jogos internos primeiro.
              const matchedPairs: {
                fx: (typeof liveFixtures)[number];
                internalId: string;
              }[] = [];
              for (const fx of liveFixtures) {
                const internal = matchLiveFixtureToInternal(
                  fx,
                  hydratedInternalMatches,
                );
                if (internal) matchedPairs.push({ fx, internalId: internal.id });
              }

              // Guarda B: estatísticas (api-sports) dos jogos casados em PARALELO,
              // não em série — não estende o lock principal mais que o necessário.
              // Guarda C: `fetchLiveStats` nunca lança (retorna null em erro), então
              // uma falha de stats jamais derruba a persistência do liveDetails.
              const statsByFixture = await Promise.all(
                matchedPairs.map((p) =>
                  fetchLiveStats(
                    p.fx.details.apiSportsFixtureId,
                    p.fx.homeApiId,
                    p.fx.awayApiId,
                  ),
                ),
              );

              let liveMatched = 0;
              for (let i = 0; i < matchedPairs.length; i++) {
                const { fx, internalId } = matchedPairs[i];
                const stats = statsByFixture[i];
                if (dbRef.current.updateMatch) {
                  // Guarda D/E: só inclui `liveStats` quando veio conteúdo (spread
                  // condicional) — payload vazio/erro NÃO sobrescreve stats boas, e
                  // a chave ausente nunca nula a coluna. Vai no MESMO updateMatch do
                  // liveDetails → 1 write, 1 evento realtime.
                  await dbRef.current.updateMatch(internalId, {
                    liveDetails: fx.details,
                    ...(stats ? { liveStats: stats } : {}),
                  });
                  liveMatched++;
                }
              }
              // Só atualiza o timestamp se houve jogos casados E elapsed foi válido (> 0)
              // Se elapsed for null/zero, provável erro na API — não atualiza para não bloquear o throttle
              if (liveMatched > 0 && elapsedMs > 0) {
                if (dbRef.current.updateCompetitionLiveDetailsSync) {
                  await dbRef.current.updateCompetitionLiveDetailsSync(
                    normalizedCode,
                    new Date().toISOString(),
                  );
                }
                const liveUnmatched = liveFixtures.length - liveMatched;
                const nextInSec = Math.round(LIVE_DETAILS_INTERVAL_MS / 1000);
                console.log(
                  `[SYNC][LIVE DETAILS] ✅ api-sports OK — ${liveFixtures.length} jogo(s) ao vivo · ${liveMatched} casado(s) com o bolão${
                    liveUnmatched > 0 ? ` · ${liveUnmatched} sem correspondência` : ""
                  } · próxima chamada em ~${nextInSec}s`,
                );
              } else {
                console.warn(
                  `[SYNC][LIVE DETAILS] ⚠️ Payload vazio ou elapsed inválido (${elapsedMs}ms) — não atualizando liveDetailsLastSync para não bloquear throttle`,
                );
              }
            } catch (liveErr) {
              console.warn("[SYNC] Falha ao processar detalhes ao vivo:", liveErr);
            }
          } else {
            console.log(
              `[SYNC] Detalhes ao vivo: throttle ativo (${Math.round(elapsedMs / 1000)}s desde o último fetch, mínimo ${Math.round(LIVE_DETAILS_INTERVAL_MS / 1000)}s). Pulando api-sports.`,
            );
          }
        }
        profiler.mark("live_details", "api");

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
        profiler.mark("points_recalc", "db_write");

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

              // Fixtures are the authoritative source for a team's group. The
              // standings API occasionally returns garbage group labels (e.g.
              // "Atlantic Division"/"Central Division" instead of Group H), so
              // prefer the match-derived group and only fall back to the API
              // label when the team has no group-stage fixture.
              const groupFromMatches = row.team.id
                ? teamGroupFromMatches.get(row.team.id) ?? null
                : null;
              const resolvedGroup = groupFromMatches || group.group || null;

              standingUpserts.push({
                teamId: team.id,
                competitionCode: normalizedCode,
                season: standingsData.filters?.season || getCurrentSeason(),
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

        // Passo 3: Só recalcular se houve mudança REAL de placar/status ou novo jogo finalizado.
        // matchesUpdated inclui updates de timestamp (lastSyncAt) sem mudança de pontuação —
        // usar scoreOrStatusChanges garante que o recalc só roda quando os pontos podem ter mudado.
        const hasChanges = scoreOrStatusChanges > 0 || finishedMatchesForPoints.length > 0;

        if (affectedGroupIds.length > 0 && hasChanges) {
          await recalculateUserGroupPoints(affectedGroupIds);
        } else if (!hasChanges) {
          console.log("[SYNC] Nenhuma mudança detectada — recalc de pontos ignorado.");
        }
        profiler.mark("standings_and_recalc", "db_write");

        const combinedMessage = `${matchesMessage} ${standingsMessage}`;

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
        // Libera o lock distribuído no banco
        await dbRef.current.releaseSyncLock(normalizedCode);
        profiler.mark("lock_release", "lock");
        profiler.log();
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
    registerAdminOverride,
  };
};
