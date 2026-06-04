import React, { useMemo, useState } from "react";
import { User, Match, MatchStatus } from "../../types";
import {
  Target,
  Zap,
  TrendingUp,
  Trophy,
  BarChart3,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
} from "lucide-react";
import { translateGroupName } from "../../utils/translations";

interface StatsPageProps {
  user: User;
  matches: Match[];
}

// ─── Aggregate stats (same logic as before) ───────────────────────────────────
function useStats(user: User, matches: Match[]) {
  return useMemo(() => {
    const finishedMatches = matches.filter(
      (m) => m.status === MatchStatus.FINISHED,
    );
    const predictions = user.predictions || {};

    let exactScores = 0;
    let correctResults = 0;
    let bonusZebras = 0;
    let totalPoints = 0;
    let gamesPredicted = 0;

    finishedMatches.forEach((match) => {
      const pred = predictions[match.id];
      if (!pred || !match.result) return;

      gamesPredicted++;
      const pts = pred.points || 0;
      totalPoints += pts;

      if (
        pred.home === match.result.home &&
        pred.away === match.result.away
      ) {
        exactScores++;
      }

      const actualOutcome = Math.sign(match.result.home - match.result.away);
      const predictedOutcome = Math.sign(pred.home - pred.away);
      if (actualOutcome === predictedOutcome) correctResults++;

      if (pts > 15) bonusZebras++;
    });

    const accuracy =
      gamesPredicted > 0 ? (correctResults / gamesPredicted) * 100 : 0;
    const exactRate =
      gamesPredicted > 0 ? (exactScores / gamesPredicted) * 100 : 0;

    return {
      totalPoints,
      gamesPredicted,
      exactScores,
      correctResults,
      bonusZebras,
      accuracy: accuracy.toFixed(1),
      exactRate: exactRate.toFixed(1),
      avgPoints:
        gamesPredicted > 0 ? (totalPoints / gamesPredicted).toFixed(1) : "0",
    };
  }, [user.predictions, matches]);
}

// ─── Prediction history entry ─────────────────────────────────────────────────
interface PredictionEntry {
  matchId: string;
  match: Match;
  home: number;
  away: number;
  points: number;
  isExact: boolean;
}

function usePredictionHistory(
  user: User,
  matches: Match[],
): { scored: PredictionEntry[]; missed: PredictionEntry[] } {
  return useMemo(() => {
    const predictions = user.predictions || {};
    const finishedMatches = matches.filter(
      (m) => m.status === MatchStatus.FINISHED && predictions[m.id] != null,
    );

    const entries: PredictionEntry[] = finishedMatches.map((match) => {
      const pred = predictions[match.id];
      const pts = pred.points ?? 0;
      const isExact =
        !!match.result &&
        pred.home === match.result.home &&
        pred.away === match.result.away;
      return {
        matchId: match.id,
        match,
        home: pred.home,
        away: pred.away,
        points: pts,
        isExact,
      };
    });

    // Sort by match date descending (most recent first)
    entries.sort(
      (a, b) =>
        new Date(b.match.date).getTime() - new Date(a.match.date).getTime(),
    );

    return {
      scored: entries.filter((e) => e.points > 0),
      missed: entries.filter((e) => e.points === 0),
    };
  }, [user.predictions, matches]);
}

// ─── Single Prediction Card ───────────────────────────────────────────────────
const PredictionCard: React.FC<{ entry: PredictionEntry }> = ({ entry }) => {
  const { match, home, away, points, isExact } = entry;
  const matchDate = new Date(match.date);

  const formattedDate = matchDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const formattedTime = matchDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasPoints = points > 0;

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all hover:scale-[1.01] hover:shadow-xl ${
        hasPoints
          ? isExact
            ? "bg-gradient-to-br from-brand-green/10 to-emerald-900/20 border-brand-green/30 shadow-brand-green/5 shadow-lg"
            : "bg-slate-800/60 border-slate-700/60 shadow-sm"
          : "bg-slate-900/40 border-slate-800/60"
      }`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <MapPin size={11} className="shrink-0" />
          <span className="font-semibold truncate max-w-[120px]">
            {translateGroupName(match.group)}
          </span>
          <span className="text-slate-600">·</span>
          <Calendar size={11} className="shrink-0" />
          <span>
            {formattedDate} · {formattedTime}
          </span>
        </div>

        {/* Points badge */}
        <div
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${
            hasPoints
              ? "bg-brand-green/20 border-brand-green/40 text-brand-green"
              : "bg-slate-800 border-slate-700 text-slate-500"
          }`}
        >
          {hasPoints ? `+${points} pts` : "0 pts"}
        </div>
      </div>

      {/* Match body */}
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Home team */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-700/50 shrink-0 overflow-hidden">
            <img
              src={match.homeTeam.flag}
              alt={match.homeTeam.code}
              className="w-full h-full object-contain"
            />
          </div>

          <span className="text-sm font-bold text-white truncate">
            {match.homeTeam.name}
          </span>
        </div>

        {/* Scores area */}
        <div className="flex flex-col items-center gap-1 px-3 shrink-0">
          {/* Actual result */}
          {match.result != null && (
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-white leading-none">
                {match.result.home}
              </span>
              <span className="text-slate-600 text-xs font-bold">×</span>
              <span className="text-lg font-black text-white leading-none">
                {match.result.away}
              </span>
            </div>
          )}
          {/* Divider label */}
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            resultado
          </span>
          {/* Prediction */}
          <div className="flex items-center gap-2 bg-slate-900/60 px-2 py-0.5 rounded-lg border border-slate-700/50">
            <span
              className={`text-sm font-black leading-none ${hasPoints ? "text-brand-green" : "text-slate-400"}`}
            >
              {home}
            </span>
            <span className="text-slate-600 text-xs font-bold">×</span>
            <span
              className={`text-sm font-black leading-none ${hasPoints ? "text-brand-green" : "text-slate-400"}`}
            >
              {away}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">
            palpite
          </span>
        </div>

        {/* Away team */}
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="text-sm font-bold text-white truncate text-right">
            {match.awayTeam.name}
          </span>
          <div className="w-8 h-8 flex items-center justify-center bg-slate-900/50 rounded-lg border border-slate-700/50 shrink-0 overflow-hidden">
            <img
              src={match.awayTeam.flag}
              alt={match.awayTeam.code}
              className="w-6 h-6 object-contain"
            />
          </div>

        </div>
      </div>

      {/* Exact score badge */}
      {isExact && (
        <div className="px-4 pb-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand-green bg-brand-green/10 border border-brand-green/30 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={11} />
            Placar Exato!
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Collapsible section ──────────────────────────────────────────────────────
const CollapsibleSection: React.FC<{
  title: string;
  count: number;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  accentClass?: string;
  children: React.ReactNode;
}> = ({ title, count, defaultOpen = true, icon, accentClass = "text-brand-green", children }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-sm font-black uppercase tracking-widest ${accentClass}`}>
            {title}
          </span>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
            {count}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-slate-500" />
        ) : (
          <ChevronDown size={16} className="text-slate-500" />
        )}
      </button>

      {open && (
        <div className="space-y-3 animate-fadeIn">{children}</div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const StatsPage: React.FC<StatsPageProps> = ({ user, matches }) => {
  const stats = useStats(user, matches);
  const { scored, missed } = usePredictionHistory(user, matches);

  return (
    <div className="w-full max-w-2xl mx-auto pb-10 animate-fadeIn space-y-8">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-brand-green to-emerald-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-10 -mt-10" />
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-brand-dark tracking-tighter mb-1 uppercase">
            Meu Desempenho
          </h2>
          <p className="text-brand-dark/70 text-xs font-bold uppercase tracking-widest">
            Análise detalhada de seus palpites
          </p>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-xl">
          <div className="bg-brand-green/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <Target size={20} className="text-brand-green" />
          </div>
          <div className="text-3xl font-black text-white leading-none mb-1">
            {stats.accuracy}%
          </div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Acurácia de Resultado
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-xl">
          <div className="bg-brand-blue/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <Trophy size={20} className="text-brand-blue" />
          </div>
          <div className="text-3xl font-black text-white leading-none mb-1">
            {stats.exactScores}
          </div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Placares Exatos
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-xl">
          <div className="bg-yellow-500/20 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <Zap size={20} className="text-yellow-400" />
          </div>
          <div className="text-3xl font-black text-white leading-none mb-1">
            {stats.bonusZebras}
          </div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Bônus de Zebra
          </div>
        </div>

        <div className="bg-brand-blue/10 backdrop-blur-md p-6 rounded-3xl border border-brand-blue/20 shadow-xl">
          <div className="bg-white/10 w-10 h-10 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div className="text-3xl font-black text-white leading-none mb-1">
            {stats.avgPoints}
          </div>
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Média pts / Jogo
          </div>
        </div>
      </div>

      {/* Progress Bars */}
      <div className="bg-slate-800/50 backdrop-blur-md p-8 rounded-3xl border border-white/5 shadow-xl">
        <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <BarChart3 size={18} className="text-brand-green" />
          Distribuição de Performance
        </h3>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-black text-slate-400 uppercase">
                Frequência de Placar Exato
              </span>
              <span className="text-xs font-black text-white">
                {stats.exactRate}%
              </span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-green to-emerald-400 transition-all duration-1000"
                style={{ width: `${stats.exactRate}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-black text-slate-400 uppercase">
                Taxa de Acerto Geral
              </span>
              <span className="text-xs font-black text-white">
                {stats.accuracy}%
              </span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-blue to-indigo-600 transition-all duration-1000"
                style={{ width: `${stats.accuracy}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer summary */}
      <div className="flex items-center gap-3 p-6 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
          <Activity size={20} className="text-slate-600" />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Resumo de Atividade
          </p>
          <p className="text-xs font-bold text-slate-400">
            Você participou de{" "}
            <span className="text-white">{stats.gamesPredicted}</span> jogos
            finalizados até agora.
          </p>
        </div>
      </div>

      {/* ── Prediction History ── */}
      {(scored.length > 0 || missed.length > 0) && (
        <div className="space-y-6">
          <div className="border-t border-slate-800 pt-6">
            <h3 className="text-base font-black text-white uppercase tracking-widest mb-1">
              Histórico de Palpites
            </h3>
            <p className="text-[11px] text-slate-500 mb-6">
              Partidas finalizadas onde você fez palpite · ordenado por data
            </p>

            <div className="space-y-8">
              {/* Scored predictions */}
              {scored.length > 0 && (
                <CollapsibleSection
                  title="Pontuados"
                  count={scored.length}
                  defaultOpen={true}
                  icon={<CheckCircle2 size={16} className="text-brand-green" />}
                  accentClass="text-brand-green"
                >
                  {scored.map((entry) => (
                    <PredictionCard key={entry.matchId} entry={entry} />
                  ))}
                </CollapsibleSection>
              )}

              {/* Zero-point predictions */}
              {missed.length > 0 && (
                <CollapsibleSection
                  title="Não Pontuados"
                  count={missed.length}
                  defaultOpen={false}
                  icon={<Target size={16} className="text-slate-500" />}
                  accentClass="text-slate-400"
                >
                  {missed.map((entry) => (
                    <PredictionCard key={entry.matchId} entry={entry} />
                  ))}
                </CollapsibleSection>
              )}
            </div>
          </div>
        </div>
      )}

      {scored.length === 0 && missed.length === 0 && (
        <div className="text-center py-10 border border-slate-800 rounded-2xl border-dashed">
          <p className="text-slate-500 text-sm">
            Nenhum palpite em partidas finalizadas ainda.
          </p>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
