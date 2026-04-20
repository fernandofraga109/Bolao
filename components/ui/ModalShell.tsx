import React from "react";
import { X } from "lucide-react";

interface ModalShellProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  onClose?: () => void;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
  panelClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  showCloseButton?: boolean;
}

const ModalShell: React.FC<ModalShellProps> = ({
  children,
  title,
  onClose,
  footer,
  maxWidthClassName = "max-w-md",
  panelClassName = "bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl",
  contentClassName = "p-4",
  footerClassName = "px-4 pb-4",
  showCloseButton = true,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full ${maxWidthClassName} ${panelClassName} relative`}>
        {(title || (showCloseButton && onClose)) && (
          <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center rounded-t-2xl">
            <div className="font-bold text-white text-lg">{title}</div>
            {showCloseButton && onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-slate-700 text-slate-400 transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className={contentClassName}>{children}</div>

        {footer != null && <div className={footerClassName}>{footer}</div>}
      </div>
    </div>
  );
};

export default ModalShell;
