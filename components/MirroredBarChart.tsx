import React from "react";

/** Uma linha de comparação: rótulo + valores cru dos dois lados. */
export interface MirroredStatRow {
  /** Chave estável para o React (ex.: o `type` da estatística). */
  key: string;
  /** Rótulo exibido (já traduzido). */
  label: string;
  /** Valor do lado esquerdo (mandante) — number, "55%", ou null. */
  left: number | string | null;
  /** Valor do lado direito (visitante). */
  right: number | string | null;
}

interface MirroredBarChartProps {
  rows: MirroredStatRow[];
  /** Classe Tailwind de cor das barras do lado esquerdo. */
  leftColorClass?: string;
  /** Classe Tailwind de cor das barras do lado direito. */
  rightColorClass?: string;
}

// Extrai um número de valores como 12, "55%", "1.8" — para dimensionar a barra.
const toNumber = (v: number | string | null): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};

// Formata o valor para exibição (preserva "%", troca null por "0").
const formatValue = (v: number | string | null): string =>
  v == null ? "0" : String(v);

/**
 * Mirrored (diverging / back-to-back) comparison bar chart para estatísticas de
 * futebol. Cada linha tem um eixo central: a barra do mandante cresce para a
 * ESQUERDA e a do visitante para a DIREITA, cada uma escalada pelo maior valor
 * da própria linha (o lado vencedor preenche sua metade). Componente genérico —
 * não conhece o domínio do jogo; recebe linhas já normalizadas.
 */
export const MirroredBarChart: React.FC<MirroredBarChartProps> = ({
  rows,
  leftColorClass = "bg-brand-green",
  rightColorClass = "bg-sky-400",
}) => {
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const l = toNumber(row.left);
        const r = toNumber(row.right);
        const max = Math.max(l, r);
        const leftFill = max > 0 ? (l / max) * 100 : 0;
        const rightFill = max > 0 ? (r / max) * 100 : 0;
        const leftWins = l > r;
        const rightWins = r > l;

        return (
          <div key={row.key} className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
              {row.label}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`w-10 text-right text-xs font-black tabular-nums ${
                  leftWins ? "text-brand-green" : "text-slate-300"
                }`}
              >
                {formatValue(row.left)}
              </span>

              {/* Eixo central com barras espelhadas */}
              <div className="flex-1 flex items-center">
                <div className="flex-1 flex justify-end">
                  <div
                    className={`h-2 rounded-l-full transition-all ${leftColorClass} ${
                      leftWins ? "" : "opacity-60"
                    }`}
                    style={{ width: `${leftFill}%` }}
                  />
                </div>
                <div className="w-px h-3.5 bg-slate-600 shrink-0" />
                <div className="flex-1 flex justify-start">
                  <div
                    className={`h-2 rounded-r-full transition-all ${rightColorClass} ${
                      rightWins ? "" : "opacity-60"
                    }`}
                    style={{ width: `${rightFill}%` }}
                  />
                </div>
              </div>

              <span
                className={`w-10 text-left text-xs font-black tabular-nums ${
                  rightWins ? "text-sky-400" : "text-slate-300"
                }`}
              >
                {formatValue(row.right)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MirroredBarChart;
