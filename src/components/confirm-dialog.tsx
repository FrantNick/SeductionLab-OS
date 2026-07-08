"use client";

import { useRef, useState, useTransition } from "react";

/**
 * Confirmation modal for destructive actions. Wraps a server action:
 *
 *   <ConfirmAction
 *     action={banAffiliate.bind(null, id)}
 *     title="Ban affiliate?"
 *     description="They immediately lose access."
 *     confirmLabel="Ban"
 *   >
 *     <span className="btn-ghost text-red-400">Ban</span>
 *   </ConfirmAction>
 */
export function ConfirmAction({
  action,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  children,
}: {
  action: () => Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  function confirm() {
    startTransition(async () => {
      await action();
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="contents">
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="card w-full max-w-sm p-5"
          >
            <h3 className="font-heading text-base font-bold text-ink">{title}</h3>
            {description && <p className="mt-2 text-sm text-ink-2">{description}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={confirm}
                disabled={pending}
                className={
                  destructive
                    ? "inline-flex items-center justify-center gap-2 rounded-brutal border-brutal border-line bg-rust px-4 py-2 font-heading text-sm font-bold text-white shadow-hard-sm transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-rust-bright hover:shadow-none disabled:opacity-50"
                    : "btn-primary"
                }
              >
                {pending ? "Working…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
