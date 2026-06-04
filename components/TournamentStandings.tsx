import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Match, MatchStatus, Team, TeamDB } from "../types";
import { COMPETITION_OPTIONS } from "../data/competitions";
import {
  Table2,
  GitMerge,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useDatabase } from "../contexts/DatabaseContext";
import {
  ExternalStandingGroup,
  fetchExternalStandings,
  getCurrentSeason,
} from "../services/liveScoreService";
import { translateGroupName } from "../utils/translations";

interface TournamentStandingsProps {
  matches: Match[];
  competitionCode?: string;
  canPersistToDatabase?: boolean;
}

interface TeamStats {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number; // Goals For
  ga: number; // Goals Against
  gd: number; // Goal Difference
  points: number;
}

const uniqueTeamStats = (rows: TeamStats[]): TeamStats[] => {
  const byTeamKey = new Map<string, TeamStats>();

  rows.forEach((row) => {
    const key = (row.team.id || row.team.code || "").toLowerCase();
    if (!key) return;

    const current = byTeamKey.get(key);
    if (!current) {
      byTeamKey.set(key, row);
      return;
    }

    const currentScore =
      current.points * 1000 +
      current.gd * 100 +
      current.gf * 10 +
      current.played;
    const nextScore =
      row.points * 1000 + row.gd * 100 + row.gf * 10 + row.played;

    if (nextScore > currentScore) {
      byTeamKey.set(key, row);
    }
  });

  return Array.from(byTeamKey.values());
};

const TournamentStandings: React.FC<TournamentStandingsProps> = ({
  matches,
  competitionCode = "WC",
  canPersistToDatabase = false,
}) => {
  const db = useDatabase();
  const [view, setView] = useState<"groups" | "knockout">("groups");
  const [isLoadingStandings, setIsLoadingStandings] = useState(false);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [apiStandings, setApiStandings] = useState<Record<
    string,
    TeamStats[]
  > | null>(null);
  const [standingsSource, setStandingsSource] = useState<
    "api" | "cache" | "local"
  >("local");

  const STANDINGS_SEASON = getCurrentSeason();
  const normalizeCompetition = (value?: string) =>
    (value || "WC").toUpperCase();

  const buildStandingsFromExternal = useCallback(
    (groupsData: ExternalStandingGroup[]) => {
      const mapped: Record<string, TeamStats[]> = {};

      groupsData.forEach((groupEntry) => {
        const groupName = groupEntry.group
          ? translateGroupName(groupEntry.group)
          : "Tabela";
        const rows = Array.isArray(groupEntry.table) ? groupEntry.table : [];

        const mappedRows = rows.map((row) => {
          const code = (row.team?.tla || "").toUpperCase();
          const existing = db.teams.find(
            (t) =>
              t && (t.code.toUpperCase() === code || t.externalTeamId === row.team.id),
          );

          const team: Team = existing || {
            id: crypto.randomUUID(),
            name: row.team?.name || code || "TBD",
            code: code || "TBD",
            flag: row.team?.crest || "/favicon.ico",
            ranking: 999,
          };

          return {
            team,
            played: row.playedGames || 0,
            won: row.won || 0,
            drawn: row.draw || 0,
            lost: row.lost || 0,
            gf: row.goalsFor || 0,
            ga: row.goalsAgainst || 0,
            gd: row.goalDifference || 0,
            points: row.points || 0,
          };
        });

        mapped[groupName] = uniqueTeamStats(mappedRows).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.gd !== a.gd) return b.gd - a.gd;
          return b.gf - a.gf;
        });
      });

      return mapped;
    },
    [db.teams, db.teamStandings, competitionCode],
  );

  const cachedStandings = useMemo<Record<string, TeamStats[]> | null>(() => {
    const now = Date.now();
    const grouped: Record<string, TeamStats[]> = {};

    db.teams.forEach((t) => {
      const standing = db.teamStandings.find(
        (ts) =>
          ts.teamId === t.id &&
          normalizeCompetition(ts.competitionCode) ===
            normalizeCompetition(competitionCode),
      );

      if (!standing) return;

      const groupName = standing.group
        ? translateGroupName(standing.group)
        : "Tabela";
      if (!grouped[groupName]) grouped[groupName] = [];

      const team: Team = {
        ...t,
        standingsCompetitionCode: standing.competitionCode,
        standingsSeason: standing.season,
        standingsStage: standing.stage,
        standingsType: standing.type,
        standingsGroup: standing.group,
        standingsPosition: standing.position,
        standingsPlayedGames: standing.playedGames,
        standingsForm: standing.form,
        standingsWon: standing.won,
        standingsDraw: standing.draw,
        standingsLost: standing.lost,
        standingsPoints: standing.points,
        standingsGoalsFor: standing.goalsFor,
        standingsGoalsAgainst: standing.goalsAgainst,
        standingsGoalDifference: standing.goalDifference,
        standingsUpdatedAt: standing.updatedAt,
      };

      grouped[groupName].push({
        team,
        played: team.standingsPlayedGames || 0,
        won: team.standingsWon || 0,
        drawn: team.standingsDraw || 0,
        lost: team.standingsLost || 0,
        gf: team.standingsGoalsFor || 0,
        ga: team.standingsGoalsAgainst || 0,
        gd: team.standingsGoalDifference || 0,
        points: team.standingsPoints || 0,
      });
    });

    const keys = Object.keys(grouped);
    if (keys.length === 0) return null;

    keys.forEach((groupName) => {
      grouped[groupName].sort((a, b) => {
        const posA = a.team.standingsPosition ?? 999;
        const posB = b.team.standingsPosition ?? 999;
        if (posA !== posB) return posA - posB;
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });

      grouped[groupName] = uniqueTeamStats(grouped[groupName]);
    });

    return grouped;
  }, [db.teams, db.teamStandings, competitionCode]);

  // --- Calculate Group Standings ---
  const standings = useMemo<Record<string, TeamStats[]>>(() => {
    const groups: Record<string, Record<string, TeamStats>> = {};

    // Initialize stats map based on matches to find all teams and groups
    matches.forEach((match) => {
      if (!groups[match.group]) {
        groups[match.group] = {};
      }

      // Initialize Home Team
      if (!groups[match.group][match.homeTeam.id]) {
        groups[match.group][match.homeTeam.id] = {
          team: match.homeTeam,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          points: 0,
        };
      }
      // Initialize Away Team
      if (!groups[match.group][match.awayTeam.id]) {
        groups[match.group][match.awayTeam.id] = {
          team: match.awayTeam,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          points: 0,
        };
      }

      // Calculate Stats if match is finished
      if (match.status === MatchStatus.FINISHED && match.result) {
        const homeStats = groups[match.group][match.homeTeam.id];
        const awayStats = groups[match.group][match.awayTeam.id];
        const { home, away } = match.result;

        // Played
        homeStats.played += 1;
        awayStats.played += 1;

        // Goals
        homeStats.gf += home;
        homeStats.ga += away;
        homeStats.gd = homeStats.gf - homeStats.ga;

        awayStats.gf += away;
        awayStats.ga += home;
        awayStats.gd = awayStats.gf - awayStats.ga;

        // Points & WDL
        if (home > away) {
          homeStats.won += 1;
          homeStats.points += 3;
          awayStats.lost += 1;
        } else if (away > home) {
          awayStats.won += 1;
          awayStats.points += 3;
          homeStats.lost += 1;
        } else {
          homeStats.drawn += 1;
          homeStats.points += 1;
          awayStats.drawn += 1;
          awayStats.points += 1;
        }
      }
    });

    // Convert to sorted arrays
    const sortedGroups: Record<string, TeamStats[]> = {};
    Object.keys(groups)
      .sort()
      .forEach((groupName) => {
        sortedGroups[groupName] = Object.values(groups[groupName]).sort(
          (a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.gd !== a.gd) return b.gd - a.gd;
            return b.gf - a.gf;
          },
        );
      });

    return sortedGroups;
  }, [matches]);

  const loadGroupStandings = useCallback(
    async (forceRefresh = false) => {
      setStandingsError(null);

      if (!canPersistToDatabase) {
        if (cachedStandings) {
          setApiStandings(cachedStandings);
          setStandingsSource("cache");
        } else {
          setApiStandings(null);
          setStandingsSource("local");
        }
        return;
      }

      if (!forceRefresh && cachedStandings) {
        setApiStandings(cachedStandings);
        setStandingsSource("cache");
        return;
      }

      setIsLoadingStandings(true);
      try {
        const data = await fetchExternalStandings(
          competitionCode,
          STANDINGS_SEASON,
        );
        if (!data || !Array.isArray(data.standings)) {
          throw new Error("Sem dados de standings na API.");
        }

        const groupsData = data.standings.filter(
          (entry) =>
            entry.type === "TOTAL" &&
            (typeof entry.group === "string" ||
              entry.stage == "REGULAR_SEASON") &&
            Array.isArray(entry.table),
        );

        if (groupsData.length === 0) {
          throw new Error("A API não retornou grupos válidos.");
        }

        const parsed = buildStandingsFromExternal(groupsData);
        setApiStandings(parsed);
        setStandingsSource("api");

        const updatedAt = new Date().toISOString();

        // Removed automatic persisting to database on view to prevent API spam.
        // Persistence should only happen via explicit admin 'Sync' actions using useMatchSystem.
      } catch (error: any) {
        console.error("Erro ao carregar standings:", error);
        setStandingsError(error?.message || "Falha ao carregar standings.");
        if (cachedStandings) {
          setApiStandings(cachedStandings);
          setStandingsSource("cache");
        }
      } finally {
        setIsLoadingStandings(false);
      }
    },
    [
      buildStandingsFromExternal,
      cachedStandings,
      canPersistToDatabase,
      competitionCode,
      db,
    ],
  );

  useEffect(() => {
    setApiStandings(null);
    setStandingsSource("local");
    setStandingsError(null);

    // Automatically trigger load when competition changes
    void loadGroupStandings();
  }, [competitionCode, loadGroupStandings]);

  const KNOCKOUT_STAGE_PATTERNS =
    /^(LAST_16|LAST_32|ROUND_OF_16|ROUND_OF_32|QUARTER_FINAL|SEMI_FINAL|FINAL|THIRD_PLACE|PLAY_OFF)/i;

  const isKnockoutGroupName = (name: string) => {
    return KNOCKOUT_STAGE_PATTERNS.test(name.replace(/\s+/g, "_"));
  };

  const resolvedStandings = useMemo(() => {
    if (apiStandings && Object.keys(apiStandings).length > 0) return apiStandings;

    // Count total teams in cache vs local standings
    const cacheTeamCount = Object.values(cachedStandings || {}).reduce((acc, teams) => acc + teams.length, 0);
    const localTeamCount = Object.values(standings).reduce((acc, teams) => acc + teams.length, 0);

    if (cacheTeamCount >= localTeamCount && cacheTeamCount > 0) {
      return cachedStandings!;
    }
    return standings;
  }, [apiStandings, cachedStandings, standings]);

  // Split standings into group-phase and knockout-phase for correct tab rendering
  const groupStageStandings = useMemo(() => {
    const filtered: Record<string, TeamStats[]> = {};
    Object.entries(resolvedStandings).forEach(([key, val]) => {
      if (!isKnockoutGroupName(key)) filtered[key] = val;
    });
    return filtered;
  }, [resolvedStandings]);

  const knockoutMatches = useMemo(() => {
    return matches
      .filter((m) => isKnockoutGroupName(m.group))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches]);

  const groupedKnockoutMatches = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    knockoutMatches.forEach((m) => {
      const gName = m.group || "Eliminatórias";
      if (!groups[gName]) groups[gName] = [];
      groups[gName].push(m);
    });
    return groups;
  }, [knockoutMatches]);

  const [openKnockoutGroups, setOpenKnockoutGroups] = useState<
    Record<string, boolean>
  >({});

  const toggleKnockoutGroup = (groupName: string) => {
    setOpenKnockoutGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  useEffect(() => {
    // Open the latest stage by default
    const keys = Object.keys(groupedKnockoutMatches);
    if (keys.length > 0) {
      setOpenKnockoutGroups((prev) => {
        const next = { ...prev };
        keys.forEach((k) => {
          if (next[k] === undefined) next[k] = true;
        });
        return next;
      });
    }
  }, [groupedKnockoutMatches]);

  const isRegularSeason = useMemo(() => {
    // Check db.competitions for type info (dynamic, from API)
    const dbComp = db.competitions.find(
      (c) => c.code.toUpperCase() === competitionCode.toUpperCase(),
    );
    if (dbComp?.type) {
      return dbComp.type === "LEAGUE";
    }

    return (
      COMPETITION_OPTIONS.find((c) => c.code === competitionCode.toUpperCase())
        ?.type === "LEAGUE"
    );
  }, [resolvedStandings, competitionCode, db.competitions]);

  const lastUpdated = useMemo(() => {
    const dbComp = db.competitions.find(
      (c) => c.code.toUpperCase() === competitionCode.toUpperCase(),
    );
    if (dbComp?.lastSync) {
      return new Date(dbComp.lastSync).toLocaleString("pt-BR");
    }

    // Fallback to team updates if competition record doesn't have it yet
    let latest: Date | null = null;
    db.teamStandings.forEach((ts) => {
      if (
        normalizeCompetition(ts.competitionCode) ===
        normalizeCompetition(competitionCode)
      ) {
        if (ts.updatedAt) {
          const d = new Date(ts.updatedAt);
          if (!latest || d > latest) latest = d;
        }
      }
    });
    return latest ? latest.toLocaleString("pt-BR") : null;
  }, [db.competitions, db.teamStandings, competitionCode]);

  // Se for temporada regular, garantimos a visualização de grupos (tabela)
  useEffect(() => {
    if (isRegularSeason && view !== "groups") {
      setView("groups");
    }
  }, [isRegularSeason, view]);

  return (
    <div className="w-full max-w-2xl mx-auto pb-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl mb-6 shadow-lg text-center text-white">
        <h2 className="text-2xl font-bold mb-1">Tabela da Competição</h2>
        <p className="opacity-90 text-sm">
          {isRegularSeason
            ? "Acompanhe a classificação"
            : "Acompanhe os grupos e o mata-mata"}
        </p>
      </div>

      {/* Toggle View */}
      {!isRegularSeason && (
        <div className="flex bg-slate-800 p-1 rounded-xl mb-6 border border-slate-700">
          <button
            onClick={() => setView("groups")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
              view === "groups"
                ? "bg-slate-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Table2 size={16} />
            Fase de Grupos
          </button>
          <button
            onClick={() => setView("knockout")}
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
              view === "knockout"
                ? "bg-slate-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <GitMerge size={16} />
            Mata-Mata
          </button>
        </div>
      )}

      {/* Groups View */}
      {view === "groups" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">
              Fonte:{" "}
              {standingsSource === "api" ? "API oficial" : "cálculo local"}
            </span>
            {canPersistToDatabase ? (
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-[10px] text-slate-500 mr-2">
                    Atualizado: {lastUpdated}
                  </span>
                )}
                <button
                  onClick={() => void loadGroupStandings(true)}
                  disabled={isLoadingStandings}
                  className="text-xs bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-slate-300 flex items-center gap-2 disabled:opacity-60"
                >
                  <RefreshCw
                    size={12}
                    className={isLoadingStandings ? "animate-spin" : ""}
                  />
                  Atualizar Tabela
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500 flex flex-col items-end">
                <span>Somente admin atualiza standings</span>
                {lastUpdated && (
                  <span className="opacity-70 mt-0.5">
                    Última atualização: {lastUpdated}
                  </span>
                )}
              </span>
            )}
          </div>

          {standingsError && (
            <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
              {standingsError}
            </div>
          )}

          {Object.keys(groupStageStandings).length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              <p>Nenhum jogo cadastrado ainda.</p>
            </div>
          ) : (
            (Object.entries(groupStageStandings) as [string, TeamStats[]][])
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([groupName, teams]) => (
              <div
                key={groupName}
                className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-sm"
              >
                <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold text-white">{translateGroupName(groupName)}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/30 text-slate-400 text-[10px] uppercase tracking-wider">
                        <th className="px-3 py-2 text-left font-medium">
                          Seleção
                        </th>
                        <th className="px-2 py-2 text-center font-medium w-8">
                          P
                        </th>
                        <th className="px-2 py-2 text-center font-medium w-8">
                          J
                        </th>
                        <th className="px-2 py-2 text-center font-medium w-8">
                          V
                        </th>
                        <th className="px-2 py-2 text-center font-medium w-8">
                          SG
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {teams.map((stats, index) => (
                        <tr
                          key={`${groupName}-${stats.team.id || stats.team.code}-${index}`}
                          className={`${index < 2 ? "bg-brand-green/5" : ""}`}
                        >
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              <span
                                className={`text-xs font-mono w-4 ${index < 2 ? "text-brand-green font-bold" : "text-slate-500"}`}
                              >
                                {index + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 flex items-center justify-center bg-slate-900/40 rounded border border-slate-700/30 overflow-hidden">
                                  <img
                                    src={stats.team.flag}
                                    alt={stats.team.code}
                                    className="w-4 h-4 object-contain"
                                  />
                                </div>

                                <span
                                  className={`font-semibold ${index < 2 ? "text-white" : "text-slate-300"}`}
                                >
                                  {stats.team.code}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-white">
                            {stats.points}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-400">
                            {stats.played}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-400">
                            {stats.won}
                          </td>
                          <td className="px-2 py-2 text-center text-slate-400">
                            {stats.gd > 0 ? `+${stats.gd}` : stats.gd}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Knockout View - Fully Dynamic */}
      {view === "knockout" && (
        <div className="space-y-4">
          {Object.keys(groupedKnockoutMatches).length > 0 ? (
            Object.entries(groupedKnockoutMatches).map(
              ([groupName, stageMatches]) => {
                const isOpen = openKnockoutGroups[groupName] ?? true;
                return (
                  <div key={groupName} className="space-y-3">
                    <button
                      onClick={() => toggleKnockoutGroup(groupName)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-brand-green/10 rounded-lg text-brand-green">
                          <GitMerge size={16} />
                        </div>
                        <h3 className="text-white font-bold text-sm uppercase tracking-wider">
                          {translateGroupName(groupName)}
                        </h3>
                      </div>
                      {isOpen ? (
                        <ChevronUp size={18} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-500" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="grid gap-3 animate-fadeIn">
                        {stageMatches.map((match) => (
                          <div
                            key={match.id}
                            className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm"
                          >
                            <div className="flex-1 flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                {match.homeTeam.flag && (
                                  <img
                                    src={match.homeTeam.flag}
                                    alt=""
                                    className="w-5 h-5 object-contain"
                                  />
                                )}
                                <span className="text-sm font-bold text-white">
                                  {match.homeTeam.code}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-center px-4 min-w-[100px]">
                              {match.status === MatchStatus.FINISHED ? (
                                <div className="flex items-center gap-3">
                                  <span className="text-xl font-black text-white">
                                    {match.result?.home}
                                  </span>
                                  <span className="text-slate-600 font-bold">
                                    x
                                  </span>
                                  <span className="text-xl font-black text-white">
                                    {match.result?.away}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] text-slate-500 uppercase mb-1">
                                    {new Date(match.date).toLocaleDateString(
                                      "pt-BR",
                                      { day: "2-digit", month: "2-digit" },
                                    )}
                                  </span>
                                  <span className="text-sm font-black text-brand-green">
                                    {new Date(match.date).toLocaleTimeString(
                                      "pt-BR",
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 flex flex-col items-end gap-1">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-white">
                                  {match.awayTeam.code}
                                </span>
                                {match.awayTeam.flag && (
                                  <img
                                    src={match.awayTeam.flag}
                                    alt=""
                                    className="w-5 h-5 object-contain"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              },
            )
          ) : (
            <div className="text-center py-12 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-800">
              <div className="inline-flex p-3 bg-slate-800 rounded-full text-slate-600 mb-3">
                <GitMerge size={24} />
              </div>
              <p className="text-slate-500 text-sm font-medium">
                Nenhuma partida eliminatória encontrada para esta competição.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TournamentStandings;
