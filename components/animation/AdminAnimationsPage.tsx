import React from "react";
import { Play, Power } from "lucide-react";
import { LiveEventKind } from "../../utils/liveEvents";

interface AdminAnimationsPageProps {
  /** Dispara a animação na tela (preview real, ignora o kill-switch). */
  onTrigger: (kind: LiveEventKind) => void;
  /** Flags habilitado por tipo (default true quando ausente). */
  enabled: Record<LiveEventKind, boolean>;
  /** Liga/desliga uma animação globalmente (persiste em system_config). */
  onToggle: (kind: LiveEventKind, value: boolean) => void;
}

const ANIMATIONS: { kind: LiveEventKind; emoji: string; title: string; desc: string }[] = [
  { kind: "goal", emoji: "⚽", title: "Gol", desc: "Bola entrando no gol quando sai um gol ao vivo." },
  { kind: "yellow", emoji: "🟨", title: "Cartão Amarelo", desc: "Cartão amarelo erguido ao vivo." },
  { kind: "red", emoji: "🟥", title: "Cartão Vermelho", desc: "Cartão vermelho erguido ao vivo." },
];

/**
 * Aba admin "Animations": lista as animações ao vivo, permite executá-las
 * (preview na tela) e ligar/desligar cada uma globalmente (kill-switch via
 * system_config — vale para todos os usuários em tempo real).
 */
const AdminAnimationsPage: React.FC<AdminAnimationsPageProps> = ({ onTrigger, enabled, onToggle }) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-wide">Animações</h2>
        <p className="text-xs text-slate-400 mt-1">
          Execute para pré-visualizar na tela. Desativar vale para{" "}
          <strong className="text-slate-300">todos os usuários</strong> em tempo real.
        </p>
      </div>

      <div className="space-y-3">
        {ANIMATIONS.map((a) => {
          const isOn = enabled[a.kind];
          return (
            <div
              key={a.kind}
              className="flex items-center gap-3 p-4 rounded-2xl bg-slate-800 border border-slate-700"
            >
              <span className="text-3xl leading-none select-none">{a.emoji}</span>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white">{a.title}</span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                      isOn
                        ? "bg-brand-green/15 text-brand-green"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {isOn ? "Ativa" : "Desativada"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 leading-snug">{a.desc}</span>
              </div>

              <button
                onClick={() => onTrigger(a.kind)}
                title="Executar (pré-visualizar)"
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-600 hover:border-brand-green transition-all"
              >
                <Play size={14} /> Executar
              </button>

              <button
                onClick={() => onToggle(a.kind, !isOn)}
                title={isOn ? "Desativar para todos" : "Ativar para todos"}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${
                  isOn
                    ? "bg-brand-green/10 border-brand-green/40 text-brand-green hover:bg-brand-green/20"
                    : "bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300"
                }`}
              >
                <Power size={14} /> {isOn ? "Desativar" : "Ativar"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminAnimationsPage;
