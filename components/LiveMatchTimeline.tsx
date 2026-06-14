import React, { useMemo } from "react";
import { Match, LiveMatchEvent } from "../types";
import { canonicalTeamName } from "../services/liveScoreService";
import { Flag, MapPin } from "lucide-react";

interface LiveMatchTimelineProps {
  match: Match;
}

const isGoal = (ev: LiveMatchEvent) =>
  ev.type === "Goal" && ev.detail !== "Missed Penalty";
const isCard = (ev: LiveMatchEvent) => ev.type === "Card";

const formatEventMinute = (ev: LiveMatchEvent): string => {
  const base = `${ev.elapsed}`;
  return ev.extra ? `${base}+${ev.extra}'` : `${base}'`;
};

const cardColor = (detail: string): string => {
  const d = detail.toLowerCase();
  if (d.includes("red") || d.includes("second yellow")) return "bg-brand-red";
  return "bg-yellow-400";
};

// Traduções dos rótulos vindos da api-sports (em inglês) para pt-BR.
const DETAIL_PT: Record<string, string> = {
  "Normal Goal": "Gol",
  "Penalty": "Gol de pênalti",
  "Own Goal": "Gol contra",
  "Missed Penalty": "Pênalti perdido",
  "Yellow Card": "Cartão amarelo",
  "Red Card": "Cartão vermelho",
  "Second Yellow card": "2º amarelo (vermelho)",
};

const translateDetail = (detail: string): string => DETAIL_PT[detail] ?? detail;

/**
 * Conteúdo de um evento (ícone + jogador + detalhe), alinhado de acordo com o
 * lado: mandante (`home`) encosta no centro pela direita; visitante (`away`)
 * pela esquerda. Espelha a disposição do MatchCard (home à esquerda, away à direita).
 */
const EventCell: React.FC<{ ev: LiveMatchEvent; side: "home" | "away" }> = ({
  ev,
  side,
}) => {
  const goal = isGoal(ev);
  const isHome = side === "home";

  const icon = goal ? (
    <span className="text-brand-green shrink-0 text-sm">⚽</span>
  ) : (
    <span
      className={`inline-block w-2.5 h-3.5 rounded-[2px] shrink-0 ${cardColor(ev.detail)}`}
    />
  );

  const text = (
    <div className={`flex flex-col min-w-0 ${isHome ? "items-end" : "items-start"}`}>
      <span className="flex items-center gap-1">
        {goal && (
          <span className="text-[9px] font-black text-brand-green uppercase tracking-wider">
            Gol
          </span>
        )}
        <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]">
          {ev.player || (goal ? "Gol" : "Cartão")}
        </span>
      </span>
      {goal && ev.assist && (
        <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
          assist. {ev.assist}
        </span>
      )}
      {goal && !ev.assist && ev.detail !== "Normal Goal" && (
        <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
          {translateDetail(ev.detail)}
        </span>
      )}
      {isCard(ev) && (
        <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
          {translateDetail(ev.detail)}
        </span>
      )}
    </div>
  );

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 ${goal ? "bg-brand-green/10 border border-brand-green/20" : ""}`}
    >
      {isHome ? (
        <>
          {text}
          {icon}
        </>
      ) : (
        <>
          {icon}
          {text}
        </>
      )}
    </div>
  );
};

/**
 * Linha do tempo "minuto a minuto" (estilo Google) para jogos ao vivo.
 * Renderiza árbitro, estádio e os eventos (gols com jogador + assistência,
 * cartões), alinhando eventos do mandante à esquerda e do visitante à direita.
 *
 * Estes dados vêm da api-sports e são puramente informativos — NÃO entram em
 * nenhum cálculo de pontos.
 */
export const LiveMatchTimeline: React.FC<LiveMatchTimelineProps> = ({
  match,
}) => {
  const ld = match.liveDetails;

  const homeCanonical = useMemo(
    () => canonicalTeamName(match.homeTeam?.name),
    [match.homeTeam?.name],
  );

  const events = useMemo(() => {
    if (!ld?.events) return [];
    return ld.events
      .filter((ev) => isGoal(ev) || isCard(ev))
      .map((ev) => ({
        ev,
        isHome: canonicalTeamName(ev.teamName) === homeCanonical,
      }))
      .sort((a, b) => {
        const am = a.ev.elapsed + (a.ev.extra || 0) / 100;
        const bm = b.ev.elapsed + (b.ev.extra || 0) / 100;
        return am - bm;
      });
  }, [ld?.events, homeCanonical]);

  if (!ld) return null;

  const hasMeta = Boolean(ld.referee || ld.venue?.name);

  return (
    <div className="px-5 pb-5 border-t border-slate-700/50 bg-slate-900/20 pt-4 animate-slideDown">
      {/* Cabeçalho: árbitro + estádio */}
      {hasMeta && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
          {ld.referee && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              <Flag size={12} className="text-slate-500" />
              <span className="truncate max-w-[180px]">{ld.referee}</span>
            </div>
          )}
          {ld.venue?.name && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
              <MapPin size={12} className="text-slate-500" />
              <span className="truncate max-w-[200px]">
                {ld.venue.name}
                {ld.venue.city ? ` · ${ld.venue.city}` : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Linha do tempo de eventos — eixo central com o minuto.
          Mandante (home) à esquerda, visitante (away) à direita. */}
      {events.length > 0 ? (
        <div className="relative space-y-1">
          {/* Linha vertical central */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-700/50" />
          {events.map(({ ev, isHome }, idx) => (
            <div
              key={`${ev.elapsed}-${ev.player}-${idx}`}
              className="relative grid grid-cols-[1fr_2.25rem_1fr] items-center gap-1"
            >
              {/* Coluna mandante (esquerda) */}
              <div className="flex justify-end min-w-0">
                {isHome && <EventCell ev={ev} side="home" />}
              </div>

              {/* Minuto (centro) */}
              <span className="text-[10px] font-black text-slate-500 tabular-nums text-center bg-slate-900/40 rounded-full py-0.5">
                {formatEventMinute(ev)}
              </span>

              {/* Coluna visitante (direita) */}
              <div className="flex justify-start min-w-0">
                {!isHome && <EventCell ev={ev} side="away" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center py-2">
          Sem lances registrados ainda
        </p>
      )}
    </div>
  );
};

export default LiveMatchTimeline;
