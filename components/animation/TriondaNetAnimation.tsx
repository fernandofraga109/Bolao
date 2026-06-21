import React from "react";

/**
 * Animação v2 (estilizada) — gol em perspectiva com rede fina e a bola
 * (trionda.svg) voando da esquerda e ESTUFANDO a rede.
 *
 * A rede é gerada em PERSPECTIVA REAL via SVG: as linhas convergem (homografia
 * do quadrado unitário para um trapézio), dando cara de rede de verdade (e não
 * "grade"). No impacto, um remendo de malha fina infla no formato da bola (mola
 * amortecida) sobre um bolsão escuro — a física bola+rede de forma estilizada.
 *
 * CSS puro + SVG, sem dependências. Reinicia ao montar.
 */

// --- Geometria da rede (em coordenadas do viewBox 640x380) ---
// Quad do plano da rede: trapézio recuando para a direita.
const QUAD = {
  tl: [70, 64] as const, // topo-esquerda (perto, alto)
  tr: [566, 120] as const, // topo-direita (longe)
  br: [566, 250] as const, // base-direita (longe)
  bl: [70, 312] as const, // base-esquerda (perto)
};

// Homografia: quadrado unitário (0,0)(1,0)(1,1)(0,1) -> quad (tl,tr,br,bl).
function makeProjector() {
  const [x0, y0] = QUAD.tl;
  const [x1, y1] = QUAD.tr;
  const [x2, y2] = QUAD.br;
  const [x3, y3] = QUAD.bl;
  const dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return (u: number, v: number): [number, number] => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}
const project = makeProjector();

const COLS = 17;
const ROWS = 10;
const vLines = Array.from({ length: COLS + 1 }, (_, i) => {
  const u = i / COLS;
  return { p1: project(u, 0), p2: project(u, 1) };
});
const hLines = Array.from({ length: ROWS + 1 }, (_, j) => {
  const v = j / ROWS;
  return { p1: project(0, v), p2: project(1, v) };
});

// Ponto de impacto (onde a bola crava): u,v -> coords de tela.
const IMPACT = project(0.4, 0.52);
const [IX, IY] = IMPACT;
const BALL = 104;

const TriondaNetAnimation: React.FC = () => {
  return (
    <div className="netv2-stage">
      <style>{`
        .netv2-stage {
          position: relative;
          width: 100%;
          max-width: 640px;
          height: 380px;
          margin: 0 auto;
          overflow: hidden;
          border-radius: 24px;
          background:
            radial-gradient(38% 30% at 62% -4%, rgba(219,234,254,.65) 0%, transparent 62%),
            radial-gradient(75% 65% at 78% 75%, #0c1f4a 0%, transparent 72%),
            linear-gradient(150deg, #14264f 0%, #0a1430 48%, #050b1c 100%);
        }
        .netv2-stage::after {
          content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 24%;
          background: linear-gradient(to top, rgba(2,6,20,.65), transparent);
        }
        .netv2-svg { position: absolute; inset: 0; width: 100%; height: 100%; }

        /* rede entra suave; balança no impacto */
        .nv-net { animation: nvNetIn .5s ease-out both, nvNetWobble 1.1s ease-out .78s both; }
        @keyframes nvNetIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes nvNetWobble {
          0%,100% { transform: translateX(0) scaleX(1); }
          25% { transform: translateX(-3px) scaleX(.992); }
          55% { transform: translateX(2px) scaleX(1.006); }
          80% { transform: translateX(-1px); }
        }

        /* bolsão escuro (profundidade) — mola */
        .nv-pocket {
          transform-box: fill-box; transform-origin: center;
          opacity: 0; transform: scale(.2);
          animation: nvPocket 1.35s cubic-bezier(.22,.68,.3,1) .78s both;
        }
        @keyframes nvPocket {
          0% { opacity: 0; transform: scale(.2); }
          10% { opacity: 1; }
          34% { transform: scale(1.5,1.34); }
          54% { transform: scale(.92,.96); }
          70% { transform: scale(1.16,1.08); }
          100% { opacity: 1; transform: scale(1.05); }
        }

        /* remendo de malha fina que infla (estufa) — mesma mola */
        .nv-bulge {
          transform-box: fill-box; transform-origin: center;
          opacity: 0; transform: scale(.12);
          animation: nvBulge 1.35s cubic-bezier(.22,.68,.3,1) .78s both;
        }
        @keyframes nvBulge {
          0% { opacity: 0; transform: scale(.12); }
          7% { opacity: 1; }
          34% { transform: scale(1.55,1.4); }   /* estufa fundo, alongado */
          54% { transform: scale(.9,.95); }
          70% { transform: scale(1.18,1.09); }
          84% { transform: scale(.97,.99); }
          100% { opacity: .92; transform: scale(1.06); }
        }

        /* bola voando da esquerda, crava e afunda */
        .nv-ball {
          transform-box: fill-box; transform-origin: center;
          will-change: transform, filter;
          animation: nvBall 1.15s cubic-bezier(.2,.66,.26,1) both;
        }
        @keyframes nvBall {
          0%   { opacity: 0; transform: translate(-340px,-46px) scale(.42) rotate(-30deg);
                 filter: drop-shadow(0 10px 18px rgba(0,0,0,.55)); }
          12%  { opacity: 1; }
          56%  { transform: translate(0,0) scale(1.04) rotate(150deg); }    /* impacto */
          72%  { transform: translate(10px,7px) scale(.95) rotate(166deg); } /* afunda */
          86%  { transform: translate(4px,3px) scale(1) rotate(170deg); }
          100% { transform: translate(8px,5px) scale(.97) rotate(172deg); }
        }

        .nv-flash {
          transform-box: fill-box; transform-origin: center;
          opacity: 0; animation: nvFlash .4s ease-out .78s both;
        }
        @keyframes nvFlash { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
      `}</style>

      <svg className="netv2-svg" viewBox="0 0 640 380" preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* malha fina (uniforme) para o remendo do estufamento */}
          <pattern id="nvFine" width="9" height="9" patternUnits="userSpaceOnUse">
            <path d="M9 0 H0 V9" fill="none" stroke="rgba(226,240,255,.9)" strokeWidth="0.8" />
          </pattern>
          {/* máscara radial p/ esfumar o remendo nas bordas */}
          <radialGradient id="nvFade">
            <stop offset="55%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="nvBulgeMask">
            <circle cx={IX} cy={IY} r="92" fill="url(#nvFade)" />
          </mask>
        </defs>

        {/* REDE em perspectiva (linhas convergentes) + trave */}
        <g className="nv-net">
          {vLines.map((l, i) => (
            <line key={"v" + i} x1={l.p1[0]} y1={l.p1[1]} x2={l.p2[0]} y2={l.p2[1]}
                  stroke="rgba(200,222,255,.42)" strokeWidth="0.9" />
          ))}
          {hLines.map((l, j) => (
            <line key={"h" + j} x1={l.p1[0]} y1={l.p1[1]} x2={l.p2[0]} y2={l.p2[1]}
                  stroke="rgba(200,222,255,.42)" strokeWidth="0.9" />
          ))}
          {/* trave (contorno do gol) */}
          <polygon
            points={`${QUAD.tl[0]},${QUAD.tl[1]} ${QUAD.tr[0]},${QUAD.tr[1]} ${QUAD.br[0]},${QUAD.br[1]} ${QUAD.bl[0]},${QUAD.bl[1]}`}
            fill="none" stroke="#eef2f7" strokeWidth="5" strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(226,240,255,.4))" }}
          />
        </g>

        {/* BOLSÃO (profundidade) */}
        <ellipse className="nv-pocket" cx={IX} cy={IY} rx="78" ry="78"
                 fill="rgba(2,6,20,.62)" />

        {/* ESTUFAMENTO (remendo de malha que infla) */}
        <rect className="nv-bulge" x={IX - 92} y={IY - 92} width="184" height="184"
              fill="url(#nvFine)" mask="url(#nvBulgeMask)" />

        {/* FLASH */}
        <circle className="nv-flash" cx={IX} cy={IY} r="120" fill="url(#nvFade)" opacity="0.5" />

        {/* BOLA (trionda) */}
        <image className="nv-ball" href="/trionda.svg" x={IX - BALL / 2} y={IY - BALL / 2}
               width={BALL} height={BALL} />
      </svg>
    </div>
  );
};

export default TriondaNetAnimation;
