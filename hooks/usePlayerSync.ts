import { useState, useEffect } from 'react';
import { supabase, isSupabaseEnabled } from '../services/supabase';
import { fetchCompetitionTeams, fetchCompetitionScorers } from '../services/liveScoreService';
import { PlayerDB, TournamentPlayerDB, PlayerWithContextDB } from '../types';

type IdentityRow = Omit<PlayerDB, 'id'>;
type TournamentRow = Omit<TournamentPlayerDB, 'id'>;

export const usePlayerSync = () => {
  const [players, setPlayers] = useState<PlayerWithContextDB[]>([]);
  const [isSyncingPlayers, setIsSyncingPlayers] = useState(false);

  useEffect(() => {
    void fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    if (!isSupabaseEnabled() || !supabase) return;

    const { data: tpRows } = await supabase
      .from('tournament_players')
      .select(
        'id, playerId, competitionCode, externalTeamId, teamName, teamCrest, goals, assists, penalties, playedMatches, lastUpdated'
      )
      .order('goals', { ascending: false });

    if (!tpRows || tpRows.length === 0) return;

    const playerIds = [...new Set(tpRows.map((r: any) => r.playerId))];
    const { data: playerRows } = await supabase.from('players').select('*').in('id', playerIds);

    if (!playerRows) return;

    const playerMap = new Map<string, any>(playerRows.map((p: any) => [p.id, p]));

    setPlayers(
      tpRows
        .map((row: any) => {
          const player = playerMap.get(row.playerId);
          if (!player) return null;
          return {
            ...player,
            tournamentEntry: {
              id: row.id,
              playerId: row.playerId,
              competitionCode: row.competitionCode,
              externalTeamId: row.externalTeamId,
              teamName: row.teamName,
              teamCrest: row.teamCrest,
              goals: row.goals,
              assists: row.assists,
              penalties: row.penalties,
              playedMatches: row.playedMatches,
              lastUpdated: row.lastUpdated,
            } satisfies TournamentPlayerDB,
          } as PlayerWithContextDB;
        })
        .filter(Boolean) as PlayerWithContextDB[]
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

        const identityBatch: IdentityRow[] = response.scorers.map((scorer) => ({
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

        if (identityError) {
          errors.push(`${code} identity: ${identityError.message}`);
          continue;
        }

        const extIdToUuid = new Map<number, string>(
          (upserted ?? []).map((r: any) => [r.externalPlayerId, r.id])
        );

        const tournamentBatch: TournamentRow[] = response.scorers
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

        if (tournamentBatch.length > 0) {
          const { error: tpError } = await supabase
            .from('tournament_players')
            .upsert(tournamentBatch, {
              onConflict: '"playerId","competitionCode"',
              ignoreDuplicates: false,
            });
          if (tpError) {
            errors.push(`${code} stats: ${tpError.message}`);
          } else {
            synced += tournamentBatch.length;
          }
        }
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

  return { players, isSyncingPlayers, syncSquads, syncScorers, searchPlayers };
};
