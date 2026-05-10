import React, { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle2, AlertTriangle, XCircle, X, RefreshCw } from "lucide-react";

export type SyncToastVariant = "success" | "warning" | "error" | "syncing";

export interface SyncToastItem {
  id: string;
  competitionCode: string;
  competitionName?: string;
  variant: SyncToastVariant;
  message?: string;
  timestamp: number;
}

interface SyncToastProps {
  toasts: SyncToastItem[];
  onDismiss: (id: string) => void;
}

const VARIANT_CONFIG: Record<
  SyncToastVariant,
  { icon: React.ReactNode; border: string; bg: string; label: string; dot: string }
> = {
  success: {
    icon: <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />,
    border: "border-emerald-500/40",
    bg: "bg-emerald-900/30",
    label: "Sincronizado",
    dot: "bg-emerald-400",
  },
  warning: {
    icon: <AlertTriangle size={15} className="text-amber-400 shrink-0" />,
    border: "border-amber-500/40",
    bg: "bg-amber-900/30",
    label: "Alerta",
    dot: "bg-amber-400",
  },
  error: {
    icon: <XCircle size={15} className="text-red-400 shrink-0" />,
    border: "border-red-500/40",
    bg: "bg-red-900/30",
    label: "Falha",
    dot: "bg-red-400",
  },
  syncing: {
    icon: <RefreshCw size={15} className="text-blue-400 shrink-0 animate-spin" />,
    border: "border-blue-500/30",
    bg: "bg-blue-900/20",
    label: "Sincronizando",
    dot: "bg-blue-400",
  },
};

const AUTO_DISMISS_MS: Record<SyncToastVariant, number> = {
  success: 4000,
  warning: 6000,
  error: 8000,
  syncing: 0, // não auto-dismissar enquanto sincroniza
};

const SyncToastCard: React.FC<{
  toast: SyncToastItem;
  onDismiss: () => void;
}> = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const config = VARIANT_CONFIG[toast.variant];
  const dismissMs = AUTO_DISMISS_MS[toast.variant];

  useEffect(() => {
    // Animate in
    const t1 = setTimeout(() => setVisible(true), 10);

    // Auto-dismiss
    let t2: ReturnType<typeof setTimeout> | undefined;
    if (dismissMs > 0) {
      t2 = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, dismissMs);
    }

    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [dismissMs, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`
        flex items-start gap-2.5 px-3 py-2.5 rounded-xl border backdrop-blur-sm
        shadow-lg shadow-black/40 transition-all duration-300
        ${config.bg} ${config.border}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
      style={{ minWidth: 220, maxWidth: 300 }}
    >
      {/* Dot indicator */}
      <span
        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${config.dot} ${
          toast.variant === "syncing" ? "animate-pulse" : ""
        }`}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {config.icon}
          <span className="text-xs font-bold text-white tracking-wide">
            {toast.competitionName || toast.competitionCode}
          </span>
          <span className="text-[10px] text-slate-400 font-mono uppercase ml-auto">
            {config.label}
          </span>
        </div>
        {toast.message && (
          <p className="text-[11px] text-slate-300 mt-0.5 leading-tight line-clamp-2">
            {toast.message}
          </p>
        )}
      </div>

      {/* Dismiss button (não mostrar para syncing) */}
      {toast.variant !== "syncing" && (
        <button
          onClick={handleDismiss}
          className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

export const SyncToastContainer: React.FC<SyncToastProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 right-3 z-50 flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
      aria-label="Notificações de sincronização"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <SyncToastCard toast={toast} onDismiss={() => onDismiss(toast.id)} />
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// useSyncToast — hook para gerenciar o estado dos toasts
// ---------------------------------------------------------------------------
let toastIdCounter = 0;

export const useSyncToast = () => {
  const [toasts, setToasts] = useState<SyncToastItem[]>([]);
  const syncingIdsRef = useRef<Map<string, string>>(new Map()); // code → toast id

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showSyncing = useCallback(
    (competitionCode: string, competitionName?: string) => {
      // Remove toast anterior da mesma competição
      const existingId = syncingIdsRef.current.get(competitionCode);
      if (existingId) {
        setToasts((prev) => prev.filter((t) => t.id !== existingId));
      }

      const id = `toast-${++toastIdCounter}`;
      syncingIdsRef.current.set(competitionCode, id);

      setToasts((prev) => [
        ...prev,
        {
          id,
          competitionCode,
          competitionName,
          variant: "syncing",
          timestamp: Date.now(),
        },
      ]);

      return id;
    },
    []
  );

  const showResult = useCallback(
    (
      competitionCode: string,
      success: boolean,
      message?: string,
      competitionName?: string
    ) => {
      // Remove o "syncing" desta competição
      const syncingId = syncingIdsRef.current.get(competitionCode);
      if (syncingId) {
        setToasts((prev) => prev.filter((t) => t.id !== syncingId));
        syncingIdsRef.current.delete(competitionCode);
      }

      const id = `toast-${++toastIdCounter}`;
      const variant: SyncToastVariant = success ? "success" : "error";

      setToasts((prev) => [
        ...prev,
        {
          id,
          competitionCode,
          competitionName,
          variant,
          message,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  const showWarning = useCallback(
    (
      competitionCode: string,
      message: string,
      competitionName?: string
    ) => {
      // Remove o "syncing" desta competição, igual ao showResult
      const syncingId = syncingIdsRef.current.get(competitionCode);
      if (syncingId) {
        setToasts((prev) => prev.filter((t) => t.id !== syncingId));
        syncingIdsRef.current.delete(competitionCode);
      }

      const id = `toast-${++toastIdCounter}`;
      setToasts((prev) => [
        ...prev,
        {
          id,
          competitionCode,
          competitionName,
          variant: "warning",
          message,
          timestamp: Date.now(),
        },
      ]);
    },
    []
  );

  return { toasts, dismiss, showSyncing, showResult, showWarning };
};
