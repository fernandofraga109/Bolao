import React, { useMemo, useState, useEffect } from "react";
import { Match, MatchStatus, TournamentPredictions, ExtraPhasePredictionDB } from "../types";
import { getMatchPhase } from "../utils/scoring";
import { AlertTriangle, Clock, Hourglass, Sparkles } from "lucide-react";

interface PendingPredictionsBannerProps {
  matches: Match[];
  predictions: Record<string, { home: number; away: number }>;
  ruleset?: "regulamento_1" | "regulamento_2";
  phaseLockSet?: Set<string>;
  isAdmin?: boolean;
  tournamentPredictions?: TournamentPredictions;
  extraPhasePredictions?: ExtraPhasePredictionDB[];
  lockDate?: string | null;
  groupId?: string;
  userId?: string;
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

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function getFirstMatchDate(matches: Match[], predicate: (m: Match) => boolean): number | null {
  const filtered = matches.filter(predicate);
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return new Date(sorted[0].date).getTime();
}

function getPhaseStartMs(matches: Match[], phase: string): number | null {
  switch (phase) {
    case "groups":
      return getFirstMatchDate(
        matches,
        (m) => m.stage === "REGULAR_SEASON" || (!!m.group && !/^(LAST_|ROUND_OF_|QUARTER|SEMI|FINAL|THIRD)/i.test(m.group))
      );
    case "oitavas":
      return getFirstMatchDate(
        matches,
        (m) => /ROUND_OF_16|LAST_16/i.test(m.stage || "") || /OITAVAS/i.test(m.group || "")
      );
    case "quartas":
      return getFirstMatchDate(
        matches,
        (m) => /QUARTER/i.test(m.stage || "") || /QUARTAS/i.test(m.group || "")
      );
    case "semis":
      return getFirstMatchDate(
        matches,
        (m) => /SEMI/i.test(m.stage || "") || /SEMIS/i.test(m.group || "")
      );
    default:
      return null;
  }
}

function isWithinAlertWindow(phaseStartMs: number | null, now: number): boolean {
  if (!phaseStartMs) return false;
  return now >= phaseStartMs - FIVE_DAYS_MS && now < phaseStartMs;
}

const PendingPredictionsBanner: React.FC<PendingPredictionsBannerProps> = ({
  matches,
  predictions,
  ruleset = "regulamento_1",
  phaseLockSet = new Set(),
  isAdmin = false,
  tournamentPredictions,
  extraPhasePredictions = [],
  lockDate,
  groupId,
  userId,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const { banner, missedSpecials, missedLabels } = useMemo(() => {
    if (isAdmin) return { banner: null, missedSpecials: 0, missedLabels: [] as string[] };

    const schedulable = matches.filter(
      (m) => m.status === MatchStatus.SCHEDULED
    );

    let bannerResult: { text: string; sub?: string; urgent: boolean; alert?: boolean } | null = null;

    if (ruleset === "regulamento_1") {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayMatches = schedulable.filter((m) => {
        const mDate = new Date(m.date).toISOString().slice(0, 10);
        return mDate === todayStr;
      });
      const pending = todayMatches.filter((m) => !predictions[m.id]);
      if (pending.length > 0) {
        bannerResult = {
          text: `Hoje tem ${todayMatches.length} jogo${todayMatches.length > 1 ? "s" : ""} — você ainda não palpitou em ${pending.length}`,
          urgent: true,
        };
      }
    } else {
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
          bannerResult = {
            text: `Faltam ${pending.length} palpite${pending.length > 1 ? "s" : ""} na ${PHASE_LABELS[currentPhase]}`,
            sub: `Bloqueio em ${formatCountdown(timeLeft)}`,
            urgent: pending.length >= byPhase[currentPhase].length * 0.5,
          };
        }
      }

      if (!bannerResult) {
        const lockedPhase = PHASE_ORDER.find((p) => phaseLockSet.has(p) && byPhase[p]);
        if (lockedPhase && byPhase[lockedPhase]) {
          const pending = byPhase[lockedPhase].filter((m) => !predictions[m.id]);
          if (pending.length > 0) {
            bannerResult = {
              text: `${PHASE_LABELS[lockedPhase]} bloqueada — você deixou ${pending.length} palpite${pending.length > 1 ? "s" : ""} em branco`,
              urgent: true,
              alert: true,
            };
          }
        }
      }
    }

    // Collect missed special labels
    const labels: string[] = [];
    const isSpecialsOpen = lockDate ? new Date(lockDate) > new Date() : true;
    if (isSpecialsOpen && ruleset) {
      const tp = tournamentPredictions || {};
      const ep = extraPhasePredictions.filter((p) => p.userId === userId && p.groupId === groupId);

      if (ruleset === "regulamento_1") {
        if (!tp.championTeamId) labels.push("Campeão");
        if (!tp.topScorerPlayerId) labels.push("Artilheiro (nome)");
        if (!tp.topScorer?.goals) labels.push("Artilheiro (gols)");
        if (!tp.bestPlayerId) labels.push("Melhor Jogador");
        if (!tp.bestGoalkeeperId) labels.push("Melhor Goleiro");
      } else {
        // R2 — Pré-Copa (artilheiro só tem nome, não gols)
        if (!tp.championTeamId) labels.push("Campeão");
        if (!tp.topScorerPlayerId) labels.push("Artilheiro");
        if (!tp.mostGoalsTeamId) labels.push("Maior Goleadora");
        if (!tp.mostConcededTeamId) labels.push("Maior Sofredora");

        // Group classifications (pré-Copa)
        const gc = tp.groupClassifications || {};
        const groupNames = Object.keys(gc).filter((k) => !["Oitavas", "Quartas", "Semis"].includes(k));
        groupNames.forEach((g) => {
          const arr = gc[g];
          if (!arr || arr.length < 2 || !arr[0] || !arr[1]) labels.push(`Classificação ${g}`);
        });

        // Knockout classifications — só na janela de 5 dias
        const oitavasStart = getPhaseStartMs(matches, "oitavas");
        const quartasStart = getPhaseStartMs(matches, "quartas");
        const semisStart = getPhaseStartMs(matches, "semis");

        if (isWithinAlertWindow(oitavasStart, now)) {
          const oitavas = gc["Oitavas"] || [];
          if (oitavas.length < 16) labels.push("Classificados Oitavas");
        }
        if (isWithinAlertWindow(quartasStart, now)) {
          const quartas = gc["Quartas"] || [];
          if (quartas.length < 8) labels.push("Classificados Quartas");
        }
        if (isWithinAlertWindow(semisStart, now)) {
          const semis = gc["Semis"] || [];
          if (semis.length < 4) labels.push("Classificados Semis");
        }

        // Extra phase predictions — só na janela de 5 dias
        const extraPhaseLabels: Record<string, string> = {
          groups: "Maior Diferença — Fase de Grupos",
          oitavas: "Maior Diferença — Oitavas",
          quartas: "Maior Diferença — Quartas",
          semis: "Maior Diferença — Semis",
        };
        const extraPhases: string[] = ["groups", "oitavas", "quartas", "semis"];
        extraPhases.forEach((phase) => {
          const phaseStart = getPhaseStartMs(matches, phase);
          if (isWithinAlertWindow(phaseStart, now)) {
            const hasPred = ep.some((p) => p.phase === phase && p.matchId);
            if (!hasPred) labels.push(extraPhaseLabels[phase]);
          }
        });
      }
    }

    return { banner: bannerResult, missedSpecials: labels.length, missedLabels: labels };
  }, [matches, predictions, ruleset, phaseLockSet, isAdmin, now, tournamentPredictions, extraPhasePredictions, lockDate, groupId, userId]);

  if (!banner && missedLabels.length === 0) return null;

  const accent = banner?.alert
    ? { border: "border-l-red-500", bg: "bg-red-900/40", text: "text-red-200", iconBg: "bg-red-500/30", iconText: "text-red-300", subBg: "bg-red-500/20", subText: "text-red-300" }
    : banner?.urgent || ruleset === "regulamento_1"
    ? { border: "border-l-amber-500", bg: "bg-amber-900/40", text: "text-amber-100", iconBg: "bg-amber-500/30", iconText: "text-amber-300", subBg: "bg-amber-500/20", subText: "text-amber-300" }
    : { border: "border-l-indigo-500", bg: "bg-indigo-900/40", text: "text-indigo-100", iconBg: "bg-indigo-500/30", iconText: "text-indigo-300", subBg: "bg-indigo-500/20", subText: "text-indigo-300" };

  return (
    <div
      className={`mt-3 rounded-2xl border border-slate-700/50 ${accent.border} border-l-4 ${accent.bg} px-5 py-4 flex items-start gap-4 animate-fadeIn shadow-lg`}
    >
      <div
        className={`shrink-0 w-10 h-10 rounded-full ${accent.iconBg} ${accent.iconText} flex items-center justify-center animate-pulse mt-0.5`}
      >
        {banner?.alert ? <AlertTriangle size={20} /> : <Clock size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        {banner && (
          <>
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
          </>
        )}
        {missedLabels.length > 0 && (
          <div className={`mt-2 ${banner ? "pt-2 border-t border-slate-600/30" : ""}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles size={14} className={accent.iconText} />
              <span className={`text-xs font-bold ${accent.subText}`}>
                + {missedLabels.length} palpite{missedLabels.length > 1 ? "s" : ""} especial{missedLabels.length > 1 ? "is" : ""} pendente{missedLabels.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missedLabels.map((label) => (
                <span
                  key={label}
                  className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${accent.subBg} ${accent.subText} border-slate-600/40`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingPredictionsBanner;
