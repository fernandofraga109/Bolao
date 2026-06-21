import React from "react";
import { LiveEventKind } from "../../utils/liveEvents";
import { AnnouncedEvent } from "../../hooks/useLiveEventAnnouncer";
import TriondaGoalAnimation from "./TriondaGoalAnimation";
import CardAnimation from "./CardAnimation";
import ScaledStage from "./ScaledStage";

interface LiveEventOverlayProps {
  current: AnnouncedEvent | null;
  dismiss: () => void;
}

const KIND_LABEL: Record<LiveEventKind, string> = {
  goal: "GOL!",
  yellow: "Cartão Amarelo",
  red: "Cartão Vermelho",
};

/**
 * Modal efêmero (apresentacional) que mostra a animação do lance ao vivo e some
 * sozinho. A detecção/fila vive no `useLiveEventAnnouncer` (no App); os gatilhos
 * de teste foram para a aba Animations do admin.
 */
const LiveEventOverlay: React.FC<LiveEventOverlayProps> = ({ current, dismiss }) => {
  if (!current) return null;

  return (
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
  );
};

export default LiveEventOverlay;
