import React from "react";

interface DualActionButtonsProps {
  secondaryLabel: React.ReactNode;
  primaryLabel: React.ReactNode;
  onSecondary: () => void;
  onPrimary: () => void;
  secondaryDisabled?: boolean;
  primaryDisabled?: boolean;
  containerClassName?: string;
  secondaryClassName?: string;
  primaryClassName?: string;
}

const DualActionButtons: React.FC<DualActionButtonsProps> = ({
  secondaryLabel,
  primaryLabel,
  onSecondary,
  onPrimary,
  secondaryDisabled = false,
  primaryDisabled = false,
  containerClassName = "flex gap-3",
  secondaryClassName = "flex-1 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm transition-colors",
  primaryClassName = "flex-1 py-3 rounded-lg bg-brand-green hover:bg-emerald-400 text-slate-900 font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
}) => {
  return (
    <div className={containerClassName}>
      <button
        onClick={onSecondary}
        disabled={secondaryDisabled}
        className={secondaryClassName}
      >
        {secondaryLabel}
      </button>
      <button
        onClick={onPrimary}
        disabled={primaryDisabled}
        className={primaryClassName}
      >
        {primaryLabel}
      </button>
    </div>
  );
};

export default DualActionButtons;
