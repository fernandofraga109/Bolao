import React, { useState, useEffect } from "react";
import { Match, MatchStatus } from "../types";
import { getMatchDuration, getMatchPhase } from "../utils/scoring";
import { useDatabase } from "../contexts/DatabaseContext";
import ModalShell from "./ui/ModalShell";
import { Save, X, Loader2, Trophy, Clock, ShieldAlert } from "lucide-react";

interface Props {
  match: Match;
  onClose: () => void;
}

const numOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
};

const AdminKnockoutScoreModal: React.FC<Props> = ({ match, onClose }) => {
  const db = useDatabase();

  const [regularHome, setRegularHome] = useState(String(match.regularHome ?? match.result?.home ?? ""));
  const [regularAway, setRegularAway] = useState(String(match.regularAway ?? match.result?.away ?? ""));
  const [extraHome, setExtraHome] = useState(String(match.extraTimeHome ?? ""));
  const [extraAway, setExtraAway] = useState(String(match.extraTimeAway ?? ""));
  const [penHome, setPenHome] = useState(String(match.penaltiesHome ?? ""));
  const [penAway, setPenAway] = useState(String(match.penaltiesAway ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasET = extraHome !== "" || extraAway !== "";
  const hasPen = penHome !== "" || penAway !== "";

  const handleSave = async () => {
    const rH = numOrNull(regularHome);
    const rA = numOrNull(regularAway);
    if (rH === null || rA === null) {
      setError("Tempo regular é obrigatório.");
      return;
    }

    const payload: Record<string, number | null> = {
      regularHome: rH,
      regularAway: rA,
      extraTimeHome: hasET ? numOrNull(extraHome) : null,
      extraTimeAway: hasET ? numOrNull(extraAway) : null,
      penaltiesHome: hasPen ? numOrNull(penHome) : null,
      penaltiesAway: hasPen ? numOrNull(penAway) : null,
    };

    try {
      setError(null);
      setSaving(true);
      await db.updateMatch(match.id, payload as any);
      await db.refetchMatches();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const clearET = () => { setExtraHome(""); setExtraAway(""); setPenHome(""); setPenAway(""); };
  const clearPen = () => { setPenHome(""); setPenAway(""); };

  const duration = getMatchDuration(match);

  return (
    <ModalShell
      title={
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          <span>Editar Placar Mata-Mata</span>
        </div>
      }
      onClose={onClose}
      maxWidthClassName="max-w-sm"
    >
      {/* Match header */}
      <div className="flex items-center justify-center gap-3 mb-5 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          {match.homeTeam?.flag && (
            <img src={match.homeTeam.flag} alt={match.homeTeam.name} className="w-6 h-6 object-contain" />
          )}
          <span className="text-sm font-black text-white uppercase">{match.homeTeam?.name}</span>
        </div>
        <span className="text-slate-500 font-bold">×</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-white uppercase">{match.awayTeam?.name}</span>
          {match.awayTeam?.flag && (
            <img src={match.awayTeam.flag} alt={match.awayTeam.name} className="w-6 h-6 object-contain" />
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Regular time */}
        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock size={11} />
            Tempo Regular (90 min)
          </label>
          <div className="flex items-center gap-2 justify-center">
            <input
              type="number"
              min={0}
              value={regularHome}
              onChange={(e) => setRegularHome(e.target.value)}
              className="w-16 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-brand-green outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0"
            />
            <span className="text-slate-500 font-bold">×</span>
            <input
              type="number"
              min={0}
              value={regularAway}
              onChange={(e) => setRegularAway(e.target.value)}
              className="w-16 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-brand-green outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0"
            />
          </div>
          <p className="text-[9px] text-slate-500 text-center mt-1.5">Fonte do R1 — obrigatório</p>
        </div>

        {/* Extra time */}
        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={11} />
              Prorrogação
            </label>
            {hasET && (
              <button onClick={clearET} className="text-[9px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                <X size={10} /> Limpar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 justify-center">
            <input
              type="number"
              min={0}
              value={extraHome}
              onChange={(e) => setExtraHome(e.target.value)}
              className="w-16 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-sky-400 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="—"
            />
            <span className="text-slate-500 font-bold">×</span>
            <input
              type="number"
              min={0}
              value={extraAway}
              onChange={(e) => setExtraAway(e.target.value)}
              className="w-16 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-sky-400 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="—"
            />
          </div>
          <p className="text-[9px] text-slate-500 text-center mt-1.5">Gols marcados apenas na prorrogação (não cumulativo)</p>
        </div>

        {/* Penalties */}
        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldAlert size={11} />
              Pênaltis
            </label>
            {hasPen && (
              <button onClick={clearPen} className="text-[9px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                <X size={10} /> Limpar
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 justify-center">
            <input
              type="number"
              min={0}
              value={penHome}
              onChange={(e) => setPenHome(e.target.value)}
              className="w-16 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-amber-500 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="—"
            />
            <span className="text-slate-500 font-bold">×</span>
            <input
              type="number"
              min={0}
              value={penAway}
              onChange={(e) => setPenAway(e.target.value)}
              className="w-16 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-amber-500 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="—"
            />
          </div>
          <p className="text-[9px] text-slate-500 text-center mt-1.5">Preencher pênaltis implica prorrogação</p>
        </div>

        {/* Inferred duration preview */}
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
          <span>Duração atual detectada:</span>
          <span className={`font-black px-2 py-0.5 rounded-full ${
            duration === 'PENALTY_SHOOTOUT' ? 'bg-amber-500/15 text-amber-400' :
            duration === 'EXTRA_TIME' ? 'bg-sky-500/15 text-sky-400' :
            'bg-slate-700 text-slate-400'
          }`}>
            {duration === 'PENALTY_SHOOTOUT' ? 'Pênaltis' : duration === 'EXTRA_TIME' ? 'Prorrogação' : 'Tempo Regular'}
          </span>
        </div>

        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] text-red-400 font-bold text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-brand-green text-brand-dark py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-brand-green/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </ModalShell>
  );
};

export default AdminKnockoutScoreModal;
