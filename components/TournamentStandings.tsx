import React, { useState, useMemo } from 'react';
import { Match, MatchStatus, Team } from '../types';
import { Table2, GitMerge } from 'lucide-react';

interface TournamentStandingsProps {
  matches: Match[];
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

const TournamentStandings: React.FC<TournamentStandingsProps> = ({ matches }) => {
  const [view, setView] = useState<'groups' | 'knockout'>('groups');

  // --- Calculate Group Standings ---
  const standings = useMemo<Record<string, TeamStats[]>>(() => {
    const groups: Record<string, Record<string, TeamStats>> = {};

    // Initialize stats map based on matches to find all teams and groups
    matches.forEach(match => {
      if (!groups[match.group]) {
        groups[match.group] = {};
      }

      // Initialize Home Team
      if (!groups[match.group][match.homeTeam.id]) {
        groups[match.group][match.homeTeam.id] = {
          team: match.homeTeam,
          played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0
        };
      }
      // Initialize Away Team
      if (!groups[match.group][match.awayTeam.id]) {
        groups[match.group][match.awayTeam.id] = {
          team: match.awayTeam,
          played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0
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
    Object.keys(groups).sort().forEach(groupName => {
      sortedGroups[groupName] = Object.values(groups[groupName]).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
    });

    return sortedGroups;
  }, [matches]);

  return (
    <div className="w-full max-w-2xl mx-auto pb-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl mb-6 shadow-lg text-center text-white">
        <h2 className="text-2xl font-bold mb-1">Tabela da Copa</h2>
        <p className="opacity-90 text-sm">Acompanhe os grupos e o mata-mata</p>
      </div>

      {/* Toggle View */}
      <div className="flex bg-slate-800 p-1 rounded-xl mb-6 border border-slate-700">
        <button
          onClick={() => setView('groups')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
            view === 'groups' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Table2 size={16} />
          Fase de Grupos
        </button>
        <button
          onClick={() => setView('knockout')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${
            view === 'knockout' ? 'bg-slate-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <GitMerge size={16} />
          Mata-Mata
        </button>
      </div>

      {/* Groups View */}
      {view === 'groups' && (
        <div className="space-y-6">
          {Object.keys(standings).length === 0 ? (
             <div className="text-center text-slate-500 py-10">
                <p>Nenhum jogo cadastrado ainda.</p>
             </div>
          ) : (
            (Object.entries(standings) as [string, TeamStats[]][]).map(([groupName, teams]) => (
              <div key={groupName} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-sm">
                <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold text-white">{groupName}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-900/30 text-slate-400 text-[10px] uppercase tracking-wider">
                        <th className="px-3 py-2 text-left font-medium">Seleção</th>
                        <th className="px-2 py-2 text-center font-medium w-8">P</th>
                        <th className="px-2 py-2 text-center font-medium w-8">J</th>
                        <th className="px-2 py-2 text-center font-medium w-8">V</th>
                        <th className="px-2 py-2 text-center font-medium w-8">SG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {teams.map((stats, index) => (
                        <tr key={stats.team.id} className={`${index < 2 ? 'bg-brand-green/5' : ''}`}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-mono w-4 ${index < 2 ? 'text-brand-green font-bold' : 'text-slate-500'}`}>
                                {index + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <img src={stats.team.flag} alt={stats.team.code} className="w-5 h-3.5 object-cover rounded shadow-sm" />
                                <span className={`font-semibold ${index < 2 ? 'text-white' : 'text-slate-300'}`}>
                                  {stats.team.code}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-white">{stats.points}</td>
                          <td className="px-2 py-2 text-center text-slate-400">{stats.played}</td>
                          <td className="px-2 py-2 text-center text-slate-400">{stats.won}</td>
                          <td className="px-2 py-2 text-center text-slate-400">{stats.gd > 0 ? `+${stats.gd}` : stats.gd}</td>
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

      {/* Knockout View - Simplified Visualizer */}
      {view === 'knockout' && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
            <h3 className="text-white font-bold mb-4 flex items-center justify-center gap-2">
                <GitMerge size={20} className="text-brand-green" />
                Caminho para a Glória
            </h3>
            
            <div className="flex flex-col gap-6 relative">
                 {/* Example Round of 16 */}
                 <div className="space-y-2">
                     <p className="text-xs uppercase text-slate-500 font-bold mb-2">Oitavas de Final</p>
                     <BracketPair t1="1º Grupo A" t2="2º Grupo B" />
                     <BracketPair t1="1º Grupo C" t2="2º Grupo D" />
                 </div>

                 <div className="flex justify-center text-slate-600">
                    <div className="h-6 w-0.5 bg-slate-700"></div>
                 </div>

                 {/* Quarters */}
                 <div className="space-y-2">
                     <p className="text-xs uppercase text-slate-500 font-bold mb-2">Quartas de Final</p>
                     <BracketPair t1="Vencedor J1" t2="Vencedor J2" />
                 </div>

                 <div className="flex justify-center text-slate-600">
                    <div className="h-6 w-0.5 bg-slate-700"></div>
                 </div>

                 {/* Semis */}
                  <div className="space-y-2">
                     <p className="text-xs uppercase text-slate-500 font-bold mb-2">Semifinal</p>
                     <BracketPair t1="Vencedor QF1" t2="Vencedor QF2" />
                 </div>
                 
                 <div className="mt-4 p-4 bg-gradient-to-t from-slate-900 to-slate-800 rounded-lg border border-yellow-500/20">
                     <p className="text-yellow-500 font-bold text-lg mb-1">Grande Final</p>
                     <div className="text-slate-400 text-sm">19 de Julho de 2026</div>
                     <div className="text-slate-500 text-xs mt-1">New York / New Jersey Stadium</div>
                 </div>
            </div>

            <p className="text-xs text-slate-500 mt-6 italic">
                O chaveamento será atualizado automaticamente conforme os resultados da fase de grupos forem confirmados.
            </p>
        </div>
      )}
    </div>
  );
};

const BracketPair: React.FC<{t1: string, t2: string}> = ({ t1, t2 }) => (
    <div className="flex flex-col bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden w-full max-w-xs mx-auto">
        <div className="px-3 py-2 border-b border-slate-700/50 flex justify-between items-center bg-slate-700/20">
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