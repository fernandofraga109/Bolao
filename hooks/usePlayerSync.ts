import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import {
  fetchCompetitionTeams,
  fetchCompetitionScorers,
  type ExternalScorersResponse,
} from '../services/liveScoreService';
import { PlayerDB, TournamentPlayerDB, PlayerWithContextDB } from '../types';

type IdentityRow = Omit<PlayerDB, 'id'>;
type TournamentRow = Omit<TournamentPlayerDB, 'id'>;

/**
 * Persists an already-fetched scorers payload into `players` + `tournament_players`.
 *
 * Module-level (not part of the hook) so the match/standings sync pipeline
 * (`useSyncSystem`) can reuse it WITHOUT making a second `/api/scorers` call —
 * the pipeline already fetches `scorersData` in its parallel phase.
 *
 * Returns the number of tournament rows written (or an error message).
 */
export const persistScorers = async (
  competitionCode: string,
  scorersData: ExternalScorersResponse | null
): Promise<{ synced: number; error?: string }> => {
  if (!isSupabaseEnabled() || !supabase) return { synced: 0, error: 'Supabase not enabled' };
  if (!scorersData?.scorers?.length) return { synced: 0 };

  const code = (competitionCode || '').toUpperCase();

  const identityBatch: IdentityRow[] = scorersData.scorers.map((scorer) => ({
    externalPlayerId: scorer.player.id,
    name: scorer.player.name,
    firstName: scorer.player.firstName,
    lastName: scorer.player.lastName,
    dateOfBirth: scorer.player.dateOfBirth,
    nationality: scorer.player.nationality,
  }));

  const { data: upserted, error: identityError } = await supabase
    .from('players')
    .upsert(identityBatch, { onConflict: '"externalPlayerId"', ignoreDuplicates: false })
    .select('id, externalPlayerId');

  if (identityError) return { synced: 0, error: identityError.message };

  const extIdToUuid = new Map<number, string>(
    (upserted ?? []).map((r: any) => [r.externalPlayerId, r.id])
  );

  const tournamentBatch: TournamentRow[] = scorersData.scorers
    .filter((scorer) => extIdToUuid.has(scorer.player.id))
    .map((scorer) => ({
      playerId: extIdToUuid.get(scorer.player.id)!,
      competitionCode: code,
      externalTeamId: scorer.team.id,
      teamName: scorer.team.name,
      goals: scorer.goals ?? 0,
      assists: scorer.assists ?? 0,
      penalties: scorer.penalties ?? 0,
      playedMatches: 0,
      lastUpdated: new Date().toISOString(),
    }));

  if (tournamentBatch.length === 0) return { synced: 0 };

  const { error: tpError } = await supabase
    .from('tournament_players')
    .upsert(tournamentBatch, {
      onConflict: '"playerId","competitionCode"',
      ignoreDuplicates: false,
    });

  if (tpError) return { synced: 0, error: tpError.message };
  return { synced: tournamentBatch.length };
};

export const usePlayerSync = () => {
  const [players, setPlayers] = useState<PlayerWithContextDB[]>([]);
  const [isSyncingPlayers, setIsSyncingPlayers] = useState(false);

  useEffect(() => {
    void fetchPlayers();
  }, []);

  // Supabase caps a single select at 1000 rows. WC squads alone are ~1248 players,
  // so the catalog MUST be paged or names silently fail to resolve for the overflow.
  const PAGE_SIZE = 1000;
  const fetchAllRows = async (
    build: () => any // returns a fresh PostgREST query builder (without range)
  ): Promise<any[]> => {
    const all: any[] = [];
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
      if (error || !data) break;
      all.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  };

  const fetchPlayers = async () => {
    if (!isSupabaseEnabled() || !supabase) return;

    const [playerRows, tpRows] = await Promise.all([
      fetchAllRows(() => supabase!.from('players').select('*')),
      fetchAllRows(() =>
        supabase!
          .from('tournament_players')
          .select(
            'id, playerId, competitionCode, externalTeamId, teamName, teamCrest, goals, assists, penalties, playedMatches, lastUpdated'
          )
          .order('goals', { ascending: false })
      ),
    ]);

    if (!playerRows || playerRows.length === 0) return;

    // Best tournament entry per player (highest goals)
    const tpMap = new Map<string, any>();
    for (const row of tpRows || []) {
      const existing = tpMap.get(row.playerId);
      if (!existing || row.goals > existing.goals) tpMap.set(row.playerId, row);
    }

    setPlayers(
      playerRows.map((player: any) => {
        const tp = tpMap.get(player.id);
        return {
          ...player,
          tournamentEntry: tp
            ? ({
                id: tp.id,
                playerId: tp.playerId,
                competitionCode: tp.competitionCode,
                externalTeamId: tp.externalTeamId,
                teamName: tp.teamName,
                teamCrest: tp.teamCrest,
                goals: tp.goals,
                assists: tp.assists,
                penalties: tp.penalties,
                playedMatches: tp.playedMatches,
                lastUpdated: tp.lastUpdated,
              } satisfies TournamentPlayerDB)
            : ({
                id: '',
                playerId: player.id,
                competitionCode: '',
                externalTeamId: 0,
                teamName: '',
                goals: 0,
                assists: 0,
                penalties: 0,
                playedMatches: 0,
              } satisfies TournamentPlayerDB),
        } as PlayerWithContextDB;
      })
    );
  };

  const syncSquads = async (
    competitionCodes: string[]
  ): Promise<{ synced: number; errors: string[] }> => {
    if (!isSupabaseEnabled() || !supabase) return { synced: 0, errors: ['Supabase not enabled'] };
    setIsSyncingPlayers(true);
    let synced = 0;
    const errors: string[] = [];

    try {
      const identityMap = new Map<number, IdentityRow>();
      const tournamentRows: Array<{
        extId: number;
        competitionCode: string;
        externalTeamId: number;
        teamName: string;
        teamCrest?: string;
      }> = [];

      for (const code of competitionCodes) {
        const teams = await fetchCompetitionTeams(code);
        for (const team of teams) {
          for (const player of team.squad || []) {
            identityMap.set(player.id, {
              externalPlayerId: player.id,
              name: player.name,
              position: player.position,
              dateOfBirth: player.dateOfBirth,
              nationality: player.nationality,
            });
            tournamentRows.push({
              extId: player.id,
              competitionCode: code,
              externalTeamId: team.id,
              teamName: team.name,
              teamCrest: team.crest,
            });
          }
        }
      }

      if (identityMap.size === 0) {
        await fetchPlayers();
        return { synced: 0, errors };
      }

      const identityBatch = Array.from(identityMap.values());
      const { data: upserted, error: identityError } = await supabase
        .from('players')
        .upsert(identityBatch, { onConflict: '"externalPlayerId"', ignoreDuplicates: false })
        .select('id, externalPlayerId');

      if (identityError) {
        errors.push(`identity upsert: ${identityError.message}`);
        await fetchPlayers();
        return { synced, errors };
      }

      const extIdToUuid = new Map<number, string>(
        (upserted ?? []).map((r: any) => [r.externalPlayerId, r.id])
      );

      const tournamentBatch: TournamentRow[] = tournamentRows
        .filter((r) => extIdToUuid.has(r.extId))
        .map((r) => ({
          playerId: extIdToUuid.get(r.extId)!,
          competitionCode: r.competitionCode,
          externalTeamId: r.externalTeamId,
          teamName: r.teamName,
          teamCrest: r.teamCrest,
          goals: 0,
          assists: 0,
          penalties: 0,
          playedMatches: 0,
          lastUpdated: new Date().toISOString(),
        }));

      if (tournamentBatch.length > 0) {
        const { error: tpError } = await supabase
          .from('tournament_players')
          .upsert(tournamentBatch, {
            onConflict: '"playerId","competitionCode"',
            ignoreDuplicates: true,
          });
        if (tpError) {
          errors.push(`tournament upsert: ${tpError.message}`);
        } else {
          synced += tournamentBatch.length;
        }
      }
    } finally {
      setIsSyncingPlayers(false);
    }

    await fetchPlayers();
    return { synced, errors };
  };

  const syncScorers = async (
    competitionCodes: string[]
  ): Promise<{ synced: number; errors: string[] }> => {
    if (!isSupabaseEnabled() || !supabase) return { synced: 0, errors: ['Supabase not enabled'] };
    setIsSyncingPlayers(true);
    let synced = 0;
    const errors: string[] = [];

    try {
      for (const code of competitionCodes) {
        const response = await fetchCompetitionScorers(code);
        if (!response) continue;

        const result = await persistScorers(code, response);
        if (result.error) errors.push(`${code}: ${result.error}`);
        else synced += result.synced;
      }
    } finally {
      setIsSyncingPlayers(false);
    }

    await fetchPlayers();
    return { synced, errors };
  };

  const searchPlayers = async (
    query: string,
    competitionCode?: string
  ): Promise<PlayerWithContextDB[]> => {
    if (!isSupabaseEnabled() || !supabase) return [];

    // Step 1: find player IDs matching the name query
    const { data: nameRows } = await supabase
      .from('players')
      .select('id')
      .ilike('name', `%${query}%`)
      .limit(50);

    if (!nameRows || nameRows.length === 0) return [];

    const ids = nameRows.map((r: any) => r.id);

    // Step 2: query tournament entries for those IDs, optionally scoped by competition
    let tpQuery = supabase
      .from('tournament_players')
      .select(
        'id, playerId, competitionCode, externalTeamId, teamName, teamCrest, goals, assists, penalties, playedMatches, lastUpdated'
      )
      .in('playerId', ids)
      .order('goals', { ascending: false })
      .limit(20);

    if (competitionCode) {
      tpQuery = tpQuery.ilike('competitionCode', competitionCode);
    }

    const { data: tpRows } = await tpQuery;

    if (!tpRows || tpRows.length === 0) return [];

    // Step 3: fetch full player rows for the matched tournament entries
    const matchedPlayerIds = [...new Set(tpRows.map((r: any) => r.playerId))];
    const { data: playerRows } = await supabase
      .from('players')
      .select('*')
      .in('id', matchedPlayerIds);

    if (!playerRows) return [];

    const playerMap = new Map<string, any>(playerRows.map((p: any) => [p.id, p]));

    return tpRows
      .map((tp: any) => {
        const player = playerMap.get(tp.playerId);
        if (!player) return null;
        return {
          ...player,
          tournamentEntry: {
            id: tp.id,
            playerId: tp.playerId,
            competitionCode: tp.competitionCode,
            externalTeamId: tp.externalTeamId,
            teamName: tp.teamName,
            teamCrest: tp.teamCrest,
            goals: tp.goals,
            assists: tp.assists,
            penalties: tp.penalties,
            playedMatches: tp.playedMatches,
            lastUpdated: tp.lastUpdated,
          } satisfies TournamentPlayerDB,
        } as PlayerWithContextDB;
      })
      .filter(Boolean) as PlayerWithContextDB[];
  };

  // Top scorers list scoped to a single competition, ordered by goals.
  // Unlike `players` (whose tournamentEntry is the player's best entry across all
  // competitions), this queries `tournament_players` directly for the active
  // competition so the ranking is accurate even for multi-competition players.
  const getTopScorers = async (
    competitionCode: string,
    limit = 30
  ): Promise<PlayerWithContextDB[]> => {
    if (!isSupabaseEnabled() || !supabase || !competitionCode) return [];

    const { data: tpRows } = await supabase
      .from('tournament_players')
      .select(
        'id, playerId, competitionCode, externalTeamId, teamName, teamCrest, goals, assists, penalties, playedMatches, lastUpdated'
      )
      .ilike('competitionCode', competitionCode)
      .gt('goals', 0)
      .order('goals', { ascending: false })
      .order('assists', { ascending: false })
      .order('penalties', { ascending: true })
      .limit(limit);

    if (!tpRows || tpRows.length === 0) return [];

    const playerIds = [...new Set(tpRows.map((r: any) => r.playerId))];
    const { data: playerRows } = await supabase
      .from('players')
      .select('*')
      .in('id', playerIds);

    const playerMap = new Map<string, any>((playerRows || []).map((p: any) => [p.id, p]));

    return tpRows
      .map((tp: any) => {
        const player = playerMap.get(tp.playerId);
        if (!player) return null;
        return {
          ...player,
          tournamentEntry: {
            id: tp.id,
            playerId: tp.playerId,
            competitionCode: tp.competitionCode,
            externalTeamId: tp.externalTeamId,
            teamName: tp.teamName,
            teamCrest: tp.teamCrest,
            goals: tp.goals,
            assists: tp.assists,
            penalties: tp.penalties,
            playedMatches: tp.playedMatches,
            lastUpdated: tp.lastUpdated,
          } satisfies TournamentPlayerDB,
        } as PlayerWithContextDB;
      })
      .filter(Boolean) as PlayerWithContextDB[];
  };

  // Targeted resolver: fetch player identities by their UUIDs directly from the DB,
  // independent of the in-memory `players` cache. Used to display saved prediction
  // names reliably even if the catalog is still loading or incomplete.
  const getPlayersByIds = async (ids: string[]): Promise<PlayerDB[]> => {
    if (!isSupabaseEnabled() || !supabase) return [];
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return [];
    const { data } = await supabase.from('players').select('*').in('id', unique);
    return (data as PlayerDB[]) || [];
  };

  return {
    players,
    isSyncingPlayers,
    syncSquads,
    syncScorers,
    searchPlayers,
    getTopScorers,
    getPlayersByIds,
  };
};
