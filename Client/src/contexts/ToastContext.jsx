import { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 4200;

const typeClassMap = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-slate-200 bg-white text-slate-900",
};

const makeToastId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeToast = (input) => {
  if (typeof input === "string") {
    return {
      type: "info",
      title: "Notice",
      message: input,
      duration: DEFAULT_DURATION,
    };
  }

  return {
    type: input?.type || "info",
    title: input?.title || "Notice",
    message: input?.message || "",
    duration:
      typeof input?.duration === "number" && input.duration >= 0
        ? input.duration
        : DEFAULT_DURATION,
  };
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((toastId) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback(
    (input) => {
      const normalized = normalizeToast(input);
      const id = makeToastId();
      const toast = {
        id,
        ...normalized,
      };

      setToasts((current) => [toast, ...current].slice(0, MAX_TOASTS));

      if (toast.duration > 0) {
        window.setTimeout(() => {
          removeToast(id);
        }, toast.duration);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message, title = "Success") =>
      showToast({
        type: "success",
        title,
        message,
      }),
    [showToast]
  );

  const error = useCallback(
    (message, title = "Action failed") =>
      showToast({
        type: "error",
        title,
        message,
        duration: 5200,
      }),
    [showToast]
  );

  const warning = useCallback(
    (message, title = "Check required") =>
      showToast({
        type: "warning",
        title,
        message,
      }),
    [showToast]
  );

  const info = useCallback(
    (message, title = "Notice") =>
      showToast({
        type: "info",
        title,
        message,
      }),
    [showToast]
  );

  const value = useMemo(
    () => ({
      showToast,
      removeToast,
      success,
      error,
      warning,
      info,
    }),
    [showToast, removeToast, success, error, warning, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed right-4 top-4 z-[1100] flex w-[min(92vw,420px)] flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`pointer-events-auto rounded-xl border p-3 shadow-lg backdrop-blur ${
              typeClassMap[toast.type] || typeClassMap.info
            }`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message ? <p className="mt-1 text-sm opacity-90">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-md border border-current px-2 py-0.5 text-xs font-semibold opacity-70 hover:opacity-100"
                aria-label="Close notification"
              >
                x
              </button>
            </div>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
};
