"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Feedback after an action, because the app had none: you clicked approve and
// the row vanished, which is indistinguishable from a crash.
//
// Own implementation rather than a library: this is a list, a timer and a
// region, and the accessibility part (a polite live region that is not
// re-announced on every render) is the only subtle bit.

const LIFETIME = 4000;

type Tone = "done" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/** show("Entry added to the project context") after anything that writes. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "done") => {
    // Date.now() is unique enough here and survives two toasts in one tick
    // because the counter falls back to the array length.
    setToasts((prev) => [...prev, { id: Date.now() + prev.length, message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        // polite, not assertive: this reports the result of something the reader
        // just did, so it waits for a gap rather than interrupting.
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((toast) => (
          <ToastRow
            key={toast.id}
            toast={toast}
            onDone={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, LIFETIME);
    return () => clearTimeout(timer);
    // onDone closes over a filter by id, which is stable for this toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <div
      className={`pointer-events-auto flex max-w-[520px] items-center gap-3 rounded-card border px-6 py-4 text-small shadow-lifted ${
        toast.tone === "error"
          ? "border-iron/40 bg-surface text-iron"
          : "border-hairline bg-surface text-ink"
      }`}
    >
      {/* A dot, not an icon: the sentence carries the meaning and the colour
          only says which of the two kinds this is. */}
      <span
        aria-hidden="true"
        className={`h-[6px] w-[6px] shrink-0 rounded-pill ${toast.tone === "error" ? "bg-iron" : "bg-blue"}`}
      />
      {toast.message}
    </div>
  );
}
