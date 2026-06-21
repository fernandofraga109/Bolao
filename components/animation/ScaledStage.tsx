import React, { useLayoutEffect, useRef, useState } from "react";

const DESIGN_W = 640;
const DESIGN_H = 380;

/**
 * Renderiza a cena no tamanho de design (640×380) e a ESCALA para caber na
 * largura do container, mantendo a proporção. Resolve o corte das animações em
 * telas estreitas (as cenas usam coordenadas fixas em px desenhadas p/ 640).
 */
const ScaledStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / DESIGN_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ width: "100%", aspectRatio: `${DESIGN_W} / ${DESIGN_H}`, overflow: "hidden" }}
    >
      <div
        style={{
          width: DESIGN_W,
          height: DESIGN_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScaledStage;
