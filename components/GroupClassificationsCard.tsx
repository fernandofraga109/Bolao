import React, { useState, useMemo, useEffect } from "react";
import { Match, Team, TournamentPredictions } from "../types";
import { Check, Lock, Star, ChevronDown, ChevronUp } from "lucide-react";
import { useDatabase } from "../contexts/DatabaseContext";

interface GroupClassificationsCardProps {
  matches: Match[];
  prediction: TournamentPredictions | undefined;
  lockDate: Date;
  onPredict: (data: TournamentPredictions) => void;
  allowedChampionTeamIds?: string[];
}

export const GroupClassificationsCard: React.FC<GroupClassificationsCardProps> = ({
  matches,
  prediction,
  lockDate,
  onPredict,
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

      if (!mapping[groupName]) {
        mapping[groupName] = [];
      }
      if (!mapping[groupName].some((team) => team.id === t.id)) {
        mapping[groupName].push(t);
      }
    });

    // B. If database standings table is empty or incomplete, fall back to matches grouping
    if (Object.keys(mapping).length === 0) {
      matches.forEach((match) => {
        if (match.group) {
          const groupName = normalizeGroupName(match.group);
          if (KNOCKOUT_STAGE_PATTERNS.test(groupName.replace(/\s+/g, "_"))) {
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
    }

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
    <div className="w-full bg-[#111827] border border-[#1f2937] rounded-3xl shadow-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-[#374151]">
      {/* Decorative Gradient Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full blur-3xl opacity-20 pointer-events-none"></div>

      {/* Card Header - Clickable to toggle accordion */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none group"
      >
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-2xl group-hover:from-indigo-500/30 group-hover:to-purple-500/30 transition-all duration-200">
            <Star className="w-7 h-7 text-indigo-400 group-hover:scale-110 transition-transform duration-200" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-wide group-hover:text-indigo-300 transition-colors duration-200">
                Classificados dos Grupos
              </h2>
              <span className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                allGroupsFilled
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : predictedGroupsCount > 0
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                  : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
              }`}>
                {predictedGroupsCount} / {groupsList.length} Grupos
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {isLocked ? 'Encerrado (Início da Copa)' : `Encerra em: ${lockDate.toLocaleDateString('pt-BR')} às ${lockDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isLocked && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-950/30 border border-red-900/40 rounded-xl text-red-400 text-sm font-semibold">
              <Lock className="w-4 h-4" />
              FECHADO
            </div>
          )}
          {!isLocked && allGroupsFilled && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-950/30 border border-emerald-900/40 rounded-xl text-emerald-400 text-sm font-semibold">
              <Check className="w-4 h-4" />
              Salvo
            </div>
          )}
          <button
            type="button"
            className="p-3 bg-[#1f2937] border border-[#374151] rounded-2xl group-hover:border-indigo-500/50 group-hover:bg-slate-800 transition-all text-white flex items-center justify-center cursor-pointer active:scale-95"
            onClick={(e) => {
              e.stopPropagation(); // Prevent duplicate trigger from parent click
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-indigo-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-indigo-400" />
            )}
          </button>
        </div>
      </div>

      {/* Accordion Content */}
      {isExpanded && (
        <div className="pt-6 border-t border-[#1f2937]">
          {/* Grid of Groups */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {groupsList.map(([groupName, teams]) => {
              const predictionForGroup = localClassifications[groupName] || {};
              const firstPlaceTeam = teams.find((t) => t.id === predictionForGroup.firstPlace);
              const secondPlaceTeam = teams.find((t) => t.id === predictionForGroup.secondPlace);

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
        </div>
      )}
    </div>
  );
};
