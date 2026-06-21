import React from "react";

interface CardAnimationProps {
  variant: "yellow" | "red";
}

/**
 * Animação de cartão (amarelo/vermelho) — o cartão sobe da base, com um leve
 * flip e overshoot, como o árbitro erguendo. O vermelho ganha um tremor extra e
 * brilho mais intenso. Usa os assets /yellow-card.svg e /red-card.svg.
 *
 * CSS puro, sem dependências. Reinicia ao montar (preview remonta via `key`).
 */
const CardAnimation: React.FC<CardAnimationProps> = ({ variant }) => {
  const glow = variant === "yellow" ? "rgba(245,158,11,.55)" : "rgba(239,68,68,.55)";
  const src = variant === "yellow" ? "/yellow-card.svg" : "/red-card.svg";
  const label = variant === "yellow" ? "Cartão Amarelo" : "Cartão Vermelho";

  return (
    <div className="card-stage">
      <style>{`
        .card-stage {
          position: relative;
          width: 100%;
          max-width: 640px;
          height: 380px;
          margin: 0 auto;
          overflow: hidden;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(60% 55% at 50% 38%, #1f2937 0%, transparent 65%),
            linear-gradient(160deg, #111827 0%, #030712 100%);
          perspective: 900px;
        }
        /* Brilho pulsante atrás do cartão */
        .card-glow {
          position: absolute;
          width: 360px; height: 360px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--glow) 0%, transparent 65%);
          opacity: 0;
          animation: cardGlow .6s ease-out .25s both;
        }
        @keyframes cardGlow { to { opacity: 1; } }

        .card-wrap {
          position: relative;
          z-index: 2;
          transform-style: preserve-3d;
          will-change: transform;
          filter: drop-shadow(0 18px 30px rgba(0,0,0,.6));
        }
        .card-wrap img {
          width: 168px;
          height: auto;
          display: block;
        }

        /* Sobe da base com flip + overshoot */
        .card-raise {
          animation: cardRaise .72s cubic-bezier(.2,.9,.3,1.1) both;
        }
        @keyframes cardRaise {
          0%   { opacity: 0; transform: translateY(190px) rotateY(-95deg) rotateZ(-14deg) scale(.6); }
          22%  { opacity: 1; }
          60%  { transform: translateY(-14px) rotateY(0deg) rotateZ(5deg) scale(1.06); }
          78%  { transform: translateY(5px) rotateZ(-2deg) scale(1); }
          100% { transform: translateY(0) rotateZ(0deg) scale(1); }
        }

        .card-flash {
          position: absolute; inset: 0; z-index: 3; pointer-events: none;
          background: radial-gradient(circle at 50% 42%, rgba(255,255,255,.45), transparent 40%);
          opacity: 0;
          animation: cardFlash .4s ease-out .3s both;
        }
        @keyframes cardFlash { 0%{opacity:0} 30%{opacity:1} 100%{opacity:0} }
      `}</style>

      <div className="card-glow" style={{ ["--glow" as any]: glow }} />
      <div className="card-wrap card-raise">
        <img src={src} alt={label} />
      </div>
      <div className="card-flash" />
    </div>
  );
};

export default CardAnimation;
