import React from "react";
import { X } from "lucide-react";

export type ScoringCategory = "exact" | "diff" | "outcome" | "wrong";

// Centralized color mapping for scoring categories — used by MatchCard, UserAuditModal, and this guide.
export const SCORING_COLORS: Record<ScoringCategory, { bg: string; text: string; border: string }> = {
  exact:   { bg: "bg-brand-gold text-brand-dark shadow-brand-gold/30",   text: "text-brand-gold",  border: "border-brand-gold/60"  },
  diff:    { bg: "bg-brand-blue text-white shadow-brand-blue/30",         text: "text-sky-400",     border: "border-sky-400/50"     },
  outcome: { bg: "bg-indigo-600 text-white shadow-indigo-500/30",         text: "text-brand-green", border: "border-brand-green/50" },
  wrong:   { bg: "bg-slate-700 text-slate-400",                           text: "text-red-400",     border: "border-red-500/20"     },
};

interface ScoringGuideProps {
  ruleset: "regulamento_1" | "regulamento_2";
  onClose: () => void;
}

const ScoringGuide: React.FC<ScoringGuideProps> = ({ ruleset, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 shrink-0">
          <h2 className="font-black text-white text-base">
            {ruleset === "regulamento_1" ? "Pontuação – Regulamento 1" : "Pontuação – Regulamento 2"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">
          {ruleset === "regulamento_1" ? <R1Content /> : <R2Content />}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-slate-700/60">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
    {children}
  </h3>
);

const Note: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{children}</p>
);

const R1Content: React.FC = () => (
  <>
    <div>
      <SectionTitle>Jogos (Fase de Grupos)</SectionTitle>
      <div className="space-y-1.5">
        <ScoreRow
          icon="🏆"
          label="Placar Exato"
          pts="+10 pts"
          suffix="(+ até +5 underdog)"
          colorClass="text-brand-gold border-brand-gold/60 bg-brand-gold/10"
        />
        <ScoreRow
          icon="🥈"
          label="Diferença certa"
          pts="+7 pts"
          suffix="(+ até +5 underdog)"
          colorClass="text-sky-400 border-sky-400/50 bg-sky-400/10"
        />
        <ScoreRow
          icon="🥉"
          label="Resultado certo"
          pts="+5 pts"
          suffix="(+ até +5 underdog)"
          colorClass="text-brand-green border-brand-green/50 bg-brand-green/10"
        />
        <ScoreRow
          icon="❌"
          label="Errou"
          pts="0 pts"
          colorClass="text-red-400 border-red-500/20 bg-red-500/10"
        />
      </div>
      <Note>Regra 3: em empates reais, diferença não se aplica (máx. resultado)</Note>
    </div>

    <div>
      <SectionTitle>Mata-Mata</SectionTitle>
      <Note>Comparado contra o placar após a prorrogação (tempo regular + prorrogação, 120 min). Pênaltis não contam para o placar.</Note>
      <div className="mt-2">
        <BonusRow
          label="Bônus Classifica"
          pts="+3 pts"
          description="Palpite empate + jogo foi a pênaltis + escolheu o time certo que avançou"
        />
      </div>
    </div>

    <div>
      <SectionTitle>Palpites Especiais</SectionTitle>
      <div className="space-y-1.5">
        {[
          "Campeão",
          "Artilheiro (nome)",
          "Artilheiro (gols)",
          "Melhor Jogador",
          "Melhor Goleiro",
        ].map((label) => (
          <div
            key={label}
            className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-700/40 bg-slate-800/40"
          >
            <span className="text-sm text-slate-300">{label}</span>
            <span className="text-sm font-black text-brand-gold">+100 pts</span>
          </div>
        ))}
      </div>
    </div>
  </>
);

const R2Content: React.FC = () => (
  <>
    <div>
      <SectionTitle>Jogos</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
              <th className="text-left py-1.5 pr-2 font-bold">Categoria</th>
              <th className="text-center py-1.5 px-1 font-bold">Grupos</th>
              <th className="text-center py-1.5 px-1 font-bold">Oitavas/Q/S</th>
              <th className="text-center py-1.5 px-1 font-bold">3º Lugar</th>
              <th className="text-center py-1.5 px-1 font-bold">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            <R2TableRow
              icon="🏆"
              label="Placar Exato"
              values={["15", "15", "17", "22"]}
              colorClass="text-brand-gold"
            />
            <R2TableRow
              icon="🥈"
              label="Diferença"
              values={["13", "13", "15", "19"]}
              colorClass="text-sky-400"
            />
            <R2TableRow
              icon="🥉"
              label="Resultado"
              values={["10", "10", "12", "16"]}
              colorClass="text-brand-green"
            />
            <R2TableRow
              icon="❌"
              label="Errou"
              values={["0", "0", "0", "0"]}
              colorClass="text-red-400"
            />
            <R2TableRow
              icon="✨"
              label="Placar Isolado"
              values={["+5", "+5", "+5", "+5"]}
              colorClass="text-amber-300"
            />
          </tbody>
        </table>
      </div>
      <Note>Regra 3: em empates reais, diferença não se aplica (máx. resultado)</Note>
      <Note>Mata-mata: tempo regular + prorrogação conta para R2</Note>
      <p className="text-[11px] text-slate-600 mt-1">
        ✨ Placar Isolado: único com esse placar exato no grupo
      </p>
    </div>

    <div>
      <SectionTitle>Palpites Especiais (R2)</SectionTitle>
      <div className="space-y-1.5">
        <SpecialR2Row
          label="Campeão"
          pts="1: 100 | 2: 70 | 3: 50 | 4+: 40"
        />
        <SpecialR2Row
          label="Artilheiro"
          pts="1: 60 | 2: 40 | 3: 30 | 4+: 25"
        />
        <SpecialR2Row
          label="Classificados (grupos)"
          pts="+10 por time"
        />
        <SpecialR2Row
          label="Classificados (oitavas+)"
          pts="+5 por time"
        />
        <SpecialR2Row
          label="Goleada por fase"
          pts="+20 pts"
        />
        <SpecialR2Row
          label="Mais gols / sofridos"
          pts="+20 pts cada"
        />
      </div>
      <Note>Os pontos de Campeão/Artilheiro dependem de quantos acertaram (menos acertos = mais pontos)</Note>
    </div>
  </>
);

interface ScoreRowProps {
  icon: string;
  label: string;
  pts: string;
  suffix?: string;
  colorClass: string;
}

const ScoreRow: React.FC<ScoreRowProps> = ({ icon, label, pts, suffix, colorClass }) => (
  <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${colorClass}`}>
    <div className="flex items-center gap-2">
      <span className="text-base leading-none">{icon}</span>
      <span className={`text-sm font-bold ${colorClass.split(" ")[0]}`}>{label}</span>
    </div>
    <div className="flex items-center gap-1.5 text-right">
      <span className={`text-sm font-black ${colorClass.split(" ")[0]}`}>{pts}</span>
      {suffix && <span className="text-[10px] text-slate-500">{suffix}</span>}
    </div>
  </div>
);

interface BonusRowProps {
  label: string;
  pts: string;
  description: string;
}

const BonusRow: React.FC<BonusRowProps> = ({ label, pts, description }) => (
  <div className="px-3 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10">
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm font-bold text-amber-300">✨ {label}</span>
      <span className="text-sm font-black text-amber-300">{pts}</span>
    </div>
    <p className="text-[11px] text-amber-300/60 leading-relaxed">{description}</p>
  </div>
);

interface R2TableRowProps {
  icon: string;
  label: string;
  values: [string, string, string, string];
  colorClass: string;
}

const R2TableRow: React.FC<R2TableRowProps> = ({ icon, label, values, colorClass }) => (
  <tr>
    <td className="py-2 pr-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm leading-none">{icon}</span>
        <span className={`text-xs font-bold ${colorClass}`}>{label}</span>
      </div>
    </td>
    {values.map((v, i) => (
      <td key={i} className={`text-center py-2 px-1 font-black text-xs ${colorClass}`}>
        {v}
      </td>
    ))}
  </tr>
);

interface SpecialR2RowProps {
  label: string;
  pts: string;
}

const SpecialR2Row: React.FC<SpecialR2RowProps> = ({ label, pts }) => (
  <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-700/40 bg-slate-800/40">
    <span className="text-sm text-slate-300">{label}</span>
    <span className="text-xs font-bold text-amber-300 text-right max-w-[140px]">{pts}</span>
  </div>
);

export default ScoringGuide;
