import { LiveMatchDetails } from "../types";

/**
 * RELÓGIO AO VIVO
 * ---------------
 * Exibimos diretamente o minuto autoritativo da api-sports (`status.elapsed`).
 * Como agora sincronizamos minuto a minuto, o `elapsed` já é preciso e não
 * precisamos mais "tickar" localmente — isso só fazia o relógio adiantar.
 *
 *   minuto_exibido = elapsed
 *
 * Por que não usar `periods.first/second`? Observamos que a api-sports calcula
 * `periods.second` como `first + 60min` (assumindo 45' + 15' fixos), o que
 * diverge do restart real e do `elapsed` em vários minutos. O `elapsed` é a
 * fonte correta e se auto-corrige a cada novo fetch.
 */

export interface LiveClock {
  /** Texto pronto pra exibir: "90' (+4)", "Intervalo", "Encerrado", etc. */
  label: string;
  /** Se o relógio está correndo (mantido por compatibilidade). */
  running: boolean;
}

const formatClock = (minutes: number, extra: number | null): string => {
  const mm = Math.max(0, Math.floor(minutes));
  const extraStr = extra ? ` (+${extra})` : "";
  return `${mm}'${extraStr}`;
};

/**
 * Função pura (testável) que calcula o estado do relógio para um dado `now`.
 */
export const getLiveClock = (
  details: LiveMatchDetails | null | undefined,
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

  // Em andamento — mostra o minuto autoritativo da api-sports (sem tick local).
  if (details.elapsed != null) {
    return {
      label: formatClock(details.elapsed, details.extra),
      running: false,
    };
  }

  return { label: "Ao Vivo", running: false };
};

/**
 * Hook que retorna o relógio. Re-renderiza quando `details` muda (novo sync).
 */
export const useLiveMatchClock = (
  details: LiveMatchDetails | null | undefined,
): LiveClock | null => {
  return getLiveClock(details);
};
