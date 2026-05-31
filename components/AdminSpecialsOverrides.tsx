import React, { useState, useMemo, useEffect } from "react";
import { useDatabase } from "../contexts/DatabaseContext";
import {
  Star,
  Save,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  Trophy,
  Target,
  Layers,
} from "lucide-react";

interface AdminSpecialsOverridesProps {
  selectedCompetitionCode: string | null;
}

const AdminSpecialsOverrides: React.FC<AdminSpecialsOverridesProps> = ({
  selectedCompetitionCode,
}) => {
  const db = useDatabase();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- GROUP CLASSIFICATIONS STATE ---
  const [groupClassifications, setGroupClassifications] = useState<
    Record<string, string[]>
  >({});

  // --- KNOCKOUT CLASSIFICATIONS STATE ---
  const [knockoutClassifications, setKnockoutClassifications] = useState<
    Record<string, string[]>
  >({ Oitavas: [], Quartas: [], Semis: [] });

  // --- BIGGEST GOAL DIFF MATCHES STATE ---
  const [biggestGoalDiffMatches, setBiggestGoalDiffMatches] = useState<
    Record<string, string>
  >({ groups: "", oitavas: "", quartas: "", semis: "" });

  // Load from competition when selected
  useEffect(() => {
    if (!selectedCompetitionCode) return;
    const comp = db.competitions.find(
      (c) => c.code.toLowerCase() === selectedCompetitionCode.toLowerCase()
    );
    if (comp) {
      setGroupClassifications(comp.groupClassifications || {});
      setKnockoutClassifications(
        comp.knockoutClassifications || { Oitavas: [], Quartas: [], Semis: [] }
      );
      setBiggestGoalDiffMatches(
        comp.biggestGoalDiffMatches || { groups: "", oitavas: "", quartas: "", semis: "" }
      );
    } else {
      setGroupClassifications({});
      setKnockoutClassifications({ Oitavas: [], Quartas: [], Semis: [] });
      setBiggestGoalDiffMatches({ groups: "", oitavas: "", quartas: "", semis: "" });
    }
  }, [selectedCompetitionCode, db.competitions]);

  // Teams in this competition
  const competitionTeams = useMemo(() => {
    if (!selectedCompetitionCode) return [];
    const teamIdsInCompetition = new Set(
      db.teamStandings
        .filter(
          (ts) =>
            ts.competitionCode?.toUpperCase() ===
            selectedCompetitionCode.toUpperCase()
        )
        .map((ts) => ts.teamId)
    );
    if (teamIdsInCompetition.size === 0) {
      const teamIdsFromMatches = new Set(
        db.matches
          .filter(
            (m) =>
              m.competitionCode?.toUpperCase() ===
              selectedCompetitionCode.toUpperCase()
          )
          .flatMap((m) => [m.homeTeamId, m.awayTeamId])
      );
      return db.teams
        .filter((t) => teamIdsFromMatches.has(t.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return db.teams
      .filter((t) => teamIdsInCompetition.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCompetitionCode, db.teams, db.teamStandings, db.matches]);

  const normalizeGroupName = (groupName: string) => {
    if (!groupName) return "";
    const m = /^(?:Group|GROUP)[_\s]+([A-Z])$/i.exec(groupName.trim());
    if (!m) return groupName;
    return `Grupo ${m[1]}`;
  };

  const KNOCKOUT_STAGE_PATTERNS = /^(LAST_16|LAST_32|ROUND_OF_16|ROUND_OF_32|QUARTER_FINAL|SEMI_FINAL|FINAL|THIRD_PLACE|PLAY_OFF)/i;

  // Groups derived from standings
  const groupNames = useMemo(() => {
    if (!selectedCompetitionCode) return [];
    const groups = new Set<string>();
    db.teamStandings.forEach((ts) => {
      if (
        ts.competitionCode?.toUpperCase() ===
          selectedCompetitionCode.toUpperCase() &&
        ts.group
      ) {
        const normalized = normalizeGroupName(ts.group);
        if (
          normalized.startsWith("Grupo") &&
          !KNOCKOUT_STAGE_PATTERNS.test(normalized.replace(/\s+/g, "_"))
        ) {
          groups.add(normalized);
        }
      }
    });
    // Fallback to matches
    if (groups.size === 0) {
      db.matches.forEach((m) => {
        if (
          m.competitionCode?.toUpperCase() ===
            selectedCompetitionCode.toUpperCase() &&
          m.group
        ) {
          const normalized = normalizeGroupName(m.group);
          if (
            normalized.startsWith("Grupo") &&
            !KNOCKOUT_STAGE_PATTERNS.test(normalized.replace(/\s+/g, "_"))
          ) {
            groups.add(normalized);
          }
        }
      });
    }
    return Array.from(groups).sort();
  }, [selectedCompetitionCode, db.teamStandings, db.matches]);

  // Teams per group (for dropdowns)
  const teamsPerGroup = useMemo(() => {
    const map: Record<string, typeof competitionTeams> = {};
    groupNames.forEach((g) => {
      const teamIds = new Set<string>();
      db.teamStandings.forEach((ts) => {
        if (
          ts.competitionCode?.toUpperCase() ===
            selectedCompetitionCode?.toUpperCase() &&
          ts.group &&
          normalizeGroupName(ts.group) === g
        ) {
          teamIds.add(ts.teamId);
        }
      });
      // Fallback to matches
      if (teamIds.size === 0) {
        db.matches.forEach((m) => {
          if (
            m.competitionCode?.toUpperCase() ===
              selectedCompetitionCode?.toUpperCase() &&
            m.group &&
            normalizeGroupName(m.group) === g
          ) {
            teamIds.add(m.homeTeamId);
            teamIds.add(m.awayTeamId);
          }
        });
      }
      map[g] = db.teams
        .filter((t) => teamIds.has(t.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    });
    return map;
  }, [groupNames, selectedCompetitionCode, db.teamStandings, db.matches, db.teams]);

  // Matches by phase for biggest goal diff selector
  const matchesByPhase = useMemo(() => {
    if (!selectedCompetitionCode) return { groups: [], oitavas: [], quartas: [], semis: [] };

    const groups: typeof db.matches = [];
    const oitavas: typeof db.matches = [];
    const quartas: typeof db.matches = [];
    const semis: typeof db.matches = [];

    db.matches.forEach((m) => {
      if (
        m.competitionCode?.toUpperCase() !==
        selectedCompetitionCode.toUpperCase()
      )
        return;

      const stage = (m.stage || "").toUpperCase();
      const groupStr = (m.group || "").toUpperCase();

      if (stage.includes("ROUND_OF_16") || groupStr.includes("OITAVAS")) {
        oitavas.push(m);
      } else if (stage.includes("QUARTER") || groupStr.includes("QUARTAS")) {
        quartas.push(m);
      } else if (stage.includes("SEMI") || groupStr.includes("SEMI")) {
        semis.push(m);
      } else if (groupStr.startsWith("GRUPO") || stage.includes("GROUP")) {
        groups.push(m);
      }
    });

    return { groups, oitavas, quartas, semis };
  }, [selectedCompetitionCode, db.matches]);

  const getTeamName = (teamId: string) => {
    const team = db.teams.find((t) => t.id === teamId);
    return team?.name || teamId.substring(0, 8);
  };

  const getTeamFlag = (teamId: string) => {
    const team = db.teams.find((t) => t.id === teamId);
    return team?.flag || null;
  };

  const handleSave = async () => {
    if (!selectedCompetitionCode) return;
    setIsSaving(true);
    try {
      // Clean empty entries
      const cleanGroupClassif: Record<string, string[]> = {};
      Object.entries(groupClassifications).forEach(([g, teams]) => {
        const filtered = teams.filter(Boolean);
        if (filtered.length > 0) {
          cleanGroupClassif[g] = filtered;
        }
      });

      const cleanKnockout: Record<string, string[]> = {};
      Object.entries(knockoutClassifications).forEach(([phase, teams]) => {
        const filtered = teams.filter(Boolean);
        if (filtered.length > 0) {
          cleanKnockout[phase] = filtered;
        }
      });

      const cleanBiggestDiff: Record<string, string> = {};
      Object.entries(biggestGoalDiffMatches).forEach(([phase, matchId]) => {
        if (matchId) {
          cleanBiggestDiff[phase] = matchId;
        }
      });

      await db.updateCompetitionAwards(selectedCompetitionCode, {
        groupClassifications:
          Object.keys(cleanGroupClassif).length > 0 ? cleanGroupClassif : null,
        knockoutClassifications:
          Object.keys(cleanKnockout).length > 0 ? cleanKnockout : null,
        biggestGoalDiffMatches:
          Object.keys(cleanBiggestDiff).length > 0 ? cleanBiggestDiff : null,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      console.log("✅ Overrides de especiais salvos com sucesso");
    } catch (err) {
      console.error("Erro ao salvar overrides de especiais:", err);
      alert("Erro ao salvar overrides de especiais");
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedCompetitionCode) return null;

  const phaseLabels: Record<string, string> = {
    groups: "Fase de Grupos",
    oitavas: "Oitavas de Final",
    quartas: "Quartas de Final",
    semis: "Semifinais",
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-900/40 to-slate-800 hover:from-purple-900/60 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
            <Star size={20} />
          </div>
          <div className="text-left">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">
              Overrides Manuais — Especiais
            </h3>
            <p className="text-slate-400 text-xs">
              Classificados dos Grupos, 2ª Fase e Maior Diferença de Gols
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
              <Check size={14} /> Salvo
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={20} className="text-slate-400" />
          ) : (
            <ChevronDown size={20} className="text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 space-y-6 border-t border-slate-700">
          {/* SECTION 1: Group Classifications */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Layers size={16} />
              <h4 className="font-bold text-sm uppercase tracking-wider">
                Classificados dos Grupos (1º e 2º)
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              Defina manualmente quais seleções se classificaram em 1º e 2º lugar em cada grupo.
              Estes valores têm precedência sobre os dados da API.
            </p>

            {groupNames.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Nenhum grupo encontrado para esta competição. Sincronize primeiro.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupNames.map((groupName) => {
                  const teams = teamsPerGroup[groupName] || [];
                  const current = groupClassifications[groupName] || ["", ""];
                  return (
                    <div
                      key={groupName}
                      className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 space-y-2"
                    >
                      <h5 className="text-xs font-bold text-white uppercase">
                        {groupName}
                      </h5>
                      {/* 1st place */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold uppercase">
                          1º Lugar
                        </label>
                        <select
                          value={current[0] || ""}
                          onChange={(e) => {
                            const newClassif = { ...groupClassifications };
                            if (!newClassif[groupName]) newClassif[groupName] = ["", ""];
                            newClassif[groupName] = [e.target.value, newClassif[groupName][1] || ""];
                            setGroupClassifications(newClassif);
                          }}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                        >
                          <option value="">— Não definido —</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* 2nd place */}
                      <div>
                        <label className="text-[10px] text-slate-400 font-semibold uppercase">
                          2º Lugar
                        </label>
                        <select
                          value={current[1] || ""}
                          onChange={(e) => {
                            const newClassif = { ...groupClassifications };
                            if (!newClassif[groupName]) newClassif[groupName] = ["", ""];
                            newClassif[groupName] = [newClassif[groupName][0] || "", e.target.value];
                            setGroupClassifications(newClassif);
                          }}
                          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                        >
                          <option value="">— Não definido —</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: Knockout Classifications */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Trophy size={16} />
              <h4 className="font-bold text-sm uppercase tracking-wider">
                Classificados 2ª Fase (Oitavas, Quartas, Semis)
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              Selecione as seleções classificadas para cada fase eliminatória.
              Estes valores têm precedência sobre os dados da API.
            </p>

            {(["Oitavas", "Quartas", "Semis"] as const).map((phase) => {
              const maxTeams = phase === "Oitavas" ? 16 : phase === "Quartas" ? 8 : 4;
              const selected = knockoutClassifications[phase] || [];

              return (
                <div
                  key={phase}
                  className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-white uppercase">
                      {phase} ({selected.filter(Boolean).length}/{maxTeams})
                    </h5>
                    <button
                      onClick={() => {
                        setKnockoutClassifications((prev) => ({
                          ...prev,
                          [phase]: [],
                        }));
                      }}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Limpar
                    </button>
                  </div>

                  {/* Selected teams display */}
                  {selected.filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.filter(Boolean).map((teamId) => (
                        <span
                          key={teamId}
                          className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] px-2 py-1 rounded-full"
                        >
                          {getTeamFlag(teamId) && (
                            <img
                              src={getTeamFlag(teamId)!}
                              alt=""
                              className="w-3 h-2 object-cover rounded-sm"
                            />
                          )}
                          {getTeamName(teamId)}
                          <button
                            onClick={() => {
                              setKnockoutClassifications((prev) => ({
                                ...prev,
                                [phase]: prev[phase].filter((id) => id !== teamId),
                              }));
                            }}
                            className="ml-0.5 text-amber-500 hover:text-rose-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Team selector dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      const teamId = e.target.value;
                      if (!teamId) return;
                      if (selected.includes(teamId)) return;
                      if (selected.filter(Boolean).length >= maxTeams) return;
                      setKnockoutClassifications((prev) => ({
                        ...prev,
                        [phase]: [...(prev[phase] || []), teamId],
                      }));
                    }}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                  >
                    <option value="">+ Adicionar seleção...</option>
                    {competitionTeams
                      .filter((t) => !selected.includes(t.id))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* SECTION 3: Biggest Goal Difference Matches */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Target size={16} />
              <h4 className="font-bold text-sm uppercase tracking-wider">
                Maior Diferença de Gols (por Fase)
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              Selecione o jogo com maior diferença de gols em cada fase.
              Se definido, terá precedência sobre o cálculo automático.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["groups", "oitavas", "quartas", "semis"] as const).map((phase) => {
                const phaseMatchList = matchesByPhase[phase] || [];
                const selectedMatchId = biggestGoalDiffMatches[phase] || "";

                return (
                  <div
                    key={phase}
                    className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 space-y-2"
                  >
                    <h5 className="text-xs font-bold text-white uppercase">
                      {phaseLabels[phase]}
                    </h5>
                    <select
                      value={selectedMatchId}
                      onChange={(e) => {
                        setBiggestGoalDiffMatches((prev) => ({
                          ...prev,
                          [phase]: e.target.value,
                        }));
                      }}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:border-emerald-500 outline-none"
                    >
                      <option value="">— Não definido (calculado pela API) —</option>
                      {phaseMatchList.map((m) => {
                        const home = getTeamName(m.homeTeamId);
                        const away = getTeamName(m.awayTeamId);
                        const score =
                          m.resultHome != null && m.resultAway != null
                            ? ` (${m.resultHome}x${m.resultAway})`
                            : "";
                        return (
                          <option key={m.id} value={m.id}>
                            {home} vs {away}{score}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : saveSuccess ? (
                <>
                  <Check size={16} />
                  Salvo!
                </>
              ) : (
                <>
                  <Save size={16} />
                  Salvar Overrides
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSpecialsOverrides;
