import React, { useState, useMemo } from "react";
import { MatchDB, TeamDB, ExtraPhasePredictionDB } from "../types";
import { useDatabase } from "../contexts/DatabaseContext";
import { Sparkles, Lock, Save, Check, ChevronDown, ChevronUp, AlertCircle, Trophy, Users } from "lucide-react";
import { calculateExtraPhasePoints } from "../utils/scoring";

interface ExtraPhasePredictionsCardProps {
  groupId: string;
  userId: string;
  matches: MatchDB[];
  lockDate: Date;
}

export const ExtraPhasePredictionsCard: React.FC<ExtraPhasePredictionsCardProps> = ({
  groupId,
  userId,
  matches,
  lockDate,
}) => {
  const db = useDatabase();
  const [expandedPhase, setExpandedPhase] = useState<string | null>("groups");
  const [loadingPhase, setLoadingPhase] = useState<string | null>(null);
  const [successPhase, setSuccessPhase] = useState<string | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when phase changes
  React.useEffect(() => {
    setIsDropdownOpen(false);
  }, [expandedPhase]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Group predictions by phase
  const predictionsByPhase = useMemo(() => {
    const map: Record<string, ExtraPhasePredictionDB> = {};
    db.extraPhasePredictions
      .filter((p) => p.userId === userId && p.groupId === groupId)
      .forEach((p) => {
        map[p.phase] = p;
      });
    return map;
  }, [db.extraPhasePredictions, userId, groupId]);

  // Selected match local states
  const [selectedMatchIds, setSelectedMatchIds] = useState<Record<string, string>>({
    groups: predictionsByPhase["groups"]?.matchId || "",
    oitavas: predictionsByPhase["oitavas"]?.matchId || "",
    quartas: predictionsByPhase["quartas"]?.matchId || "",
    semis: predictionsByPhase["semis"]?.matchId || "",
  });

  // Sync database state into local states when loaded
  React.useEffect(() => {
    setSelectedMatchIds({
      groups: predictionsByPhase["groups"]?.matchId || "",
      oitavas: predictionsByPhase["oitavas"]?.matchId || "",
      quartas: predictionsByPhase["quartas"]?.matchId || "",
      semis: predictionsByPhase["semis"]?.matchId || "",
    });
  }, [predictionsByPhase]);

  // Filter matches per phase
  const matchesByPhase = useMemo(() => {
    const groups: MatchDB[] = [];
    const oitavas: MatchDB[] = [];
    const quartas: MatchDB[] = [];
    const semis: MatchDB[] = [];

    matches.forEach((m) => {
      const stage = (m.stage || "").toUpperCase();
      const groupStr = (m.group || "").toUpperCase();

      if (stage.includes("SEMI") || groupStr.includes("SEMI")) {
        semis.push(m);
      } else if (stage.includes("QUARTER") || groupStr.includes("QUARTAS")) {
        quartas.push(m);
      } else if (stage.includes("ROUND_OF_16") || groupStr.includes("OITAVAS")) {
        oitavas.push(m);
      } else if (stage.includes("REGULAR") || stage.includes("GROUP") || groupStr.includes("GRUPO")) {
        groups.push(m);
      }
    });

    const sortByDate = (arr: MatchDB[]) =>
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      groups: sortByDate(groups),
      oitavas: sortByDate(oitavas),
      quartas: sortByDate(quartas),
      semis: sortByDate(semis),
    };
  }, [matches]);

  const teamMap = useMemo(() => {
    const map: Record<string, TeamDB> = {};
    db.teams.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [db.teams]);

  // Phase Definitions for Renders
  const phases = [
    { id: "groups", label: "Fase de Grupos", matches: matchesByPhase.groups },
    { id: "oitavas", label: "Oitavas de Final", matches: matchesByPhase.oitavas },
    { id: "quartas", label: "Quartas de Final", matches: matchesByPhase.quartas },
    { id: "semis", label: "Semifinais", matches: matchesByPhase.semis },
  ];

  // Helper to determine if betting for a phase is locked
  const isPhaseLocked = (phaseId: string, phaseMatches: MatchDB[]) => {
    const now = new Date();
    // Special lock: Tournament lockDate applies to groups
    if (phaseId === "groups") {
      return now >= lockDate;
    }
    // For KO phases, lock betting once the first match of that phase starts
    if (phaseMatches.length > 0) {
      const firstMatchDate = new Date(phaseMatches[0].date);
      return now >= firstMatchDate;
    }
    return now >= lockDate;
  };

  const handleSave = async (phaseId: string) => {
    const matchId = selectedMatchIds[phaseId];
    if (!matchId) return;

    setLoadingPhase(phaseId);
    try {
      await db.upsertExtraPhasePrediction({
        userId,
        groupId,
        phase: phaseId,
        matchId,
      });
      setSuccessPhase(phaseId);
      setTimeout(() => setSuccessPhase(null), 3000);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar palpite da fase.");
    } finally {
      setLoadingPhase(null);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden mb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-900 to-slate-900 px-4 py-4 border-b border-teal-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold">
          <Sparkles size={20} className="text-teal-400 animate-pulse" />
          <div>
            <h3 className="tracking-wide text-sm md:text-base text-teal-100 font-extrabold uppercase">
              Maior Diferença de Gols por Fase
            </h3>
            <span className="text-[10px] text-slate-400 font-normal block">
              Acerte o jogo com maior saldo de gols em cada fase e ganhe +20 pontos por acerto!
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {phases.map((phase) => {
          const isLocked = isPhaseLocked(phase.id, phase.matches);
          const savedPred = predictionsByPhase[phase.id];
          const isExpanded = expandedPhase === phase.id;
          const selectedMatchId = selectedMatchIds[phase.id];

          // Compute phase score if matches are played
          const finishedPhaseMatches = phase.matches.filter(
            (m) => m.status === "FINISHED" && m.resultHome != null && m.resultAway != null
          );
          const hasFinishedMatches = finishedPhaseMatches.length > 0;
          const isPhaseFullyFinished = phase.matches.length > 0 && phase.matches.every(m => m.status === "FINISHED");

          let earnedPoints = 0;
          if (savedPred && hasFinishedMatches) {
            earnedPoints = calculateExtraPhasePoints(
              { phase: phase.id, matchId: savedPred.matchId },
              phase.matches.map((m) => ({
                id: m.id,
                status: m.status,
                resultHome: m.resultHome ?? null,
                resultAway: m.resultAway ?? null,
              }))
            );
          }

          const hasSaved = !!savedPred?.matchId;

          return (
            <div
              key={phase.id}
              className="bg-slate-900/40 rounded-lg border border-slate-750 transition-all"
            >
              {/* Trigger Button */}
              <button
                onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="font-bold text-sm text-slate-200">{phase.label}</div>

                  {/* Status Badges */}
                  {isPhaseFullyFinished ? (
                    earnedPoints > 0 ? (
                      <span className="text-[10px] font-black text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded flex items-center gap-1">
                        <Trophy size={10} /> +20 PTS
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-950/40 px-2 py-0.5 rounded">
                        Encerrado
                      </span>
                    )
                  ) : isLocked ? (
                    <span className="text-[10px] text-orange-400 bg-orange-950/30 border border-orange-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock size={10} /> Em Andamento
                    </span>
                  ) : hasSaved ? (
                    <span className="text-[10px] text-teal-400 bg-teal-950/30 border border-teal-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check size={10} /> Palpitado
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-850 border border-slate-700 px-2 py-0.5 rounded">
                      Aberto
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {/* Collapsed/Expanded Panel */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800 space-y-3 animate-fadeIn">
                  {phase.matches.length === 0 ? (
                    <div className="text-xs text-slate-500 py-2 flex items-center gap-1.5">
                      <AlertCircle size={14} />
                      Confrontos desta fase ainda não definidos.
                    </div>
                  ) : (
                    <>
                      {/* Other Users' Predictions for this phase - Always visible, data hidden until lock */}
                      <OtherExtraPhasePredictions
                        phaseId={phase.id}
                        phaseLabel={phase.label}
                        phaseMatches={phase.matches}
                        groupId={groupId}
                        userId={userId}
                        db={db}
                        teamMap={teamMap}
                        isLocked={isLocked}
                      />

                      <div className="text-xs text-slate-400 font-medium">
                        Selecione a partida que você acredita que terminará com a maior diferença de gols:
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1" ref={dropdownRef}>
                          <button
                            type="button"
                            onClick={() => !isLocked && setIsDropdownOpen(!isDropdownOpen)}
                            disabled={isLocked}
                            className={`w-full bg-slate-800 border ${isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} border-slate-650 rounded px-3 py-2 text-sm text-white flex items-center justify-between focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all`}
                          >
                            {selectedMatchId ? (
                              (() => {
                                const m = phase.matches.find((x) => x.id === selectedMatchId);
                                const home = m ? teamMap[m.homeTeamId] : null;
                                const away = m ? teamMap[m.awayTeamId] : null;
                                const matchDate = m ? new Date(m.date).toLocaleDateString("pt-BR", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }) : "";
                                return m ? (
                                  <div className="flex items-center gap-2">
                                    {home?.flag && <img src={home.flag} alt={home.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />}
                                    <span className="font-bold">{home?.name || "TBD"}</span>
                                    <span className="text-slate-400">vs</span>
                                    {away?.flag && <img src={away.flag} alt={away.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />}
                                    <span className="font-bold">{away?.name || "TBD"}</span>
                                    <span className="text-slate-400 text-xs ml-1">({matchDate})</span>
                                  </div>
                                ) : <span className="text-slate-400">Selecione o jogo...</span>;
                              })()
                            ) : (
                              <span className="text-slate-400">Selecione o jogo...</span>
                            )}
                            {!isLocked && <ChevronDown size={14} className="text-slate-400" />}
                          </button>

                          {/* Dropdown Menu */}
                          {isDropdownOpen && !isLocked && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                              {phase.matches.map((m) => {
                                const home = teamMap[m.homeTeamId];
                                const away = teamMap[m.awayTeamId];
                                const matchDate = new Date(m.date).toLocaleDateString("pt-BR", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedMatchIds((prev) => ({
                                        ...prev,
                                        [phase.id]: m.id,
                                      }));
                                      setIsDropdownOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-3 transition-colors border-b border-slate-700/50 last:border-0"
                                  >
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {home?.flag && <img src={home.flag} alt={home.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />}
                                      <span className="font-semibold">{home?.name || "TBD"}</span>
                                    </div>
                                    <span className="text-slate-500 text-xs font-bold shrink-0">vs</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {away?.flag && <img src={away.flag} alt={away.name} className="w-5 h-3.5 object-cover rounded shadow-sm" />}
                                      <span className="font-semibold">{away?.name || "TBD"}</span>
                                    </div>
                                    <span className="text-slate-400 text-xs ml-auto">({matchDate})</span>
                                    {selectedMatchId === m.id && <Check size={14} className="ml-2 text-brand-green shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {!isLocked && (
                          <button
                            onClick={() => handleSave(phase.id)}
                            disabled={!selectedMatchId || loadingPhase === phase.id}
                            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-white shadow-lg ${successPhase === phase.id
                                ? "bg-brand-green text-slate-900"
                                : "bg-teal-600 hover:bg-teal-500 shadow-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              }`}
                          >
                            {successPhase === phase.id ? (
                              <>
                                <Check size={14} /> Salvo!
                              </>
                            ) : loadingPhase === phase.id ? (
                              "Salvando..."
                            ) : (
                              <>
                                <Save size={14} /> Salvar
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Info on Lock and Finished Predictions */}
                      {isLocked && savedPred?.matchId && (
                        <div className="text-xs p-2 bg-slate-950/30 rounded border border-slate-800 text-slate-400 flex justify-between items-center">
                          <div>
                            Seu palpite:{" "}
                            <span className="font-bold text-slate-200">
                              {(() => {
                                const m = phase.matches.find((x) => x.id === savedPred.matchId);
                                const h = m ? teamMap[m.homeTeamId] : null;
                                const a = m ? teamMap[m.awayTeamId] : null;
                                return m ? `${h?.name || "TBD"} vs ${a?.name || "TBD"}` : "---";
                              })()}
                            </span>
                          </div>
                          {isPhaseFullyFinished && (
                            <div className="font-bold">
                              {earnedPoints > 0 ? (
                                <span className="text-brand-green">✓ Acertou! +20 PTS</span>
                              ) : (
                                <span className="text-slate-500">Errou</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Sub-component: Other users' extra phase predictions accordion
const OtherExtraPhasePredictions: React.FC<{
  phaseId: string;
  phaseLabel: string;
  phaseMatches: MatchDB[];
  groupId: string;
  userId: string;
  db: ReturnType<typeof useDatabase>;
  teamMap: Record<string, TeamDB>;
  isLocked: boolean;
}> = ({ phaseId, phaseLabel, phaseMatches, groupId, userId, db, teamMap, isLocked }) => {
  const [isOpen, setIsOpen] = useState(false);

  const otherPreds = useMemo(() => {
    return db.extraPhasePredictions.filter(
      (p) => p.groupId === groupId && p.userId !== userId && p.phase === phaseId
    );
  }, [db.extraPhasePredictions, groupId, userId, phaseId]);

  const getUserName = (uid: string) => {
    const user = db.users.find((u) => u.id === uid);
    return user?.name || "Anônimo";
  };

  const getMatchLabel = (matchId?: string) => {
    if (!matchId) return "—";
    const m = phaseMatches.find((x) => x.id === matchId);
    if (!m) return "—";
    const home = teamMap[m.homeTeamId];
    const away = teamMap[m.awayTeamId];
    return `${home?.code || home?.name || "TBD"} vs ${away?.code || away?.name || "TBD"}`;
  };

  return (
    <div className="mt-3 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900/60 hover:bg-slate-900/80 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <Users size={12} />
          <span className="text-[10px] font-bold uppercase tracking-wide">
            Palpites do Grupo ({otherPreds.length})
          </span>
        </div>
        {isOpen ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
      </button>

      {isOpen && (
        otherPreds.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 text-center">
            Nenhum outro participante fez palpites nesta fase ainda.
          </div>
        ) : (
        <div className="overflow-x-auto animate-fadeIn">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/40 text-slate-400 border-t border-slate-700">
                <th className="px-3 py-1.5 text-left font-medium">Participante</th>
                <th className="px-2 py-1.5 text-center font-medium">Jogo Escolhido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {otherPreds.map((p) => (
                <tr key={p.userId} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-3 py-1.5 font-semibold text-slate-200 whitespace-nowrap">
                    {getUserName(p.userId)}
                  </td>
                  <td className="px-2 py-1.5 text-center text-slate-300 whitespace-nowrap">
                    {isLocked ? getMatchLabel(p.matchId) : "Oculto"}
                  </td>
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
