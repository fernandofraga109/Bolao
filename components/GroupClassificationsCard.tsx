import React, { useState, useMemo, useEffect } from "react";
import { Match, Team, TournamentPredictions } from "../types";
import { Check, Lock, Star, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useDatabase } from "../contexts/DatabaseContext";

interface GroupClassificationsCardProps {
  matches: Match[];
  prediction: TournamentPredictions | undefined;
  lockDate: Date;
  onPredict: (data: TournamentPredictions) => void;
  allowedChampionTeamIds?: string[];
  currentUserId?: string;
  currentGroupId?: string;
}

export const GroupClassificationsCard: React.FC<GroupClassificationsCardProps> = ({
  matches,
  prediction,
  lockDate,
  onPredict,
  currentUserId,
  currentGroupId,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const db = useDatabase();

  useEffect(() => {
    const checkLock = () => {
      const now = new Date();
      setIsLocked(now >= lockDate);
    };
    checkLock();
    const timer = setInterval(checkLock, 60000);
    return () => clearInterval(timer);
  }, [lockDate]);

  const normalizeGroupName = (groupName: string) => {
    const m = /^(?:Group|GROUP)[_\s]+([A-Z])$/i.exec(groupName.trim());
    if (!m) return groupName;
    return `Grupo ${m[1]}`;
  };

  // 1. Resolve teams for all groups dynamically, matching exactly the database standings used in "Tabela da Competição"!
  const groupTeams = useMemo(() => {
    const mapping: Record<string, Team[]> = {};
    const KNOCKOUT_STAGE_PATTERNS = /^(LAST_16|LAST_32|ROUND_OF_16|ROUND_OF_32|QUARTER_FINAL|SEMI_FINAL|FINAL|THIRD_PLACE|PLAY_OFF)/i;

    // A. First populate teams by db.teamStandings (real synced database source)
    db.teams.forEach((t) => {
      const standing = db.teamStandings.find(
        (ts) =>
          ts.teamId === t.id &&
          (ts.competitionCode || "WC").toUpperCase() === "WC"
      );

      if (!standing) return;

      const groupName = standing.group
        ? normalizeGroupName(standing.group)
        : "Tabela";

      // Filter out knockout stages
      if (KNOCKOUT_STAGE_PATTERNS.test(groupName.replace(/\s+/g, "_"))) {
        return;
      }

      // Only include real World Cup groups (Grupo A..L), excluding stray
      // standings from other competitions (e.g. "Atlantic Division").
      if (!groupName.startsWith("Grupo")) {
        return;
      }

      if (!mapping[groupName]) {
        mapping[groupName] = [];
      }
      if (!mapping[groupName].some((team) => team.id === t.id)) {
        mapping[groupName].push(t);
      }
    });

    // B. Always merge teams derived from the group's matches. The standings
    // table can be incomplete (e.g. a team missing from the synced standings),
    // but a team that actually plays in a group must still be selectable.
    matches.forEach((match) => {
      if (match.group) {
        const groupName = normalizeGroupName(match.group);
        if (KNOCKOUT_STAGE_PATTERNS.test(groupName.replace(/\s+/g, "_"))) {
          return;
        }

        // Only include real World Cup groups (Grupo A..L)
        if (!groupName.startsWith("Grupo")) {
          return;
        }

        if (!mapping[groupName]) {
          mapping[groupName] = [];
        }
        const list = mapping[groupName];
        if (match.homeTeam && !list.some((t) => t.id === match.homeTeam.id)) {
          list.push(match.homeTeam);
        }
        if (match.awayTeam && !list.some((t) => t.id === match.awayTeam.id)) {
          list.push(match.awayTeam);
        }
      }
    });

    // C. Sort teams inside each group by their standings position (or alphabetically as fallback)
    Object.keys(mapping).forEach((groupName) => {
      mapping[groupName].sort((a, b) => {
        const standA = db.teamStandings.find((ts) => ts.teamId === a.id && (ts.competitionCode || "WC").toUpperCase() === "WC");
        const standB = db.teamStandings.find((ts) => ts.teamId === b.id && (ts.competitionCode || "WC").toUpperCase() === "WC");
        const posA = standA?.position ?? 999;
        const posB = standB?.position ?? 999;
        if (posA !== posB) return posA - posB;
        return a.name.localeCompare(b.name);
      });
    });

    // D. Sort groups alphabetically (A to L)
    return Object.fromEntries(
      Object.entries(mapping).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [db.teams, db.teamStandings, matches]);

  // Resolve the team to display for a saved pick. The stored teamId may be
  // stale (e.g. a team re-created during a sync got a new id) and therefore
  // not present in the group's current team list. In that case, look the team
  // up globally and try to map it to the equivalent team in this group via
  // externalTeamId/code, so the saved pick still renders.
  const resolveDisplayTeam = (
    teamId: string | undefined,
    groupTeamsList: Team[]
  ): Team | undefined => {
    if (!teamId) return undefined;
    const inGroup = groupTeamsList.find((t) => t.id === teamId);
    if (inGroup) return inGroup;
    const globalTeam = db.teams.find((t) => t.id === teamId);
    if (!globalTeam) return undefined;
    const mapped = groupTeamsList.find(
      (t) =>
        (globalTeam.externalTeamId != null &&
          t.externalTeamId === globalTeam.externalTeamId) ||
        (!!globalTeam.code && t.code === globalTeam.code)
    );
    return mapped || globalTeam;
  };

  // 2. Local state for group classifications predictions
  const [localClassifications, setLocalClassifications] = useState<
    Record<string, { firstPlace?: string; secondPlace?: string }>
  >({});

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Accordion state to collapse/expand the card
  const [isExpanded, setIsExpanded] = useState(false);

  // Centralized active dropdown state to handle all 24 selectors elegantly
  const [activeDropdown, setActiveDropdown] = useState<{
    groupName: string;
    position: "firstPlace" | "secondPlace";
  } | null>(null);

  // Initialize from prediction prop
  useEffect(() => {
    if (prediction?.groupClassifications) {
      const formatted: Record<string, { firstPlace?: string; secondPlace?: string }> = {};
      Object.entries(prediction.groupClassifications).forEach(([groupName, teamIds]) => {
        formatted[groupName] = {
          firstPlace: teamIds?.[0] || undefined,
          secondPlace: teamIds?.[1] || undefined,
        };
      });
      setLocalClassifications(formatted);
    }
  }, [prediction]);

  // Click outside to close custom dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".custom-dropdown-container")) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDropdown = (groupName: string, position: "firstPlace" | "secondPlace") => {
    if (isLocked) return;
    setActiveDropdown((prev) => {
      if (prev?.groupName === groupName && prev?.position === position) {
        return null;
      }
      return { groupName, position };
    });
  };

  const handleSelection = (groupName: string, position: "firstPlace" | "secondPlace", teamId: string) => {
    if (isLocked) return;

    setLocalClassifications((prev) => {
      const current = prev[groupName] || {};
      const updated = { ...current };

      if (position === "firstPlace") {
        updated.firstPlace = teamId;
        // Enforce uniqueness: if same team is in second place, clear it
        if (updated.secondPlace === teamId) {
          updated.secondPlace = undefined;
        }
      } else {
        updated.secondPlace = teamId;
        // Enforce uniqueness: if same team is in first place, clear it
        if (updated.firstPlace === teamId) {
          updated.firstPlace = undefined;
        }
      }

      return {
        ...prev,
        [groupName]: updated,
      };
    });
  };

  const handleSave = () => {
    if (isLocked) return;

    // Convert local state format to api format: Record<string, string[]>
    const groupClassifications: Record<string, string[]> = {};
    Object.entries(localClassifications).forEach(([groupName, data]) => {
      if (data.firstPlace || data.secondPlace) {
        groupClassifications[groupName] = [
          data.firstPlace || "",
          data.secondPlace || "",
        ];
      }
    });

    onPredict({
      ...prediction,
      groupClassifications,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Convert grouped items to list for rendering
  const groupsList = Object.entries(groupTeams);

  // Compute how many groups have predicted qualifiers
  const predictedGroupsCount = useMemo(() => {
    let count = 0;
    groupsList.forEach(([groupName]) => {
      const pred = localClassifications[groupName];
      if (pred && pred.firstPlace && pred.secondPlace) {
        count++;
      }
    });
    return count;
  }, [localClassifications, groupsList]);

  const allGroupsFilled = predictedGroupsCount === groupsList.length;

  if (groupsList.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden">
      {/* Card Header - Clickable to toggle accordion */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gradient-to-r from-indigo-900/80 to-slate-900 px-4 py-3 flex justify-between items-center transition-colors hover:bg-slate-800 rounded-t-xl"
      >
        <div className="flex items-center gap-3 text-white">
          <Star size={20} className="text-indigo-400" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="tracking-wide text-sm font-bold uppercase">Classificados dos Grupos</h3>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                allGroupsFilled
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : predictedGroupsCount > 0
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
              }`}>
                {predictedGroupsCount}/{groupsList.length} Grupos
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal block">
              {isLocked ? 'Encerrado (Início da Copa)' : `Encerra em: ${lockDate.toLocaleDateString('pt-BR')} às ${lockDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && (
            <div className="flex items-center gap-1 text-xs font-bold text-orange-400 bg-orange-950/50 px-2 py-1 rounded border border-orange-500/30">
              <Lock size={12} /> FECHADO
            </div>
          )}
          {!isLocked && allGroupsFilled && (
            <div className="flex items-center gap-1 text-xs font-bold text-brand-green bg-brand-green/10 px-2 py-1 rounded border border-brand-green/30">
              <Check size={12} /> Salvo
            </div>
          )}
          {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </div>
      </button>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-700">
          {/* Grid of Groups */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {groupsList.map(([groupName, teams]) => {
              const predictionForGroup = localClassifications[groupName] || {};
              const firstPlaceTeam = resolveDisplayTeam(predictionForGroup.firstPlace, teams);
              const secondPlaceTeam = resolveDisplayTeam(predictionForGroup.secondPlace, teams);

              return (
                <div
                  key={groupName}
                  className="bg-[#1f2937]/35 border border-[#374151]/40 rounded-2xl p-5 hover:border-indigo-500/30 transition-all duration-200"
                >
                  <h3 className="text-lg font-bold text-white mb-4 border-b border-[#1f2937] pb-2 tracking-wide">
                    {normalizeGroupName(groupName)}
                  </h3>

                  {/* 1st place selector */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      1º Colocado
                    </label>
                    <div className="relative custom-dropdown-container">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => toggleDropdown(groupName, "firstPlace")}
                        className={`w-full bg-[#111827] border ${
                          activeDropdown?.groupName === groupName && activeDropdown?.position === "firstPlace"
                            ? "border-indigo-500 ring-1 ring-indigo-500"
                            : "border-[#374151]"
                        } text-sm text-white rounded-xl py-3.5 pl-4 pr-10 flex items-center justify-between transition-all duration-150 disabled:opacity-60 cursor-pointer text-left`}
                      >
                        {firstPlaceTeam ? (
                          <div className="flex items-center gap-2">
                            {firstPlaceTeam.flag && (
                              <img
                                src={firstPlaceTeam.flag}
                                alt={firstPlaceTeam.name}
                                className="w-5 h-3.5 object-cover rounded shadow-sm shrink-0"
                              />
                            )}
                            <span className="truncate">{firstPlaceTeam.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Líder...</span>
                        )}
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeDropdown?.groupName === groupName && activeDropdown?.position === "firstPlace" && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1f2937] border border-[#374151] rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                          {teams.map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                handleSelection(groupName, "firstPlace", team.id);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-[#374151] flex items-center gap-3 transition-colors border-b border-[#374151]/55 last:border-0"
                            >
                              {team.flag && (
                                <img
                                  src={team.flag}
                                  alt={team.name}
                                  className="w-6 h-4 object-cover rounded shadow-sm shrink-0"
                                />
                              )}
                              <span className="truncate">{team.name}</span>
                              {predictionForGroup.firstPlace === team.id && (
                                <Check className="ml-auto w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2nd place selector */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      2º Colocado
                    </label>
                    <div className="relative custom-dropdown-container">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => toggleDropdown(groupName, "secondPlace")}
                        className={`w-full bg-[#111827] border ${
                          activeDropdown?.groupName === groupName && activeDropdown?.position === "secondPlace"
                        ? "border-indigo-500 ring-1 ring-indigo-500"
                        : "border-[#374151]"
                        } text-sm text-white rounded-xl py-3.5 pl-4 pr-10 flex items-center justify-between transition-all duration-150 disabled:opacity-60 cursor-pointer text-left`}
                      >
                        {secondPlaceTeam ? (
                          <div className="flex items-center gap-2">
                            {secondPlaceTeam.flag && (
                              <img
                                src={secondPlaceTeam.flag}
                                alt={secondPlaceTeam.name}
                                className="w-5 h-3.5 object-cover rounded shadow-sm shrink-0"
                              />
                            )}
                            <span className="truncate">{secondPlaceTeam.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Vice...</span>
                        )}
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                      </button>

                      {/* Dropdown Menu */}
                      {activeDropdown?.groupName === groupName && activeDropdown?.position === "secondPlace" && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1f2937] border border-[#374151] rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                          {teams.map((team) => (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                handleSelection(groupName, "secondPlace", team.id);
                                setActiveDropdown(null);
                              }}
                              className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-[#374151] flex items-center gap-3 transition-colors border-b border-[#374151]/55 last:border-0"
                            >
                              {team.flag && (
                                <img
                                  src={team.flag}
                                  alt={team.name}
                                  className="w-6 h-4 object-cover rounded shadow-sm shrink-0"
                                />
                              )}
                              <span className="truncate">{team.name}</span>
                              {predictionForGroup.secondPlace === team.id && (
                                <Check className="ml-auto w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Button Action */}
          {!isLocked && (
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:from-indigo-500 hover:to-purple-500 active:scale-95 transition-all duration-150 flex items-center gap-2 tracking-wide"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-5 h-5 text-green-300" />
                    <span>Palpites Salvos com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <span>Salvar Palpites de Classificados</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Other Users' Group Classifications - Always visible, data hidden until lock */}
          {currentGroupId && (() => {
            const allPreds = db.tournamentPredictions.filter(
              (tp) => tp.groupId === currentGroupId && tp.groupClassifications
            );

            // Sort: current user first, then others alphabetically
            const sortedPreds = [...allPreds].sort((a, b) => {
              if (a.userId === currentUserId) return -1;
              if (b.userId === currentUserId) return 1;
              const nameA = db.users.find((u) => u.id === a.userId)?.name || "";
              const nameB = db.users.find((u) => u.id === b.userId)?.name || "";
              return nameA.localeCompare(nameB);
            });

            return (
              <OtherGroupClassifications
                otherPreds={sortedPreds}
                db={db}
                groupTeams={groupTeams}
                normalizeGroupName={normalizeGroupName}
                isLocked={isLocked}
                currentUserId={currentUserId}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Sub-component: Other users' group classifications accordion
const OtherGroupClassifications: React.FC<{
  otherPreds: any[];
  db: ReturnType<typeof useDatabase>;
  groupTeams: Record<string, Team[]>;
  normalizeGroupName: (g: string) => string;
  isLocked: boolean;
  currentUserId?: string;
}> = ({ otherPreds, db, groupTeams, normalizeGroupName, isLocked, currentUserId }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getUserName = (userId: string) => {
    const user = db.users.find((u) => u.id === userId);
    return user?.name || "Anônimo";
  };

  const getTeamCode = (teamId: string) => {
    const team = db.teams.find((t) => t.id === teamId);
    return team?.code || "?";
  };

  const groupNames = Object.keys(groupTeams).sort();

  return (
    <div className="mt-4 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <Users size={14} />
          <span className="text-xs font-bold uppercase tracking-wide">
            Palpites do Grupo ({otherPreds.length})
          </span>
        </div>
        {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {isOpen && (
        otherPreds.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center">
            Nenhum participante fez palpites neste grupo ainda.
          </div>
        ) : (
        <div className="overflow-x-auto animate-fadeIn">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/40 text-slate-400 border-t border-slate-700">
                <th className="px-3 py-2 text-left font-medium">Participante</th>
                {groupNames.map((g) => (
                  <th key={g} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                    {normalizeGroupName(g)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {otherPreds.map((tp) => {
                const isCurrentUser = tp.userId === currentUserId;
                return (
                  <tr key={tp.userId} className={`hover:bg-slate-800/50 transition-colors ${isCurrentUser ? 'bg-indigo-950/20' : ''}`}>
                    <td className="px-3 py-2 font-semibold text-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getUserName(tp.userId)}
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-600 text-white rounded-full">
                            VOCÊ
                          </span>
                        )}
                      </div>
                    </td>
                    {groupNames.map((g) => {
                      const picks = tp.groupClassifications?.[g] || [];
                      return (
                        <td key={g} className="px-2 py-2 text-center text-slate-300">
                          <div className="flex flex-wrap gap-0.5 justify-center">
                            {picks.length > 0
                              ? isLocked || isCurrentUser
                                ? picks.map((id: string) => (
                                    <span key={id} className="text-[9px] bg-slate-800 px-1 py-0.5 rounded">
                                      {getTeamCode(id)}
                                    </span>
                                  ))
                                : <span className="text-[9px] text-slate-500 italic">Oculto</span>
                              : "—"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )
      )}
    </div>
  );
};
