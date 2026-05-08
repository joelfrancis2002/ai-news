import { useEffect } from "react";
import { useToast } from "../context/ToastContext";

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} type={toast.type} onRemove={removeToast} />
      ))}
    </div>
  );
}

function ToastItem({
  id,
  message,
  type,
  onRemove,
}: {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  onRemove: (id: string) => void;
}) {
  useEffect(() => {
    return () => {};
  }, []);

  const colors = {
    success: "bg-emerald-600 border-emerald-500",
    error: "bg-rose-600 border-rose-500",
    info: "bg-blue-600 border-blue-500",
  };

  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-white shadow-xl ${colors[type]} animate-in slide-in-from-bottom-2 duration-200`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
        {icons[type]}
      </span>
      <span>{message}</span>
      <button
        onClick={() => onRemove(id)}
        className="ml-2 text-white/60 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
