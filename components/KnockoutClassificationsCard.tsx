import React, { useState, useMemo, useEffect } from "react";
import { Match, Team, TournamentPredictions } from "../types";
import { Check, Lock, ChevronDown, ChevronUp, Search, Trophy, Sparkles, AlertCircle, Save, Users } from "lucide-react";
import { useDatabase } from "../contexts/DatabaseContext";

type KnockoutPhase = "Oitavas" | "Quartas" | "Semis";

interface KnockoutClassificationsCardProps {
  matches: Match[];
  prediction: TournamentPredictions | undefined;
  lockDate: Date;
  onPredict: (data: TournamentPredictions) => void;
  currentUserId?: string;
  currentGroupId?: string;
}

export const KnockoutClassificationsCard: React.FC<KnockoutClassificationsCardProps> = ({
  matches,
  prediction,
  lockDate,
  onPredict,
  currentUserId,
  currentGroupId,
}) => {
  const db = useDatabase();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePhase, setActivePhase] = useState<KnockoutPhase | null>("Oitavas");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [, forceUpdate] = useState({});
  const [isGloballyLocked, setIsGloballyLocked] = useState(false);

  // Check global lock state based on lockDate
  useEffect(() => {
    const checkLock = () => {
      const now = new Date();
      setIsGloballyLocked(now >= lockDate);
    };
    checkLock();
    const timer = setInterval(checkLock, 60000);
    return () => clearInterval(timer);
  }, [lockDate]);

  // Group matches by phase to determine lock times and finished states
  const phaseMatches = useMemo(() => {
    const oitavas: Match[] = [];
    const quartas: Match[] = [];
    const semis: Match[] = [];

    matches.forEach((m) => {
      const stage = (m.stage || "").toUpperCase();
      const groupStr = (m.group || "").toUpperCase();

      if (stage.includes("ROUND_OF_16") || stage.includes("LAST_16") || groupStr.includes("OITAVAS")) {
        oitavas.push(m);
      } else if (stage.includes("QUARTER") || groupStr.includes("QUARTAS")) {
        quartas.push(m);
      } else if (stage.includes("SEMI") || groupStr.includes("SEMI")) {
        semis.push(m);
      }
    });

    return { Oitavas: oitavas, Quartas: quartas, Semis: semis };
  }, [matches]);

  // Matches that feed teams into each phase (previous round)
  const sourceMatchesByPhase = useMemo(() => {
    const oitavas: Match[] = [];
    const quartas: Match[] = [];
    const semis: Match[] = [];

    matches.forEach((m) => {
      const stage = (m.stage || "").toUpperCase();
      const groupStr = (m.group || "").toUpperCase();

      // 16 Avos (round of 32) feeds Oitavas
      if (stage.includes("ROUND_OF_32") || stage.includes("LAST_32") || groupStr.includes("16_AVOS") || groupStr.includes("16AVOS")) {
        oitavas.push(m);
      }
      // Oitavas feeds Quartas
      if (stage.includes("ROUND_OF_16") || stage.includes("LAST_16") || groupStr.includes("OITAVAS")) {
        quartas.push(m);
      }
      // Quartas feeds Semis
      if (stage.includes("QUARTER") || groupStr.includes("QUARTAS")) {
        semis.push(m);
      }
    });

    return { Oitavas: oitavas, Quartas: quartas, Semis: semis };
  }, [matches]);

  // Determine lock state per phase
  const isPhaseLocked = (phase: KnockoutPhase) => {
    const now = new Date();
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
    Oitavas: [],
    Quartas: [],
    Semis: [],
  });

  // Sync saved database predictions into local state
  useEffect(() => {
    if (prediction?.groupClassifications) {
      setSelectedTeams({
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

  // Filtered teams list based on search query and active phase
  // Each phase only lists teams that played in the previous round.
  // If the previous round has no matches yet, the list stays empty.
  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const phase = activePhase;

    const sourceTeamIds = new Set<string>();

    if (phase) {
      sourceMatchesByPhase[phase].forEach((m) => {
        if (m.homeTeam?.id) sourceTeamIds.add(m.homeTeam.id);
        if (m.awayTeam?.id) sourceTeamIds.add(m.awayTeam.id);
      });
    }

    const eligibleTeams = db.teams.filter((t) => sourceTeamIds.has(t.id));
    const sortedTeams = [...eligibleTeams].sort((a, b) => a.name.localeCompare(b.name));

    if (!query) return sortedTeams;
    return sortedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.code.toLowerCase().includes(query)
    );
  }, [db.teams, sourceMatchesByPhase, searchQuery, activePhase]);

  // Toggle selection for active phase
  const handleToggleTeam = (teamId: string) => {
    const phase = activePhase;
    if (!phase || isPhaseLocked(phase)) return;

    const currentSelection = selectedTeams[phase];
    const maxAllowed =
      phase === "Oitavas" ? 16 : phase === "Quartas" ? 8 : 4;

    if (currentSelection.includes(teamId)) {
      setSelectedTeams((prev) => ({
        ...prev,
        [phase]: prev[phase].filter((id) => id !== teamId),
      }));
    } else {
      if (currentSelection.length >= maxAllowed) return; // Limit reached
      setSelectedTeams((prev) => ({
        ...prev,
        [phase]: [...prev[phase], teamId],
      }));
    }
  };

  const handleSave = async (phase: KnockoutPhase) => {
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
  const getPhaseResults = (phase: KnockoutPhase) => {
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
    Oitavas: { max: 16, label: "Oitavas de Final" },
    Quartas: { max: 8, label: "Quartas de Final" },
    Semis: { max: 4, label: "Semifinais" },
  };

  const visiblePhases = (["Oitavas", "Quartas", "Semis"] as const);

  const visiblePhaseConfig = Object.fromEntries(
    visiblePhases.map((phase) => [phase, phaseConfig[phase]])
  );

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden">
      {/* Header / Accordion Trigger */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gradient-to-r from-indigo-900/80 to-slate-900 px-4 py-3 flex justify-between items-center transition-colors hover:bg-slate-800 rounded-t-xl"
      >
        <div className="flex items-center gap-3 text-white">
          <Trophy size={20} className="text-purple-400" />
          <div className="text-left">
            <h3 className="tracking-wide text-sm font-bold uppercase">
              Classificados 2º Fase
            </h3>
            <span className="text-[10px] text-slate-400 font-normal block">
              Bloqueio progressivo por fase (cada fase bloqueia quando começa)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 sm:px-4 pb-4 pt-3 border-t border-slate-700 space-y-4">
          {/* Phase Selector - Vertical accordion on mobile, horizontal tabs on desktop */}
          <div className="flex flex-col sm:flex-row bg-slate-900/40 p-1 rounded-2xl border border-slate-800 gap-1">
            {visiblePhases.map((phase) => {
              const config = phaseConfig[phase];
              const isLocked = isPhaseLocked(phase);
              const count = selectedTeams[phase].length;
              const isActive = activePhase === phase;
              const results = getPhaseResults(phase);

              return (
                <button
                  key={phase}
                  onClick={() => setActivePhase(isActive ? null : phase)}
                  className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between sm:justify-center gap-1.5 ${
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
                    <span className="sm:hidden">
                      {isActive ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activePhase && (() => {
            const phase = activePhase;
            const isLocked = isPhaseLocked(phase);
            const results = getPhaseResults(phase);
            const count = selectedTeams[phase].length;
            const config = phaseConfig[phase];

            return (
              <div className="space-y-4 animate-fadeIn">
                {/* Info & Lock Box */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900/40 border border-slate-750 rounded-2xl p-4 gap-4">
                  <div className="flex items-start gap-3">
                    {isLocked ? (
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
                        Palpites para {config.label}
                        {isLocked && (
                          <span className="text-[9px] uppercase tracking-widest bg-orange-950/40 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded">
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {isLocked
                          ? "O prazo para enviar ou alterar os palpites desta fase encerrou."
                          : `Selecione exatamente ${config.max} seleções que avançam para esta fase.`}
                      </p>
                    </div>
                  </div>

                  {!isLocked && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      {count > 0 && (
                        <button
                          onClick={() => setSelectedTeams(prev => ({ ...prev, [phase]: [] }))}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-705 text-red-400 hover:text-red-300 border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                        >
                          Limpar Escolhas
                        </button>
                      )}
                      <button
                        onClick={() => handleSave(phase)}
                        disabled={
                          (count !== 0 && count !== config.max) ||
                          saveSuccess === phase
                        }
                        className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all text-white shadow-lg ${
                          saveSuccess === phase
                            ? "bg-brand-green text-slate-900"
                            : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                      >
                        {saveSuccess === phase ? (
                          <>
                            <Check size={14} /> Salvo!
                          </>
                        ) : (
                          <>
                            <Save size={14} /> Salvar Fase
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Team Selection Grid */}
                <div className="bg-slate-900/40 border border-slate-750 rounded-2xl sm:rounded-3xl p-3 sm:p-6">
                  {!isLocked && (
                    <div className="relative mb-6">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500">
                        <Search size={18} />
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar seleção..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                    {filteredTeams.map((team) => {
                      const isSelected = selectedTeams[phase].includes(team.id);
                      const isCorrect = results.actualList.includes(team.id);
                      const isFinished = results.isFinished;

                      return (
                        <button
                          key={team.id}
                          disabled={isLocked || (!isSelected && count >= config.max)}
                          onClick={() => handleToggleTeam(team.id)}
                          className={`group relative flex flex-col items-center p-3 sm:p-4 rounded-2xl border transition-all duration-200 ${
                            isSelected
                              ? isFinished
                                ? isCorrect
                                  ? "bg-brand-green/10 border-brand-green/50 ring-1 ring-brand-green/30"
                                  : "bg-red-500/10 border-red-500/50 ring-1 ring-red-500/30"
                                : "bg-indigo-600/10 border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-lg shadow-indigo-500/10"
                              : "bg-slate-950/30 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50"
                          } ${isLocked ? "cursor-default" : "cursor-pointer active:scale-95"}`}
                        >
                          <div className="relative mb-2">
                            <div className="w-10 h-7 sm:w-12 sm:h-8 flex items-center justify-center bg-slate-800 rounded shadow-inner overflow-hidden border border-slate-700/50">
                              <img
                                src={team.flag}
                                alt={team.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              />
                            </div>
                            {isSelected && (
                              <div className="absolute -top-1.5 -right-1.5 bg-brand-green text-slate-900 rounded-full p-0.5 shadow-lg border border-slate-900">
                                <Check size={10} strokeWidth={4} />
                              </div>
                            )}
                          </div>
                          <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-tight text-center truncate w-full ${isSelected ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
                            {team.name}
                          </span>
                          {isFinished && isSelected && (
                            <div className={`mt-1.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${isCorrect ? "bg-brand-green text-slate-900" : "bg-red-500 text-white"}`}>
                              {isCorrect ? "+5 PTS" : "0 PTS"}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredTeams.length === 0 && (
                  <div className="py-10 text-center border border-dashed border-slate-700 rounded-2xl">
                    <AlertCircle size={24} className="text-slate-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs font-semibold">Nenhuma seleção encontrada.</p>
                  </div>
                )}

                {/* Other Users' Knockout Predictions - visible after this phase locks - data hidden until lock */}
                {currentGroupId && (() => {
                  const otherPreds = db.tournamentPredictions.filter(
                    (tp) => tp.groupId === currentGroupId && tp.userId !== currentUserId && tp.groupClassifications?.[phase]
                  );

                  return (
                    <OtherKnockoutPredictions
                      otherPreds={otherPreds}
                      phase={phase}
                      db={db}
                      config={config}
                      isLocked={isLocked}
                    />
                  );
                })()}
              </div>
            );
          })()}

          {/* Card-level: All users' knockout predictions for all phases - Always visible, data hidden until each phase locks */}
          {currentGroupId && (() => {
            const allOtherPreds = db.tournamentPredictions.filter(
              (tp) => tp.groupId === currentGroupId && tp.userId !== currentUserId && tp.groupClassifications
            );

            const phaseLockMap: Record<string, boolean> = {};
            visiblePhases.forEach((p) => {
              phaseLockMap[p] = isPhaseLocked(p);
            });

            return (
              <AllKnockoutPredictionsCard
                otherPreds={allOtherPreds}
                db={db}
                phaseConfig={visiblePhaseConfig}
                phaseLockMap={phaseLockMap}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Card-level sub-component: All users' knockout predictions for all phases
const AllKnockoutPredictionsCard: React.FC<{
  otherPreds: any[];
  db: ReturnType<typeof useDatabase>;
  phaseConfig: Record<string, { max: number; label: string }>;
  phaseLockMap: Record<string, boolean>;
}> = ({ otherPreds, db, phaseConfig, phaseLockMap }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getUserName = (uid: string) => {
    const user = db.users.find((u) => u.id === uid);
    return user?.name || "Anônimo";
  };

  const getTeamCode = (teamId: string) => {
    const team = db.teams.find((t) => t.id === teamId);
    return team?.code || "?";
  };

  const phases = Object.keys(phaseConfig);

  return (
    <div className="mt-4 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <Users size={14} />
          <span className="text-xs font-bold uppercase tracking-wide">
            Palpites do Grupo - Todas as Fases ({otherPreds.length})
          </span>
        </div>
        {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {isOpen && (
        otherPreds.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center">
            Nenhum outro participante fez palpites neste grupo ainda.
          </div>
        ) : (
        <div className="overflow-x-auto animate-fadeIn p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/40 text-slate-400 border-t border-slate-700">
                <th className="px-3 py-2 text-left font-medium">Participante</th>
                {phases.map((p) => (
                  <th key={p} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                    {phaseConfig[p].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {otherPreds.map((tp) => (
                <tr key={tp.userId} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-2 font-semibold text-slate-200 whitespace-nowrap">
                    {getUserName(tp.userId)}
                  </td>
                  {phases.map((p) => {
                    const picks = tp.groupClassifications?.[p] || [];
                    const phaseIsLocked = phaseLockMap[p] ?? false;
                    return (
                      <td key={p} className="px-2 py-2 text-center text-slate-300">
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {picks.length > 0
                            ? phaseIsLocked
                              ? picks.map((id: string) => (
                                  <span key={id} className="text-[9px] bg-slate-800 text-slate-300 px-1 py-0.5 rounded border border-slate-700">
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
              ))}
            </tbody>
          </table>
        </div>
        )
      )}
    </div>
  );
};

// Sub-component: Other users' knockout predictions accordion
const OtherKnockoutPredictions: React.FC<{
  otherPreds: any[];
  phase: string;
  db: ReturnType<typeof useDatabase>;
  config: { max: number; label: string };
  isLocked: boolean;
}> = ({ otherPreds, phase, db, config, isLocked }) => {
  const [isOpen, setIsOpen] = useState(false);

  const getUserName = (userId: string) => {
    const user = db.users.find((u) => u.id === userId);
    return user?.name || "Anônimo";
  };

  const getTeamCode = (teamId: string) => {
    const team = db.teams.find((t) => t.id === teamId);
    return team?.code || "?";
  };

  return (
    <div className="mt-4 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <Users size={14} />
          <span className="text-xs font-bold uppercase tracking-wide">
            {config.label} - Palpites ({otherPreds.length})
          </span>
        </div>
        {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>

      {isOpen && (
        otherPreds.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center">
            Nenhum outro participante fez palpites nesta fase ainda.
          </div>
        ) : (
        <div className="overflow-x-auto animate-fadeIn p-3">
          <div className="space-y-2">
            {otherPreds.map((tp) => {
              const picks = tp.groupClassifications?.[phase] || [];
              return (
                <div key={tp.userId} className="bg-slate-900/40 rounded-lg p-2.5 border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-300 mb-1.5">
                    {getUserName(tp.userId)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {picks.length > 0
                      ? isLocked
                        ? picks.map((id: string) => (
                            <span key={id} className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                              {getTeamCode(id)}
                            </span>
                          ))
                        : <span className="text-[10px] text-slate-500 italic">Oculto</span>
                      : <span className="text-[10px] text-slate-500">Nenhum palpite</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )
      )}
    </div>
  );
};
