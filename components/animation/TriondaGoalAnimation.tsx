import React from "react";

/**
 * Animação de gol usando a bola oficial (trionda.svg) entrando no gol.
 *
 * Tudo em CSS puro (keyframes inline) — sem dependências. A animação reinicia
 * sempre que o componente é montado, então o preview remonta via `key`.
 *
 * Este é o componente candidato à integração real: quando a API retornar um
 * gol durante uma partida ao vivo, montamos isto como overlay por ~2.5s.
 */
const TriondaGoalAnimation: React.FC = () => {
  return (
    <div className="trionda-stage">
      <style>{`
        .trionda-stage {
          position: relative;
          width: 100%;
          max-width: 640px;
          height: 380px;
          margin: 0 auto;
          overflow: hidden;
          border-radius: 24px;
          background:
            radial-gradient(120% 80% at 50% 120%, #14532d 0%, #052e16 55%, #021609 100%);
          box-shadow: inset 0 0 120px rgba(0,0,0,.6);
        }
        /* Gramado: linhas claras */
        .trionda-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            90deg,
            rgba(255,255,255,.03) 0 40px,
            rgba(255,255,255,.06) 40px 80px
          );
        }

        /* ---- GOL ---- */
        .tg-goal {
          position: absolute;
          right: 24px;
          bottom: 40px;
          width: 300px;
          height: 210px;
          z-index: 2;
        }
        .tg-net {
          position: absolute;
          inset: 0;
          border: 6px solid #f8fafc;
          border-bottom: none;
          border-radius: 4px 4px 0 0;
          background-image:
            linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px);
          background-size: 18px 18px;
          box-shadow: inset 0 0 30px rgba(0,0,0,.35);
          transform-origin: center bottom;
        }
        .tg-net.shake {
          animation: netShake .55s ease-out .78s both;
        }
        @keyframes netShake {
          0%   { transform: scale(1, 1); }
          25%  { transform: scale(1.015, .965); }
          50%  { transform: scale(.99, 1.02); }
          75%  { transform: scale(1.008, .99); }
          100% { transform: scale(1, 1); }
        }

        /* ---- BOLA (trionda) ---- */
        .tg-ball {
          position: absolute;
          left: 30px;
          bottom: 34px;
          width: 70px;
          height: 70px;
          z-index: 3;
          will-change: transform, opacity;
          animation: triondaFly .85s linear both;
          filter: drop-shadow(0 8px 14px rgba(0,0,0,.5));
        }
        .tg-ball img { width: 100%; height: 100%; display: block; }
        /* Trajetória reta e em velocidade constante (sem pausa no meio do caminho).
           O ponto a 55% fica praticamente sobre a reta — só uma curvatura sutil. */
        @keyframes triondaFly {
          0%   { transform: translate(0,0) rotate(0deg) scale(.55);   opacity: 0; }
          12%  { opacity: 1; }
          55%  { transform: translate(224px,-52px) rotate(520deg) scale(.9); }
          100% { transform: translate(408px,-66px) rotate(900deg) scale(.8); }
        }

        /* ---- FLASH no impacto ---- */
        .tg-flash {
          position: absolute; inset: 0; z-index: 4;
          background: radial-gradient(circle at 78% 45%, rgba(255,255,255,.7), transparent 45%);
          opacity: 0;
          animation: tgFlash .4s ease-out .74s both;
          pointer-events: none;
        }
        @keyframes tgFlash { 0%{opacity:0} 20%{opacity:1} 100%{opacity:0} }

        /* ---- TEXTO GOOOOL ---- */
        .tg-text {
          position: absolute;
          left: 50%; top: 38%;
          transform: translate(-50%, -50%) scale(.3);
          z-index: 5;
          font-weight: 900;
          font-style: italic;
          letter-spacing: .06em;
          font-size: 64px;
          color: #10b981;
          text-shadow: 0 0 24px rgba(16,185,129,.7), 0 4px 0 #064e3b;
          opacity: 0;
          animation: golText .6s cubic-bezier(.2,1.4,.4,1) .8s both;
          white-space: nowrap;
        }
        @keyframes golText {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(.3); }
          60%  { opacity: 1; transform: translate(-50%,-50%) scale(1.12); }
          100% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }

        /* ---- CONFETE ---- */
        .tg-confetti {
          position: absolute; left: 50%; top: 35%;
          width: 10px; height: 14px; border-radius: 2px;
          z-index: 4; opacity: 0;
          animation: confetti 1.1s ease-out 1.2s both;
        }
        @keyframes confetti {
          0%   { opacity: 0; transform: translate(0,0) rotate(0deg); }
          15%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(540deg); }
        }
      `}</style>

      {/* Gol */}
      <div className="tg-goal">
        <div className="tg-net shake" />
      </div>

      {/* Bola trionda */}
      <div className="tg-ball">
        <img src="/trionda.svg" alt="Bola" />
      </div>

      {/* Efeitos de impacto */}
      <div className="tg-flash" />
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="tg-confetti"
          style={{
            background: c.color,
            // @ts-expect-error CSS custom props
            "--dx": `${c.dx}px`,
            "--dy": `${c.dy}px`,
            animationDelay: `${0.8 + c.delay}s`,
          }}
        />
      ))}

      {/* GOOOOL */}
      <div className="tg-text">G&nbsp;O&nbsp;O&nbsp;O&nbsp;L&nbsp;!</div>
    </div>
  );
};

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#ffffff"];
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  color: COLORS[i % COLORS.length],
  dx: Math.round((Math.random() - 0.5) * 360),
  dy: Math.round(120 + Math.random() * 180),
  delay: Math.random() * 0.25,
}));

export default TriondaGoalAnimation;
