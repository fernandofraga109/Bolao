import React, { useState, useMemo, useEffect } from "react";
import { Match, Team, TournamentPredictions } from "../types";
import { Check, Lock, Star, ChevronDown, ChevronUp, Search, Trophy, Sparkles, AlertCircle } from "lucide-react";
import { useDatabase } from "../contexts/DatabaseContext";

interface KnockoutClassificationsCardProps {
  matches: Match[];
  prediction: TournamentPredictions | undefined;
  lockDate: Date;
  onPredict: (data: TournamentPredictions) => void;
}

export const KnockoutClassificationsCard: React.FC<KnockoutClassificationsCardProps> = ({
  matches,
  prediction,
  lockDate,
  onPredict,
}) => {
  const db = useDatabase();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePhase, setActivePhase] = useState<"16-avos" | "Oitavas" | "Quartas" | "Semis" | null>("16-avos");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [, forceUpdate] = useState({});

  // Group matches by phase to determine lock times and finished states
  const phaseMatches = useMemo(() => {
    const dezesseisAvos: Match[] = [];
    const oitavas: Match[] = [];
    const quartas: Match[] = [];
    const semis: Match[] = [];

    matches.forEach((m) => {
      const stage = (m.stage || "").toUpperCase();
      const groupStr = (m.group || "").toUpperCase();

      if (stage.includes("ROUND_OF_32") || stage.includes("LAST_32") || groupStr.includes("16-AVOS")) {
        dezesseisAvos.push(m);
      } else if (stage.includes("ROUND_OF_16") || stage.includes("LAST_16") || groupStr.includes("OITAVAS")) {
        oitavas.push(m);
      } else if (stage.includes("QUARTER") || groupStr.includes("QUARTAS")) {
        quartas.push(m);
      } else if (stage.includes("SEMI") || groupStr.includes("SEMI")) {
        semis.push(m);
      }
    });

    return { "16-avos": dezesseisAvos, Oitavas: oitavas, Quartas: quartas, Semis: semis };
  }, [matches]);

  // Determine lock state per phase
  const isPhaseLocked = (phase: "16-avos" | "Oitavas" | "Quartas" | "Semis") => {
    const now = new Date();
    // Global tournament lock
    if (now >= new Date(lockDate)) return true;

    // Phase-specific lock: when the first match of that phase starts
    const mList = phaseMatches[phase];
    if (mList.length > 0) {
      // Sort by date to get the first match of the phase
      const sortedMatches = [...mList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstMatchDate = new Date(sortedMatches[0].date);
      return now >= firstMatchDate;
    }
    return false;
  };

  // Local state for selections
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string[]>>({
    "16-avos": [],
    Oitavas: [],
    Quartas: [],
    Semis: [],
  });

  // Sync saved database predictions into local state
  useEffect(() => {
    if (prediction?.groupClassifications) {
      setSelectedTeams({
        "16-avos": prediction.groupClassifications["16-avos"] || [],
        Oitavas: prediction.groupClassifications["Oitavas"] || [],
        Quartas: prediction.groupClassifications["Quartas"] || [],
        Semis: prediction.groupClassifications["Semis"] || [],
      });
    }
  }, [prediction]);

  // Force re-render every 60 seconds to update lock states
  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate({});
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Filtered teams list based on search query
  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    // Extract participating team IDs from the active competition matches to filter out club teams (times) from other leagues
    const activeTeamIds = new Set<string>();
    matches.forEach((m) => {
      if (m.homeTeam?.id) activeTeamIds.add(m.homeTeam.id);
      if (m.awayTeam?.id) activeTeamIds.add(m.awayTeam.id);
    });

    // Fallback: if matches list is empty, fall back to team standings
    if (activeTeamIds.size === 0) {
      db.teamStandings.forEach((ts) => {
        if (ts.teamId) activeTeamIds.add(ts.teamId);
      });
    }

    const allActiveTeams = db.teams.filter((t) => activeTeamIds.has(t.id));
    const sortedTeams = [...allActiveTeams].sort((a, b) => a.name.localeCompare(b.name));

    if (!query) return sortedTeams;
    return sortedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.code.toLowerCase().includes(query)
    );
  }, [db.teams, db.teamStandings, matches, searchQuery]);

  // Toggle selection for active phase
  const handleToggleTeam = (teamId: string) => {
    if (!activePhase || isPhaseLocked(activePhase)) return;

    const currentSelection = selectedTeams[activePhase];
    const maxAllowed = activePhase === "16-avos" ? 32 : activePhase === "Oitavas" ? 16 : activePhase === "Quartas" ? 8 : 4;

    if (currentSelection.includes(teamId)) {
      setSelectedTeams((prev) => ({
        ...prev,
        [activePhase]: prev[activePhase].filter((id) => id !== teamId),
      }));
    } else {
      if (currentSelection.length >= maxAllowed) return; // Limit reached
      setSelectedTeams((prev) => ({
        ...prev,
        [activePhase]: [...prev[activePhase], teamId],
      }));
    }
  };

  const handleSave = async (phase: "Oitavas" | "Quartas" | "Semis") => {
    if (isPhaseLocked(phase)) return;

    const updatedClassifications = {
      ...(prediction?.groupClassifications || {}),
      [phase]: selectedTeams[phase],
    };

    onPredict({
      ...(prediction || {}),
      groupClassifications: updatedClassifications,
    });

    setSaveSuccess(phase);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  // Get point results if finished
  const getPhaseResults = (phase: "16-avos" | "Oitavas" | "Quartas" | "Semis") => {
    const actualList = db.tournamentPredictions.find(
      (tp) => tp.userId === "actual" || tp.groupId === "actual"
    )?.groupClassifications?.[phase] || [];

    const userPreds = selectedTeams[phase];
    let correctCount = 0;

    userPreds.forEach((teamId) => {
      if (actualList.includes(teamId)) {
        correctCount++;
      }
    });

    const isFinished = phaseMatches[phase].length > 0 && phaseMatches[phase].every(m => m.status === "FINISHED");

    return {
      actualList,
      correctCount,
      totalEarnedPoints: correctCount * 5,
      isFinished,
    };
  };

  const phaseConfig = {
    "16-avos": { max: 32, label: "16-avos de Final" },
    Oitavas: { max: 16, label: "Oitavas de Final" },
    Quartas: { max: 8, label: "Quartas de Final" },
    Semis: { max: 4, label: "Semifinais" },
  };

  return (
    <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl border border-slate-750 mb-8 transition-all duration-300">
      {/* Header / Accordion Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-750/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-500/10">
            <Trophy size={20} className="text-white animate-pulse" />
          </div>
          <div>
            <h3 className="font-black text-slate-100 text-sm md:text-base tracking-tight uppercase">
              Classificados 2º Fase
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Bloqueio progressivo por fase (cada fase bloqueia quando começa)
            </p>
          </div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700/50">
          {isExpanded ? (
            <ChevronUp size={16} className="text-slate-300" />
          ) : (
            <ChevronDown size={16} className="text-slate-300" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 pt-2 border-t border-slate-750 space-y-6">
          {/* Phase Selector Tabs */}
          <div className="flex bg-slate-900/40 p-1 rounded-2xl border border-slate-800">
            {(["16-avos", "Oitavas", "Quartas", "Semis"] as const).map((phase) => {
              const config = phaseConfig[phase];
              const isLocked = isPhaseLocked(phase);
              const count = selectedTeams[phase].length;
              const isActive = activePhase === phase;
              const results = getPhaseResults(phase);

              return (
                <button
                  key={phase}
                  onClick={() => setActivePhase(phase)}
                  className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                    isActive
                      ? "bg-slate-800 text-brand-green shadow border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="truncate">{config.label}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] bg-slate-950/60 text-slate-400 px-1.5 py-0.5 rounded font-black border border-slate-800">
                      {count}/{config.max}
                    </span>
                    {results.isFinished && results.totalEarnedPoints > 0 && (
                      <span className="text-[10px] bg-brand-green/20 text-brand-green border border-brand-green/30 px-1 py-0.5 rounded font-black">
                        +{results.totalEarnedPoints} PTS
                      </span>
                    )}
                    {isLocked && !results.isFinished && (
                      <Lock size={10} className="text-slate-500 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {activePhase && (
            <div className="space-y-4 animate-fadeIn">
              {/* Info & Lock Box */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/40 border border-slate-750 rounded-2xl p-4 gap-4">
                <div className="flex items-start gap-3">
                  {isPhaseLocked(activePhase) ? (
                    <div className="bg-orange-500/10 p-2 rounded-xl border border-orange-500/20 text-orange-400 shrink-0 mt-0.5">
                      <Lock size={16} />
                    </div>
                  ) : (
                    <div className="bg-brand-green/10 p-2 rounded-xl border border-brand-green/20 text-brand-green shrink-0 mt-0.5">
                      <Sparkles size={16} className="animate-spin-slow" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      Palpites para {phaseConfig[activePhase].label}
                      {isPhaseLocked(activePhase) && (
                        <span className="text-[9px] uppercase tracking-widest bg-orange-950/40 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded">
                          Bloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {isPhaseLocked(activePhase)
                        ? "O prazo para enviar ou alterar os palpites desta fase encerrou."
                        : `Selecione exatamente ${phaseConfig[activePhase].max} seleções que avançam para esta fase.`}
                    </p>
                  </div>
                </div>

                {!isPhaseLocked(activePhase) && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {selectedTeams[activePhase].length > 0 && (
                      <button
                        onClick={() => setSelectedTeams(prev => ({ ...prev, [activePhase]: [] }))}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-705 text-red-400 hover:text-red-300 border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        Limpar Escolhas
                      </button>
                    )}
                    <button
                      onClick={() => handleSave(activePhase)}
                      disabled={
                        (selectedTeams[activePhase].length !== 0 &&
                          selectedTeams[activePhase].length !== phaseConfig[activePhase].max) ||
                        saveSuccess === activePhase
                      }
                      className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all text-white shadow-lg ${
                        saveSuccess === activePhase
                          ? "bg-brand-green text-slate-900"
                          : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      }`}
                    >
                      {saveSuccess === activePhase ? (
                        <>
                          <Check size={14} className="stroke-[3px]" /> Palpite Salvo!
                        </>
                      ) : selectedTeams[activePhase].length === 0 ? (
                        <>
                          Limpar e Salvar
                        </>
                      ) : (
                        <>
                          Salvar Palpite ({selectedTeams[activePhase].length}/{phaseConfig[activePhase].max})
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Selection Counter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Pesquisar seleção pelo nome ou sigla..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-750 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 transition-all"
                  />
                </div>
              </div>

              {/* Grid of Teams */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredTeams.map((team) => {
                  const isSelected = selectedTeams[activePhase].includes(team.id);
                  const maxReached = selectedTeams[activePhase].length >= phaseConfig[activePhase].max;
                  const isDisabled = isPhaseLocked(activePhase) || (!isSelected && maxReached);

                  const actualList = db.tournamentPredictions.find(
                    (tp) => tp.userId === "actual" || tp.groupId === "actual"
                  )?.groupClassifications?.[activePhase] || [];
                  const isCorrect = actualList.includes(team.id);
                  const isFinished = phaseMatches[activePhase].length > 0 && phaseMatches[activePhase].every(m => m.status === "FINISHED");

                  return (
                    <button
                      key={team.id}
                      disabled={isDisabled}
                      onClick={() => handleToggleTeam(team.id)}
                      className={`relative group flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? isFinished
                            ? isCorrect
                              ? "bg-brand-green/10 border-brand-green/40 text-brand-green"
                              : "bg-red-500/10 border-red-500/35 text-red-400"
                            : "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                          : "bg-slate-900/40 border-slate-750 text-slate-300 hover:bg-slate-750/30 hover:border-slate-650 disabled:opacity-40 disabled:hover:bg-slate-900/40 disabled:hover:border-slate-750"
                      }`}
                    >
                      {/* Flag */}
                      {team.flag ? (
                        <img
                          src={team.flag}
                          alt={team.name}
                          className="w-7 h-5 object-cover rounded shadow-md shrink-0 border border-white/5"
                        />
                      ) : (
                        <div className="w-7 h-5 bg-slate-700 rounded shadow-md shrink-0 border border-white/5 flex items-center justify-center text-[8px] font-black uppercase text-slate-400">
                          {team.code}
                        </div>
                      )}

                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-xs tracking-tight truncate leading-tight group-hover:text-white transition-colors">
                          {team.name}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-500 leading-none mt-0.5">
                          {team.code}
                        </span>
                      </div>

                      {/* Floating indicators */}
                      {isSelected && (
                        <div className={`absolute top-1.5 right-1.5 rounded-full p-0.5 text-slate-950 shadow border ${
                          isFinished
                            ? isCorrect
                              ? "bg-brand-green border-brand-green/20"
                              : "bg-red-400 border-red-400/20"
                            : "bg-indigo-400 border-indigo-400/20"
                        }`}>
                          <Check size={8} className="stroke-[3px]" />
                        </div>
                      )}

                      {/* Display correct result tags for finished matches */}
                      {isFinished && isCorrect && isSelected && (
                        <span className="absolute bottom-1 right-2 text-[8px] font-black text-brand-green uppercase tracking-wider">
                          +5 PTS
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredTeams.length === 0 && (
                <div className="py-10 text-center border border-dashed border-slate-700 rounded-2xl">
                  <AlertCircle size={24} className="text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs font-semibold">Nenhuma seleção encontrada.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
