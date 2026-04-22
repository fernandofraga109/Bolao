import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Match, MatchStatus, Team, TeamDB } from "../types";
import { Table2, GitMerge, RefreshCw } from "lucide-react";
import { useDatabase } from "../contexts/DatabaseContext";
import {
  ExternalStandingGroup,
  fetchExternalStandings,
} from "../services/liveScoreService";

interface TournamentStandingsProps {
  matches: Match[];
  competitionCode?: string;
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
      current.points * 1000 + current.gd * 100 + current.gf * 10 + current.played;
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

  const STANDINGS_SEASON = "2026";
  const STANDINGS_CACHE_TTL_MS = 15 * 60 * 1000;
  const normalizeCompetition = (value?: string) =>
    (value || "WC").toUpperCase();

  const normalizeGroupName = (groupName: string) => {
    const m = /^Group\s+([A-Z])$/i.exec(groupName.trim());
    if (!m) return groupName;
    return `Grupo ${m[1]}`;
  };

  const buildStandingsFromExternal = useCallback(
    (groupsData: ExternalStandingGroup[]) => {
      const mapped: Record<string, TeamStats[]> = {};

      groupsData.forEach((groupEntry) => {
        const groupName = normalizeGroupName(groupEntry.group || "Grupo");
        const rows = Array.isArray(groupEntry.table) ? groupEntry.table : [];

        const mappedRows = rows.map((row) => {
          const code = (row.team?.tla || "").toUpperCase();
          const existing = db.teams.find(
            (t) =>
              t.code.toUpperCase() === code || t.externalTeamId === row.team.id,
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
    [db.teams],
  );

  const cachedStandings = useMemo<Record<string, TeamStats[]> | null>(() => {
    const now = Date.now();
    const grouped: Record<string, TeamStats[]> = {};

    db.teams.forEach((team) => {
      if (!team.standingsGroup) return;
      if (
        normalizeCompetition(team.standingsCompetitionCode) !==
        normalizeCompetition(competitionCode)
      ) {
        return;
      }
      if (team.standingsSeason && team.standingsSeason !== STANDINGS_SEASON)
        return;

      if (team.standingsUpdatedAt) {
        const ageMs = now - new Date(team.standingsUpdatedAt).getTime();
        if (!Number.isFinite(ageMs) || ageMs > STANDINGS_CACHE_TTL_MS) return;
      } else {
        return;
      }

      const groupName = normalizeGroupName(team.standingsGroup);
      if (!grouped[groupName]) grouped[groupName] = [];

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
  }, [db.teams]);

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

        // Persisting standings cache is best-effort only; UI should keep working even with strict RLS.
        try {
          for (const groupEntry of groupsData) {
            for (const row of groupEntry.table) {
              const code = (row.team?.tla || "").toUpperCase();
              if (!code) continue;

              const existing = db.teams.find(
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
                standingsCompetitionCode: normalizeCompetition(competitionCode),
                standingsSeason: STANDINGS_SEASON,
                standingsStage: groupEntry.stage,
                standingsType: groupEntry.type,
                standingsGroup: normalizeGroupName(groupEntry.group),
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

              await db.upsertTeam(payload);
            }
          }
        } catch (cacheError) {
          console.warn(
            "Standings carregados, mas sem permissão para salvar cache em teams:",
            cacheError,
          );
        }
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
    [buildStandingsFromExternal, cachedStandings, competitionCode, db],
  );

  useEffect(() => {
    setApiStandings(null);
    setStandingsSource("local");
    setStandingsError(null);
    void loadGroupStandings(true);
  }, [competitionCode]);

  const resolvedStandings =
    apiStandings && Object.keys(apiStandings).length > 0
      ? apiStandings
      : standings;

  return (
    <div className="w-full max-w-2xl mx-auto pb-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl mb-6 shadow-lg text-center text-white">
        <h2 className="text-2xl font-bold mb-1">Tabela da Competição</h2>
        <p className="opacity-90 text-sm">Acompanhe os grupos e o mata-mata</p>
      </div>

      {/* Toggle View */}
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

      {/* Groups View */}
      {view === "groups" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">
              Fonte:{" "}
              {standingsSource === "api"
                ? "API oficial"
                : standingsSource === "cache"
                  ? "cache teams"
                  : "cálculo local"}
            </span>
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

          {standingsError && (
            <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2">
              {standingsError}
            </div>
          )}

          {Object.keys(resolvedStandings).length === 0 ? (
            <div className="text-center text-slate-500 py-10">
              <p>Nenhum jogo cadastrado ainda.</p>
            </div>
          ) : (
            (Object.entries(resolvedStandings) as [string, TeamStats[]][]).map(
              ([groupName, teams]) => (
                <div
                  key={groupName}
                  className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-sm"
                >
                  <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white">{groupName}</h3>
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
                                  <img
                                    src={stats.team.flag}
                                    alt={stats.team.code}
                                    className="w-5 h-3.5 object-cover rounded shadow-sm"
                                  />
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
              ),
            )
          )}
        </div>
      )}

      {/* Knockout View - Updated for 2026 Format */}
      {view === "knockout" && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <h3 className="text-white font-bold mb-4 flex items-center justify-center gap-2">
            <GitMerge size={20} className="text-brand-green" />
            Caminho para a Glória
          </h3>

          <div className="flex flex-col gap-5 relative">
            {/* NOVIDADE: 16-avos de Final */}
            <div className="space-y-2 relative">
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold text-brand-green tracking-widest whitespace-nowrap hidden sm:block opacity-50">
                NOVIDADE 2026
              </div>
              <p className="text-xs uppercase text-brand-green font-bold mb-2 tracking-wide">
                16-avos de Final (32 Times)
              </p>
              <BracketPair t1="1º Grupo A" t2="3º Grupo C/D/E" />
              <BracketPair t1="2º Grupo B" t2="2º Grupo F" />
              <div className="text-[10px] text-slate-500 py-1.5 bg-slate-900/30 rounded border border-slate-700/50 mx-auto max-w-xs italic">
                + 14 jogos eliminatórios
              </div>
            </div>

            <div className="flex justify-center text-slate-600">
              <div className="h-4 w-0.5 bg-slate-700"></div>
            </div>

            {/* Oitavas */}
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-500 font-bold mb-2">
                Oitavas de Final
              </p>
              <BracketPair t1="Vencedor Jogo 1" t2="Vencedor Jogo 2" />
            </div>

            <div className="flex justify-center text-slate-600">
              <div className="h-4 w-0.5 bg-slate-700"></div>
            </div>

            {/* Quartas */}
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-500 font-bold mb-2">
                Quartas de Final
              </p>
              <BracketPair t1="Vencedor Oitavas 1" t2="Vencedor Oitavas 2" />
            </div>

            <div className="flex justify-center text-slate-600">
              <div className="h-4 w-0.5 bg-slate-700"></div>
            </div>

            {/* Semis */}
            <div className="space-y-2">
              <p className="text-xs uppercase text-slate-500 font-bold mb-2">
                Semifinal
              </p>
              <BracketPair t1="Vencedor QF1" t2="Vencedor QF2" />
            </div>

            <div className="mt-4 p-4 bg-gradient-to-t from-slate-900 to-slate-800 rounded-lg border border-yellow-500/20 shadow-lg shadow-black/40">
              <p className="text-yellow-500 font-bold text-lg mb-1 flex items-center justify-center gap-2">
                <span className="text-2xl">🏆</span> Grande Final
              </p>
              <div className="text-slate-300 font-bold text-sm">
                19 de Julho de 2026
              </div>
              <div className="text-slate-500 text-xs mt-1">
                New York / New Jersey Stadium
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-6 italic px-4">
            O chaveamento será atualizado automaticamente. Os 8 melhores 3º
            colocados se juntam aos 1º e 2º de cada grupo nos 16-avos.
          </p>
        </div>
      )}
    </div>
  );
};

const BracketPair: React.FC<{ t1: string; t2: string }> = ({ t1, t2 }) => (
  <div className="flex flex-col bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden w-full max-w-xs mx-auto shadow-sm">
    <div className="px-3 py-2 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
      <span className="text-sm font-medium text-slate-300">{t1}</span>
      <span className="text-xs text-slate-500">-</span>
    </div>
    <div className="px-3 py-2 flex justify-between items-center">
      <span className="text-sm font-medium text-slate-300">{t2}</span>
      <span className="text-xs text-slate-500">-</span>
    </div>
  </div>
);

export default TournamentStandings;
