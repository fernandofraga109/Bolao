import React, { useState } from "react";
import TriondaGoalAnimation from "./TriondaGoalAnimation";
import TriondaNetAnimation from "./TriondaNetAnimation";
import CardAnimation from "./CardAnimation";
import ScaledStage from "./ScaledStage";

type Scene = "goal" | "net" | "yellow" | "red";

const NAV: { id: Scene; href: string; label: string; subtitle: string }[] = [
  { id: "goal", href: "/animation", label: "v1 · Gol", subtitle: "bola entrando no gol" },
  { id: "net", href: "/animation/v2", label: "v2 · Rede", subtitle: "bola batendo na rede" },
  { id: "yellow", href: "/animation/yellow", label: "Amarelo", subtitle: "cartão amarelo" },
  { id: "red", href: "/animation/red", label: "Vermelho", subtitle: "cartão vermelho" },
];

function resolveScene(): Scene {
  if (typeof window === "undefined") return "goal";
  const path = window.location.pathname.replace(/\/$/, "");
  if (path.endsWith("/v2")) return "net";
  if (path.endsWith("/yellow")) return "yellow";
  if (path.endsWith("/red")) return "red";
  return "goal";
}

/**
 * Página de PREVIEW das animações ao vivo — rotas isoladas (sem login):
 *   /animation         → bola entrando no gol
 *   /animation/v2      → bola batendo na rede
 *   /animation/yellow  → cartão amarelo
 *   /animation/red     → cartão vermelho
 *
 * Só para visualizar/aprovar antes de integrar ao fluxo ao vivo.
 */
const GoalAnimationPreview: React.FC = () => {
  const scene = resolveScene();
  // Remontar a animação (replay) trocando a key.
  const [playKey, setPlayKey] = useState(0);
  const current = NAV.find((n) => n.id === scene)!;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-7 p-6 bg-brand-dark text-slate-100">
      <div className="text-center">
        <h1 className="text-xl font-black uppercase tracking-widest text-brand-green">
          Preview · Animações Ao Vivo
        </h1>
        <p className="text-xs text-slate-400 mt-1">{current.subtitle}</p>
      </div>

      {/* Navegação entre as cenas */}
      <div className="flex flex-wrap justify-center gap-2 p-1 rounded-2xl bg-slate-800 border border-slate-700">
        {NAV.map((n) => (
          <a
            key={n.id}
            href={n.href}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              n.id === scene ? "bg-brand-green text-brand-dark" : "text-slate-400 hover:text-white"
            }`}
          >
            {n.label}
          </a>
        ))}
      </div>

      {/* Palco */}
      <div className="w-full max-w-[640px]">
        <ScaledStage key={playKey}>
          {scene === "goal" && <TriondaGoalAnimation />}
          {scene === "net" && <TriondaNetAnimation />}
          {scene === "yellow" && <CardAnimation variant="yellow" />}
          {scene === "red" && <CardAnimation variant="red" />}
        </ScaledStage>
      </div>

      {/* Replay */}
      <button
        onClick={() => setPlayKey((k) => k + 1)}
        className="px-6 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-sm font-black uppercase tracking-widest hover:border-brand-green hover:text-brand-green transition-all"
      >
        ↻ Repetir
      </button>

      <p className="text-[11px] text-slate-500 max-w-md text-center leading-relaxed">
        Animações em CSS puro (sem dependências) usando os assets oficiais
        (<code>trionda.svg</code>, <code>yellow-card.svg</code>,{" "}
        <code>red-card.svg</code>). Candidatas à integração no fluxo ao vivo.
      </p>
    </div>
  );
};

export default GoalAnimationPreview;
