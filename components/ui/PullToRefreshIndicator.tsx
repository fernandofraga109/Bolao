import React from "react";
import { RefreshCw } from "lucide-react";

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
}

const THRESHOLD = 40; // distance at which icon fully appears

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
}) => {
  const opacity = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = Math.min((pullDistance / THRESHOLD) * 180, 180);
  const visible = isRefreshing || pullDistance > 0;

  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center py-3 transition-all duration-150"
      style={{ opacity }}
    >
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 shadow-lg">
        <RefreshCw
          size={14}
          className={`text-brand-green ${isRefreshing ? "animate-spin" : "transition-transform duration-150"}`}
          style={isRefreshing ? undefined : { transform: `rotate(${rotation}deg)` }}
        />
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
          {isRefreshing ? "Atualizando..." : "Soltar para atualizar"}
        </span>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
