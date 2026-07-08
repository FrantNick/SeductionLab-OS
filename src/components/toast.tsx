"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

/**
 * App-wide toast notifications (Part 5). Wrap the app in <ToastProvider>
 * and call useToast() from any client component:
 *
 *   const { toast } = useToast();
 *   toast({ kind: "success", title: "Link copied" });
 */

export type ToastKind = "success" | "warning" | "error" | "info";

export type ToastInput = {
  kind?: ToastKind;
  title: string;
  description?: string;
  durationMs?: number;
};

type ToastItem = Required<Omit<ToastInput, "durationMs">> & { id: number };

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// solid brutalist toasts: colored slab, white text, hard shadow
const KIND_STYLES: Record<ToastKind, { surface: string; icon: string }> = {
  success: { surface: "bg-pos", icon: "✓" },
  warning: { surface: "bg-rust", icon: "!" },
  error: { surface: "bg-rust", icon: "✕" },
  info: { surface: "bg-ink", icon: "i" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current.slice(-3), // cap the stack at 4
        { id, kind: input.kind ?? "info", title: input.title, description: input.description ?? "" },
      ]);
      setTimeout(() => dismiss(id), input.durationMs ?? 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => {
          const style = KIND_STYLES[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex overflow-hidden rounded-brutal-lg border-brutal border-line shadow-hard-sm ${style.surface}`}
            >
              <span className="flex w-9 shrink-0 items-center justify-center border-r border-white/25 font-mono text-sm font-bold text-white">
                {style.icon}
              </span>
              <div className="flex-1 px-3 py-2.5">
                <p className="font-heading text-sm font-bold text-white">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-white/85">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="px-3 text-white/70 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
