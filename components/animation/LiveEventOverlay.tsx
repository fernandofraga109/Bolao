import React, { useEffect } from "react";
import { Match } from "../../types";
import { useLiveEventAnnouncer } from "../../hooks/useLiveEventAnnouncer";
import { LiveEventKind } from "../../utils/liveEvents";
import TriondaGoalAnimation from "./TriondaGoalAnimation";
import CardAnimation from "./CardAnimation";
import ScaledStage from "./ScaledStage";

interface LiveEventOverlayProps {
  matches: Match[];
}

const KIND_LABEL: Record<LiveEventKind, string> = {
  goal: "GOL!",
  yellow: "Cartão Amarelo",
  red: "Cartão Vermelho",
};

/**
 * Overlay efêmero que anuncia gols e cartões ao vivo: ouve `matches` via
 * useLiveEventAnnouncer e mostra a animação correspondente num modal central
 * que some sozinho. Em dev, expõe gatilhos manuais (botões + window) para testar
 * sem esperar um lance real.
 */
const LiveEventOverlay: React.FC<LiveEventOverlayProps> = ({ matches }) => {
  const { current, dismiss, trigger } = useLiveEventAnnouncer(matches);

  // Gatilho de teste no console (só em dev): window.__previewLiveEvent('goal')
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__previewLiveEvent = (kind: LiveEventKind) => trigger(kind);
    return () => {
      delete (window as any).__previewLiveEvent;
    };
  }, [trigger]);

  return (
    <>
      {current && (
        <div
          onClick={dismiss}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-fadeIn"
        >
          <div className="w-full max-w-[640px] flex flex-col items-center gap-3">
            <ScaledStage key={current.id}>
              {current.kind === "goal" ? (
                <TriondaGoalAnimation />
              ) : (
                <CardAnimation variant={current.kind} />
              )}
            </ScaledStage>

            {/* Legenda do lance */}
            <div className="flex flex-col items-center gap-0.5 text-center animate-fadeIn">
              <span className="text-sm font-black uppercase tracking-widest text-white">
                {KIND_LABEL[current.kind]}
              </span>
              {(current.player || current.minute) && (
                <span className="text-xs font-bold text-slate-300">
                  {[current.player, current.minute].filter(Boolean).join(" · ")}
                  {current.teamName ? ` — ${current.teamName}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gatilhos de teste — só em dev */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-3 left-3 z-[70] flex gap-1.5">
          {(
            [
              { kind: "goal", label: "⚽ Gol" },
              { kind: "yellow", label: "🟨 Amarelo" },
              { kind: "red", label: "🟥 Vermelho" },
            ] as { kind: LiveEventKind; label: string }[]
          ).map((b) => (
            <button
              key={b.kind}
              onClick={() => trigger(b.kind)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-600 text-[10px] font-black uppercase tracking-wider text-slate-200 hover:bg-slate-700 hover:border-brand-green transition-all shadow-lg"
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default LiveEventOverlay;
