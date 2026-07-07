import React, { useMemo, useState, useEffect } from "react";
import { Match, MatchStatus, TournamentPredictions, ExtraPhasePredictionDB } from "../types";
import { getPhaseLockKey, getKnockoutClassifiesPhase } from "../utils/scoring";
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Hourglass, Sparkles } from "lucide-react";

interface PendingPredictionsBannerProps {
  matches: Match[];
  predictions: Record<string, { home: number; away: number; whoClassifiesTeamId?: string | null }>;
  ruleset?: "regulamento_1" | "regulamento_2";
  phaseLockSet?: Set<string>;
  isAdmin?: boolean;
  tournamentPredictions?: TournamentPredictions;
  extraPhasePredictions?: ExtraPhasePredictionDB[];
  lockDate?: string | null;
  groupId?: string;
  userId?: string;
}

const PHASE_ORDER = ["groups", "round_of_32", "oitavas", "quartas", "semis", "third_place", "final"];
const PHASE_LABELS: Record<string, string> = {
  groups: "Fase de Grupos",
  round_of_32: "16 Avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semis: "Semifinais",
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
  tournamentPredictions,
  extraPhasePredictions = [],
  lockDate,
  groupId,
  userId,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const { banner, missedLabels, pendingMatches, extendedDeadlineMatches } = useMemo(() => {
    if (isAdmin) return { banner: null, missedLabels: [] as string[], pendingMatches: [] as Match[], extendedDeadlineMatches: [] as Match[] };

    const schedulable = matches.filter(
      (m) => m.status === MatchStatus.SCHEDULED
    );

    // Regulamento 2: fases de mata-mata só entram no banner a partir de 24h antes
    // do primeiro jogo da fase (evita alertar sobre jogos ainda TBD). A fase de
    // grupos nunca é bloqueada por esta janela.
    const WINDOW_MS = 24 * 60 * 60 * 1000;
    const isKoPhaseGated = (phaseKey: string): boolean => {
      if (phaseKey === "groups") return false;
      const phaseMatches = schedulable.filter(
        (m) => getPhaseLockKey(m.stage, m.group) === phaseKey
      );
      if (phaseMatches.length === 0) return true;
      const earliest = Math.min(...phaseMatches.map((m) => new Date(m.date).getTime()));
      return earliest - now > WINDOW_MS;
    };

    let bannerResult: { text: string; sub?: string; urgent: boolean; alert?: boolean } | null = null;
    let pendingMatchesList: Match[] = [];
    let currentPhase: string | null = null;

    const byPhase: Record<string, Match[]> = {};
    schedulable.forEach((m) => {
      const phase = getPhaseLockKey(m.stage, m.group);
      if (!byPhase[phase]) byPhase[phase] = [];
      byPhase[phase].push(m);
    });

    const next24hMatches = schedulable.filter((m) => {
      const matchTime = new Date(m.date).getTime();
      return matchTime >= now && matchTime <= now + WINDOW_MS;
    });

    if (ruleset === "regulamento_1") {
      const pending = next24hMatches.filter((m) => !predictions[m.id]);
      if (pending.length > 0) {
        pendingMatchesList = pending;
        bannerResult = {
          text: `Tem ${pending.length} jogo${pending.length > 1 ? "s" : ""} nas próximas 24h que você não palpitou`,
          urgent: true,
        };
      }
    } else {
      // Regulamento 2

      // Jogos de mata-mata nas próximas 24h: aviso jogo-a-jogo (como R1)
      const koPendingNext24h = next24hMatches
        .filter((m) => getPhaseLockKey(m.stage, m.group) !== "groups")
        .filter((m) => !predictions[m.id]);
      if (koPendingNext24h.length > 0) {
        pendingMatchesList = koPendingNext24h;
        bannerResult = {
          text: `Tem ${koPendingNext24h.length} jogo${koPendingNext24h.length > 1 ? "s" : ""} de mata-mata nas próximas 24h que você não palpitou`,
          urgent: true,
        };
      }

      // Fase de grupos: mantém aviso por fase
      if (!bannerResult && byPhase["groups"] && !phaseLockSet.has("groups")) {
        const pending = byPhase["groups"].filter((m) => !predictions[m.id]);
        pendingMatchesList = pending;
        if (pending.length > 0) {
          const firstMatchOfPhase = byPhase["groups"].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          )[0];
          const timeLeft = new Date(firstMatchOfPhase.date).getTime() - now;
          bannerResult = {
            text: `Faltam ${pending.length} palpite${pending.length > 1 ? "s" : ""} na Fase de Grupos`,
            sub: `Bloqueio em ${formatCountdown(timeLeft)}`,
            urgent: true,
          };
        }
      }

      // Fase KO "ativa" para avisos de fase (classificados, maior diferença, desempates)
      // Fase ainda a mais de 24h: não alerta nada dela até faltarem 24h para o primeiro jogo.
      currentPhase = PHASE_ORDER.find((p) => byPhase[p] && p !== "groups" && !isKoPhaseGated(p)) || null;

      // Fase de grupos bloqueada: alerta retrospectivo (única fase que ainda trava por fase)
      if (!bannerResult && phaseLockSet.has("groups") && byPhase["groups"]) {
        const pending = byPhase["groups"].filter((m) => !predictions[m.id]);
        pendingMatchesList = pending;
        if (pending.length > 0) {
          bannerResult = {
            text: `Fase de Grupos bloqueada — você deixou ${pending.length} palpite${pending.length > 1 ? "s" : ""} em branco`,
            urgent: true,
            alert: true,
          };
        }
      }
    }

    // Collect missed special labels
    const labels: string[] = [];
    const tp = tournamentPredictions || {};
    const ep = extraPhasePredictions.filter((p) => p.userId === userId && p.groupId === groupId);
    const isSpecialsOpen = lockDate ? new Date(lockDate) > new Date() : true;

    if (ruleset === "regulamento_1" && isSpecialsOpen) {
      if (!tp.championTeamId) labels.push("Campeão");
      if (!tp.topScorerPlayerId) labels.push("Artilheiro (nome)");
      if (!tp.topScorer?.goals) labels.push("Artilheiro (gols)");
      if (!tp.bestPlayerId) labels.push("Melhor Jogador");
      if (!tp.bestGoalkeeperId) labels.push("Melhor Goleiro");
    }

    if (ruleset === "regulamento_2") {
      // R2 — Pré-Copa (artilheiro só tem nome, não gols)
      if (isSpecialsOpen) {
        if (!tp.championTeamId) labels.push("Campeão");
        if (!tp.topScorerPlayerId) labels.push("Artilheiro");
        if (!tp.mostGoalsTeamId) labels.push("Maior Goleadora");
        if (!tp.mostConcededTeamId) labels.push("Maior Sofredora");

        // Group classifications (pré-Copa) - 12 grupos, cada um com 2 seleções (total 24 seleções)
        const gc = tp.groupClassifications || {};
        const expectedGroups = ["Grupo A", "Grupo B", "Grupo C", "Grupo D", "Grupo E", "Grupo F", "Grupo G", "Grupo H", "Grupo I", "Grupo J", "Grupo K", "Grupo L"];
        const totalSelections = expectedGroups.reduce((count, g) => {
          const arr = gc[g];
          if (!arr) return count;
          return count + (arr[0] ? 1 : 0) + (arr[1] ? 1 : 0);
        }, 0);
        if (totalSelections < 24) {
          labels.push(`Classificados por Grupos (${totalSelections}/24)`);
        }
      }

      // Classificados de mata-mata não geram aviso: são preenchidos automaticamente
      // quando o usuário palpita os jogos daquela fase.

      // Knockout draws without tiebreaker — palpites de empate em Oitavas/Quartas sem whoClassifiesTeamId
      const knockoutDrawPhaseLabels: Record<string, string> = {
        oitavas: "Oitavas de Final",
        quartas: "Quartas de Final",
      };
      matches.forEach((m) => {
        const phaseKey = getPhaseLockKey(m.stage, m.group);
        if (!knockoutDrawPhaseLabels[phaseKey]) return;
        if (phaseLockSet.has(phaseKey)) return;
        if (m.status !== MatchStatus.SCHEDULED) return;
        if (isKoPhaseGated(phaseKey)) return;
        const classifiesPhase = getKnockoutClassifiesPhase(m.stage, m.group);
        if (!classifiesPhase) return;
        const pred = predictions[m.id];
        if (!pred) return;
        if (pred.home === pred.away && !pred.whoClassifiesTeamId) {
          const homeName = m.homeTeam?.name ?? "Time A";
          const awayName = m.awayTeam?.name ?? "Time B";
          labels.push(`Desempate pendente — ${homeName} vs ${awayName} (${knockoutDrawPhaseLabels[phaseKey]})`);
        }
      });

      // Extra phase predictions — só para a fase que está prestes a começar
      const extraPhaseLabels: Record<string, string> = {
        groups: "Maior Diferença — Fase de Grupos",
        round_of_32: "Maior Diferença — 16 Avos",
        oitavas: "Maior Diferença — Oitavas",
        quartas: "Maior Diferença — Quartas",
        semis: "Maior Diferença — Semis",
      };
      if (currentPhase && extraPhaseLabels[currentPhase]) {
        const hasPred = ep.some((p) => p.phase === currentPhase && p.matchId);
        if (!hasPred) labels.push(extraPhaseLabels[currentPhase]);
      }
    }

    return { banner: bannerResult, missedLabels: labels, pendingMatches: pendingMatchesList };
  }, [matches, predictions, ruleset, phaseLockSet, isAdmin, now, tournamentPredictions, extraPhasePredictions, lockDate, groupId, userId]);

  if (!banner && missedLabels.length === 0) return null;

  const accent = banner?.alert
    ? { border: "border-l-red-500", bg: "bg-red-900/40", text: "text-red-200", iconBg: "bg-red-500/30", iconText: "text-red-300", subBg: "bg-red-500/20", subText: "text-red-300" }
    : banner?.urgent || ruleset === "regulamento_1" || ruleset === "regulamento_2"
    ? { border: "border-l-amber-500", bg: "bg-amber-900/40", text: "text-amber-100", iconBg: "bg-amber-500/30", iconText: "text-amber-300", subBg: "bg-amber-500/20", subText: "text-amber-300" }
    : { border: "border-l-indigo-500", bg: "bg-indigo-900/40", text: "text-indigo-100", iconBg: "bg-indigo-500/30", iconText: "text-indigo-300", subBg: "bg-indigo-500/20", subText: "text-indigo-300" };

  return (
    <div
      className={`mt-3 rounded-2xl border border-slate-700/50 ${accent.border} border-l-4 ${accent.bg} animate-fadeIn shadow-lg overflow-hidden`}
    >
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full px-5 py-3 flex items-center gap-3 focus:outline-none`}
      >
        <div
          className={`shrink-0 w-8 h-8 rounded-full ${accent.iconBg} ${accent.iconText} flex items-center justify-center ${isOpen ? "animate-pulse" : ""}`}
        >
          {banner?.alert ? <AlertTriangle size={16} /> : <Clock size={16} />}
        </div>
        <span className={`flex-1 text-left text-[10px] font-black uppercase tracking-widest ${accent.subText}`}>
          {banner?.alert ? "Atenção" : "Palpites Pendentes"}
        </span>
        <span className={`${accent.iconText}`}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 flex items-start gap-4">
          <div className="w-8 shrink-0" />
          <div className="flex-1 min-w-0">
            {banner && (
              <>
                <p className={`text-sm font-bold leading-snug ${accent.text}`}>
                  {banner.text}
                </p>
                {banner.sub && (
                  <span className={`inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${accent.subBg} ${accent.subText}`}>
                    <Hourglass size={10} />
                    {banner.sub}
                  </span>
                )}
                {pendingMatches.length > 0 && (
                  <div className={`mt-2 pt-2 border-t border-slate-600/30`}>
                    <div className="flex flex-col gap-1.5">
                      {pendingMatches.map((m) => {
                        const matchDate = new Date(m.date);
                        const formattedDate = matchDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                        const formattedTime = matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div
                            key={m.id}
                            className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-md text-[10px] font-bold border ${accent.subBg} ${accent.subText} border-slate-600/40`}
                          >
                            <span>{m.homeTeam.name} vs {m.awayTeam.name}</span>
                            <span className="opacity-75">• {formattedDate} {formattedTime}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
      )}
    </div>
  );
};

export default PendingPredictionsBanner;
