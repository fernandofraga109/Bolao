import { useEffect, useState } from "react";
import { LiveMatchDetails } from "../types";

/**
 * RELÓGIO AO VIVO (estilo Google)
 * -------------------------------
 * Ancoramos no minuto autoritativo da api-sports (`status.elapsed`) no momento
 * em que buscamos os dados (`syncedAt`) e fazemos o relógio "tickar" localmente
 * somando o tempo decorrido desde então — sem gastar nenhuma chamada de API.
 *
 *   minuto_exibido = elapsed + (agora - syncedAt)
 *
 * Por que não usar `periods.first/second`? Observamos que a api-sports calcula
 * `periods.second` como `first + 60min` (assumindo 45' + 15' fixos), o que
 * diverge do restart real e do `elapsed` em vários minutos. O `elapsed` é a
 * fonte correta e se auto-corrige a cada novo fetch (a cada ~5min).
 */

export interface LiveClock {
  /** Texto pronto pra exibir: "90:12 (+4)", "Intervalo", "Encerrado", etc. */
  label: string;
  /** Se o relógio está correndo (deve tickar a cada segundo). */
  running: boolean;
}

const formatClock = (totalSec: number, extra: number | null): string => {
  const safe = Math.max(0, totalSec);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  const extraStr = extra ? ` (+${extra})` : "";
  return `${mm}:${ss.toString().padStart(2, "0")}${extraStr}`;
};

/**
 * Função pura (testável) que calcula o estado do relógio para um dado `now`.
 */
export const getLiveClock = (
  details: LiveMatchDetails | null | undefined,
  now: number = Date.now(),
): LiveClock | null => {
  if (!details) return null;

  const status = (details.statusShort || "").toUpperCase();

  // Estados finais
  if (["FT", "AET", "PEN"].includes(status)) {
    return { label: "Encerrado", running: false };
  }
  // Pausados
  if (status === "HT") return { label: "Intervalo", running: false };
  if (status === "BT") return { label: "Intervalo (prorrog.)", running: false };
  if (status === "P") return { label: "Pênaltis", running: false };
  if (["SUSP", "INT", "PST", "ABD", "CANC"].includes(status)) {
    return { label: "Paralisado", running: false };
  }

  // Em andamento — ticka a partir do último elapsed conhecido + tempo desde o fetch.
  if (details.elapsed != null) {
    const syncedMs = Date.parse(details.syncedAt);
    const baseSec = details.elapsed * 60;
    const sinceSyncSec = Number.isFinite(syncedMs)
      ? Math.max(0, Math.floor((now - syncedMs) / 1000))
      : 0;
    return {
      label: formatClock(baseSec + sinceSyncSec, details.extra),
      running: true,
    };
  }

  return { label: "Ao Vivo", running: false };
};

/**
 * Hook que retorna o relógio e re-renderiza a cada segundo enquanto ele corre.
 */
export const useLiveMatchClock = (
  details: LiveMatchDetails | null | undefined,
): LiveClock | null => {
  const [clock, setClock] = useState<LiveClock | null>(() => getLiveClock(details));

  useEffect(() => {
    setClock(getLiveClock(details));

    const current = getLiveClock(details);
    if (!current?.running) return;

    const id = setInterval(() => {
      setClock(getLiveClock(details));
    }, 1000);

    return () => clearInterval(id);
  }, [details]);

  return clock;
};
