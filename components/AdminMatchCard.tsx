import React, { useState, useEffect } from "react";
import { Match, MatchStatus } from "../types";
import { getMatchPhase, getMatchDuration } from "../utils/scoring";
import { useDatabase } from "../contexts/DatabaseContext";
import { Calendar, Clock, LockKeyhole, Save, Loader2, X } from "lucide-react";

interface Props {
  match: Match;
  onAdminSaveMatch: (matchId: string, status: "started" | "live" | "ended", home: number, away: number) => Promise<void> | void;
  onAdminToggleSyncLock?: (matchId: string, locked: boolean) => void;
}

const numOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
};

const AdminMatchCard: React.FC<Props> = ({ match, onAdminSaveMatch, onAdminToggleSyncLock }) => {
  const db = useDatabase();

  const isLive = match.status === MatchStatus.LIVE;
  const isFinished = match.status === MatchStatus.FINISHED;
  const isKnockout = getMatchPhase(match.stage, match.group) !== "groups";
  const showFlatCols = (isLive || isFinished) && isKnockout;

  const [resultHome, setResultHome] = useState(String(match.result?.home ?? ""));
  const [resultAway, setResultAway] = useState(String(match.result?.away ?? ""));
  const [adminStatus, setAdminStatus] = useState<"started" | "live" | "ended">(
    isFinished ? "ended" : isLive ? "live" : "started"
  );
  const [regularHome, setRegularHome] = useState(String(match.regularHome ?? ""));
  const [regularAway, setRegularAway] = useState(String(match.regularAway ?? ""));
  const [extraHome, setExtraHome] = useState(String(match.extraTimeHome ?? ""));
  const [extraAway, setExtraAway] = useState(String(match.extraTimeAway ?? ""));
  const [penHome, setPenHome] = useState(String(match.penaltiesHome ?? ""));
  const [penAway, setPenAway] = useState(String(match.penaltiesAway ?? ""));
  const [isSaving, setIsSaving] = useState(false);

  // Re-sync inputs when match prop updates (e.g. after API sync)
  useEffect(() => {
    setResultHome(String(match.result?.home ?? ""));
    setResultAway(String(match.result?.away ?? ""));
    setAdminStatus(isFinished ? "ended" : isLive ? "live" : "started");
    setRegularHome(String(match.regularHome ?? ""));
    setRegularAway(String(match.regularAway ?? ""));
    setExtraHome(String(match.extraTimeHome ?? ""));
    setExtraAway(String(match.extraTimeAway ?? ""));
    setPenHome(String(match.penaltiesHome ?? ""));
    setPenAway(String(match.penaltiesAway ?? ""));
  }, [match.id, match.status, match.result?.home, match.result?.away,
      match.regularHome, match.regularAway, match.extraTimeHome, match.extraTimeAway,
      match.penaltiesHome, match.penaltiesAway]);

  const hasET = extraHome !== "" || extraAway !== "";
  const hasPen = penHome !== "" || penAway !== "";

  // Auto-derive resultHome/Away from flat cols for knockout matches
  useEffect(() => {
    if (!showFlatCols || regularHome === "") return;
    const rH = parseInt(regularHome) || 0;
    const rA = parseInt(regularAway) || 0;
    const etH = hasET ? (parseInt(extraHome) || 0) : 0;
    const etA = hasET ? (parseInt(extraAway) || 0) : 0;
    setResultHome(String(rH + etH));
    setResultAway(String(rA + etA));
  }, [regularHome, regularAway, extraHome, extraAway, hasET, showFlatCols]);

  const derivedResultHome = (() => {
    if (!showFlatCols || regularHome === "") return numOrNull(resultHome);
    const rH = parseInt(regularHome) || 0;
    const etH = hasET ? (parseInt(extraHome) || 0) : 0;
    return rH + etH;
  })();
  const derivedResultAway = (() => {
    if (!showFlatCols || regularAway === "") return numOrNull(resultAway);
    const rA = parseInt(regularAway) || 0;
    const etA = hasET ? (parseInt(extraAway) || 0) : 0;
    return rA + etA;
  })();

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save flat cols + derived result for knockout matches
      if (showFlatCols) {
        await db.updateMatch(match.id, {
          regularHome: numOrNull(regularHome),
          regularAway: numOrNull(regularAway),
          extraTimeHome: hasET ? numOrNull(extraHome) : null,
          extraTimeAway: hasET ? numOrNull(extraAway) : null,
          penaltiesHome: hasPen ? numOrNull(penHome) : null,
          penaltiesAway: hasPen ? numOrNull(penAway) : null,
          resultHome: derivedResultHome,
          resultAway: derivedResultAway,
        } as any);
      }
      // Status + result save (triggers finishMatch/updateLiveScore + point recalc)
      const h = derivedResultHome ?? (numOrNull(resultHome) ?? 0);
      const a = derivedResultAway ?? (numOrNull(resultAway) ?? 0);
      await onAdminSaveMatch(match.id, adminStatus, h, a);
    } finally {
      setIsSaving(false);
    }
  };

  const matchDate = new Date(match.date);
  const duration = getMatchDuration(match);

  return (
    <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex justify-between items-center bg-slate-900/40 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Calendar size={12} className="text-brand-green" />
            {matchDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <Clock size={12} className="text-brand-green" />
            {matchDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-red/10 border border-brand-red/30">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
              <span className="text-[10px] font-black text-brand-red uppercase tracking-tighter">
                {match.minute ? `AO VIVO - ${match.minute}'` : "AO VIVO"}
              </span>
            </div>
          )}
          {isFinished && (
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-800 px-2.5 py-1 rounded-full">
              Encerrado
            </span>
          )}
          <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest bg-brand-blue/10 border border-brand-blue/30 px-2.5 py-1 rounded-full">
            ADMIN
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Teams + result inputs */}
        <div className="flex items-center justify-between gap-2">
          {/* Home team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="w-12 h-12 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden">
              <img src={match.homeTeam.flag} alt={match.homeTeam.name} className="w-9 h-9 object-contain" />
            </div>
            <span className="text-[10px] font-black text-center text-slate-200 uppercase tracking-tight leading-none">
              {match.homeTeam.name}
            </span>
          </div>

          {/* Score inputs */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={resultHome}
              onChange={(e) => setResultHome(e.target.value)}
              className="w-14 h-14 text-center font-black text-2xl rounded-2xl bg-slate-900 border border-slate-700 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="-"
            />
            <span className="text-slate-600 font-black text-xl">×</span>
            <input
              type="number"
              min={0}
              value={resultAway}
              onChange={(e) => setResultAway(e.target.value)}
              className="w-14 h-14 text-center font-black text-2xl rounded-2xl bg-slate-900 border border-slate-700 focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="-"
            />
          </div>

          {/* Away team */}
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="w-12 h-12 flex items-center justify-center bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden">
              <img src={match.awayTeam.flag} alt={match.awayTeam.name} className="w-9 h-9 object-contain" />
            </div>
            <span className="text-[10px] font-black text-center text-slate-200 uppercase tracking-tight leading-none">
              {match.awayTeam.name}
            </span>
          </div>
        </div>

        {/* Flat score section — knockout LIVE or FINISHED only */}
        {showFlatCols && (
          <div className="space-y-2 border-t border-slate-700/50 pt-4 animate-fadeIn">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
              Placar Mata-Mata
            </p>

            {/* Regular time */}
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Tempo Regular (90 min) · fonte R1
              </label>
              <div className="flex items-center gap-2 justify-center">
                <input type="number" min={0} value={regularHome} onChange={(e) => setRegularHome(e.target.value)}
                  className="w-14 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-brand-green outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0" />
                <span className="text-slate-500 font-bold">×</span>
                <input type="number" min={0} value={regularAway} onChange={(e) => setRegularAway(e.target.value)}
                  className="w-14 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-brand-green outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0" />
              </div>
            </div>

            {/* Extra time */}
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] font-black text-sky-400 uppercase tracking-widest">
                  Prorrogação (delta)
                </label>
                {hasET && (
                  <button onClick={() => { setExtraHome(""); setExtraAway(""); setPenHome(""); setPenAway(""); }}
                    className="text-[9px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                    <X size={10} /> Limpar
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 justify-center">
                <input type="number" min={0} value={extraHome} onChange={(e) => setExtraHome(e.target.value)}
                  className="w-14 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-sky-400 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="—" />
                <span className="text-slate-500 font-bold">×</span>
                <input type="number" min={0} value={extraAway} onChange={(e) => setExtraAway(e.target.value)}
                  className="w-14 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-sky-400 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="—" />
              </div>
            </div>

            {/* Penalties */}
            <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[9px] font-black text-amber-400 uppercase tracking-widest">
                  Pênaltis
                </label>
                {hasPen && (
                  <button onClick={() => { setPenHome(""); setPenAway(""); }}
                    className="text-[9px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1">
                    <X size={10} /> Limpar
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 justify-center">
                <input type="number" min={0} value={penHome} onChange={(e) => setPenHome(e.target.value)}
                  className="w-14 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-amber-500 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="—" />
                <span className="text-slate-500 font-bold">×</span>
                <input type="number" min={0} value={penAway} onChange={(e) => setPenAway(e.target.value)}
                  className="w-14 h-10 text-center font-black text-lg rounded-lg bg-slate-800 border border-slate-600 focus:border-amber-500 outline-none text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="—" />
              </div>
            </div>

            {/* Derived result preview */}
            {regularHome !== "" && (
              <div className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl bg-slate-700/30 border border-slate-600/40 text-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Resultado Final (R2)
                </span>
                <span className="text-base font-black text-white">
                  {derivedResultHome} × {derivedResultAway}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  duration === "PENALTY_SHOOTOUT" ? "bg-amber-500/15 text-amber-400" :
                  duration === "EXTRA_TIME" ? "bg-sky-500/15 text-sky-400" :
                  "bg-slate-700 text-slate-400"
                }`}>
                  {duration === "PENALTY_SHOOTOUT" ? "Pênaltis" : duration === "EXTRA_TIME" ? "Prorrogação" : "Tempo Regular"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Status + save + sync lock */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-700/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 shrink-0">Status</label>
              <select
                value={adminStatus}
                onChange={(e) => setAdminStatus(e.target.value as "started" | "live" | "ended")}
                className="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-2xl border border-slate-700 focus:outline-none min-w-0 flex-1"
              >
                <option value="started">SCHEDULED</option>
                <option value="live">LIVE</option>
                <option value="ended">FINISHED</option>
              </select>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="shrink-0 flex items-center gap-1.5 bg-brand-blue text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar Edição
            </button>
          </div>
          <button
            onClick={() => onAdminToggleSyncLock?.(match.id, !match.syncLocked)}
            className={`flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              match.syncLocked
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                : "bg-slate-900/50 border-slate-700/50 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            }`}
          >
            <LockKeyhole size={12} />
            {match.syncLocked ? "Sync Bloqueado (Clique para Desbloquear)" : "Bloquear Sync deste Jogo"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminMatchCard;
