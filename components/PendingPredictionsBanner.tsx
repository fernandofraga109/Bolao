import React, { useMemo, useState, useEffect } from "react";
import { Match, MatchStatus } from "../types";
import { getMatchPhase } from "../utils/scoring";
import { AlertTriangle, Clock, Hourglass } from "lucide-react";

interface PendingPredictionsBannerProps {
  matches: Match[];
  predictions: Record<string, { home: number; away: number }>;
  ruleset?: "regulamento_1" | "regulamento_2";
  phaseLockSet?: Set<string>;
  isAdmin?: boolean;
}

const PHASE_ORDER = ["groups", "ko", "third_place", "final"];
const PHASE_LABELS: Record<string, string> = {
  groups: "Fase de Grupos",
  ko: "Mata-Mata",
  third_place: "Disputa de 3º Lugar",
  final: "Final",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "bloqueio iminente";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h restantes`;
  if (hours > 0) return `${hours}h ${mins}min restantes`;
  return `${mins}min restantes`;
}

const PendingPredictionsBanner: React.FC<PendingPredictionsBannerProps> = ({
  matches,
  predictions,
  ruleset = "regulamento_1",
  phaseLockSet = new Set(),
  isAdmin = false,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const banner = useMemo(() => {
    if (isAdmin) return null;

    const schedulable = matches.filter(
      (m) => m.status === MatchStatus.SCHEDULED
    );

    if (ruleset === "regulamento_1") {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayMatches = schedulable.filter((m) => {
        const mDate = new Date(m.date).toISOString().slice(0, 10);
        return mDate === todayStr;
      });
      const pending = todayMatches.filter((m) => !predictions[m.id]);
      if (pending.length === 0) return null;

      return {
        text: `Hoje tem ${todayMatches.length} jogo${todayMatches.length > 1 ? "s" : ""} — você ainda não palpitou em ${pending.length}`,
        urgent: pending.length === todayMatches.length,
      };
    }

    // Regulamento 2
    const byPhase: Record<string, Match[]> = {};
    schedulable.forEach((m) => {
      const phase = getMatchPhase(m.stage, m.group);
      if (!byPhase[phase]) byPhase[phase] = [];
      byPhase[phase].push(m);
    });

    const currentPhase = PHASE_ORDER.find((p) => byPhase[p] && !phaseLockSet.has(p));

    if (currentPhase && byPhase[currentPhase]) {
      const pending = byPhase[currentPhase].filter((m) => !predictions[m.id]);
      if (pending.length > 0) {
        const firstMatch = byPhase[currentPhase].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )[0];
        const timeLeft = new Date(firstMatch.date).getTime() - now;
        return {
          text: `Faltam ${pending.length} palpite${pending.length > 1 ? "s" : ""} na ${PHASE_LABELS[currentPhase]}`,
          sub: `Bloqueio em ${formatCountdown(timeLeft)}`,
          urgent: pending.length >= byPhase[currentPhase].length * 0.5,
        };
      }
    }

    const lockedPhase = PHASE_ORDER.find((p) => phaseLockSet.has(p) && byPhase[p]);
    if (lockedPhase && byPhase[lockedPhase]) {
      const pending = byPhase[lockedPhase].filter((m) => !predictions[m.id]);
      if (pending.length > 0) {
        return {
          text: `${PHASE_LABELS[lockedPhase]} bloqueada — você deixou ${pending.length} palpite${pending.length > 1 ? "s" : ""} em branco`,
          urgent: true,
          alert: true,
        };
      }
    }

    return null;
  }, [matches, predictions, ruleset, phaseLockSet, isAdmin, now]);

  if (!banner) return null;

  const accent = banner.alert
    ? { border: "border-l-red-500", bg: "bg-red-900/40", text: "text-red-200", iconBg: "bg-red-500/30", iconText: "text-red-300", subBg: "bg-red-500/20", subText: "text-red-300" }
    : banner.urgent
    ? { border: "border-l-amber-500", bg: "bg-amber-900/40", text: "text-amber-100", iconBg: "bg-amber-500/30", iconText: "text-amber-300", subBg: "bg-amber-500/20", subText: "text-amber-300" }
    : { border: "border-l-indigo-500", bg: "bg-indigo-900/40", text: "text-indigo-100", iconBg: "bg-indigo-500/30", iconText: "text-indigo-300", subBg: "bg-indigo-500/20", subText: "text-indigo-300" };

  return (
    <div
      className={`mt-3 rounded-2xl border border-slate-700/50 ${accent.border} border-l-4 ${accent.bg} px-5 py-4 flex items-center gap-4 animate-fadeIn shadow-lg`}
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-full ${accent.iconBg} ${accent.iconText} flex items-center justify-center animate-pulse`}
      >
        {banner.alert ? <AlertTriangle size={20} /> : <Clock size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-[10px] font-black uppercase tracking-widest ${accent.subText}`}>
          {banner.alert ? "Atenção" : "Palpites Pendentes"}
        </span>
        <p className={`text-sm font-bold leading-snug mt-0.5 ${accent.text}`}>
          {banner.text}
        </p>
        {banner.sub && (
          <span className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${accent.subBg} ${accent.subText}`}>
            <Hourglass size={10} />
            {banner.sub}
          </span>
        )}
      </div>
    </div>
  );
};

export default PendingPredictionsBanner;
