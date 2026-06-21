import { LiveMatchEvent } from "../types";

/** Tipo de animação ao vivo disparada por um evento. */
export type LiveEventKind = "goal" | "yellow" | "red";

/**
 * Classifica um evento do minuto-a-minuto (api-sports) na animação que deve
 * disparar — ou `null` quando o evento não tem animação (substituição, VAR,
 * pênalti perdido, etc.). Espelha a lógica de `isGoal`/`cardColor` da timeline.
 */
export function classifyLiveEvent(ev: LiveMatchEvent): LiveEventKind | null {
  if (ev.type === "Goal") {
    return ev.detail === "Missed Penalty" ? null : "goal";
  }
  if (ev.type === "Card") {
    const d = (ev.detail || "").toLowerCase();
    if (d.includes("red") || d.includes("second yellow")) return "red";
    if (d.includes("yellow")) return "yellow";
    return null;
  }
  return null;
}

/**
 * Chave estável de um evento, usada para deduplicar (o realtime/re-sync reemite
 * o mesmo array de eventos). Eventos não têm id próprio na api-sports.
 */
export function liveEventKey(ev: LiveMatchEvent): string {
  return [
    ev.elapsed,
    ev.extra ?? 0,
    ev.type,
    ev.detail,
    ev.player ?? "",
    ev.teamApiId ?? "",
  ].join("|");
}

/** Minuto formatado (ex.: "45+2'"). */
export function formatEventMinute(ev: LiveMatchEvent): string {
  return ev.extra ? `${ev.elapsed}+${ev.extra}'` : `${ev.elapsed}'`;
}
