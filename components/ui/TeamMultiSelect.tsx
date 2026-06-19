import React, { useState, useRef, useMemo, useEffect } from "react";
import { X } from "lucide-react";
import { TeamDB } from "../../types";

interface TeamMultiSelectProps {
  teams: TeamDB[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  color?: "emerald" | "rose" | "amber" | "indigo";
}

const colorClasses: Record<string, { chip: string; button: string; focus: string }> = {
  emerald: {
    chip: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    button: "text-emerald-500 hover:text-rose-400",
    focus: "focus:border-emerald-500",
  },
  rose: {
    chip: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    button: "text-rose-500 hover:text-rose-400",
    focus: "focus:border-rose-500",
  },
  amber: {
    chip: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    button: "text-amber-500 hover:text-rose-400",
    focus: "focus:border-amber-500",
  },
  indigo: {
    chip: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
    button: "text-indigo-500 hover:text-rose-400",
    focus: "focus:border-indigo-500",
  },
};

const TeamMultiSelect: React.FC<TeamMultiSelectProps> = ({
  teams,
  selectedIds,
  onChange,
  placeholder = "Selecione...",
  color = "emerald",
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const colors = colorClasses[color] || colorClasses.emerald;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (normalizedQuery.length < 1) return [];
    return teams.filter((t) => {
      if (selectedIds.includes(t.id)) return false;
      return (
        t.name.toLowerCase().includes(normalizedQuery) ||
        t.code?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [teams, selectedIds, normalizedQuery]);

  const selectedTeams = useMemo(
    () => teams.filter((t) => selectedIds.includes(t.id)),
    [teams, selectedIds]
  );

  const addTeam = (teamId: string) => {
    if (!selectedIds.includes(teamId)) {
      onChange([...selectedIds, teamId]);
    }
    setQuery("");
    setIsOpen(false);
  };

  const removeTeam = (teamId: string) => {
    onChange(selectedIds.filter((id) => id !== teamId));
  };

  return (
    <div className="relative" ref={containerRef}>
      {selectedTeams.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTeams.map((team) => (
            <span
              key={team.id}
              className={`inline-flex items-center gap-1 border text-xs px-2 py-1 rounded-full ${colors.chip}`}
            >
              {team.flag && (
                <img src={team.flag} alt="" className="w-3 h-2 object-cover rounded-sm" />
              )}
              {team.name}
              <button
                type="button"
                onClick={() => removeTeam(team.id)}
                className={`ml-0.5 ${colors.button}`}
                aria-label="Remover seleção"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 outline-none ${colors.focus}`}
        />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
          {normalizedQuery.length < 1 ? (
            <div className="px-3 py-2 text-xs text-slate-500">Digite para buscar seleções</div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Nenhuma seleção encontrada</div>
          ) : (
            suggestions.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => addTeam(team.id)}
                className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-700 flex items-center gap-2 transition-colors border-b border-slate-700/50 last:border-0"
              >
                {team.flag && (
                  <img src={team.flag} alt="" className="w-4 h-3 object-cover rounded-sm" />
                )}
                <span className="font-semibold">{team.name}</span>
                {team.code && <span className="text-slate-500">({team.code})</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TeamMultiSelect;
