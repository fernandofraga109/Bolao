import { useCallback, useEffect, useRef, useState } from "react";
import { Match, MatchStatus } from "../types";
import {
  LiveEventKind,
  classifyLiveEvent,
  liveEventKey,
  formatEventMinute,
} from "../utils/liveEvents";

export interface AnnouncedEvent {
  id: string;
  kind: LiveEventKind;
  matchId?: string;
  teamName?: string | null;
  player?: string | null;
  minute?: string | null;
  isTest?: boolean;
}

const DURATION: Record<LiveEventKind, number> = {
  goal: 3200,
  yellow: 2600,
  red: 2800,
};

// Janela de aquecimento após montar: tudo que aparecer aqui é tratado como
// baseline (não dispara). Cobre a carga escalonada inicial (matches chegam, e o
// liveDetails/eventos chegam alguns segundos depois via fetch/realtime).
const WARMUP_MS = 8000;

/**
 * Detecta eventos NOVOS de gol/cartão no minuto-a-minuto (`liveDetails.events`)
 * e os enfileira como animações. Anti-retroativo: na primeira vez que `matches`
 * chega populada, os eventos já existentes viram baseline (não disparam) — só
 * eventos que chegam depois, com o app aberto, disparam. Um `Set` de chaves por
 * jogo deduplica reemissões do realtime/re-sync.
 *
 * Retorna o evento em exibição (`current`), `dismiss` (pular) e `trigger`
 * (disparo manual — usado só para testes em dev).
 */
/**
 * @param matches lista de jogos (hidratada, com liveDetails).
 * @param enabled flags por tipo de animação (kill-switch do admin). Ausente =
 *   tudo habilitado. O disparo manual via `trigger` ignora estas flags.
 */
export function useLiveEventAnnouncer(
  matches: Match[],
  enabled?: Partial<Record<LiveEventKind, boolean>>,
) {
  const [current, setCurrent] = useState<AnnouncedEvent | null>(null);

  const queueRef = useRef<AnnouncedEvent[]>([]);
  const activeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const seenRef = useRef<Map<string, Set<string>>>(new Map());
  const baselinedRef = useRef<Set<string>>(new Set());
  const mountTimeRef = useRef(Date.now());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      activeRef.current = false;
      setCurrent(null);
      return;
    }
    activeRef.current = true;
    setCurrent(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(showNext, DURATION[next.kind]);
  }, []);

  const enqueue = useCallback(
    (ev: AnnouncedEvent) => {
      queueRef.current.push(ev);
      if (!activeRef.current) showNext();
    },
    [showNext],
  );

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    showNext();
  }, [showNext]);

  const trigger = useCallback(
    (kind: LiveEventKind) => {
      enqueue({
        id: `test-${kind}-${Date.now()}`,
        kind,
        player: "Pré-visualização",
        minute: null,
        isTest: true,
      });
    },
    [enqueue],
  );

  useEffect(() => {
    if (matches.length === 0) return;
    const warming = Date.now() - mountTimeRef.current < WARMUP_MS;

    for (const m of matches) {
      const ld = m.liveDetails;
      // Sem liveDetails ainda → nada a fazer. NÃO marca baseline aqui: o jogo só
      // é baselinado quando o liveDetails (com o histórico) realmente aparece,
      // evitando o burst retroativo quando os eventos chegam depois dos matches.
      if (!ld) continue;
      const evs = ld.events ?? [];

      // Baseline por partida: na 1ª vez que vemos o liveDetails dela, registra os
      // eventos existentes sem disparar (são "antigos", já estavam no banco).
      if (!baselinedRef.current.has(m.id)) {
        seenRef.current.set(m.id, new Set(evs.map(liveEventKey)));
        baselinedRef.current.add(m.id);
        continue;
      }

      if (m.status !== MatchStatus.LIVE || evs.length === 0) continue;

      let set = seenRef.current.get(m.id);
      if (!set) {
        set = new Set();
        seenRef.current.set(m.id, set);
      }
      for (const ev of evs) {
        const key = liveEventKey(ev);
        if (set.has(key)) continue;
        set.add(key);
        // Durante o aquecimento, trata como baseline (registra mas não dispara).
        if (warming) continue;
        const kind = classifyLiveEvent(ev);
        if (!kind) continue;
        // Kill-switch do admin: desabilitada → registra (sem replay futuro) e pula.
        if (enabledRef.current && enabledRef.current[kind] === false) continue;
        enqueue({
          id: `${m.id}-${key}`,
          kind,
          matchId: m.id,
          teamName: ev.teamName,
          player: ev.player,
          minute: formatEventMinute(ev),
        });
      }
    }
  }, [matches, enqueue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { current, dismiss, trigger };
}
