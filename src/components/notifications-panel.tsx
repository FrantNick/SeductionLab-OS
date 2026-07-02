"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";

type Item = {
  id: string;
  kind: "SUCCESS" | "WARNING" | "ERROR" | "INFO";
  title: string;
  body: string;
  href: string | null;
  readAt: string | Date | null;
  createdAt: string | Date;
};

const KIND_DOTS: Record<Item["kind"], string> = {
  SUCCESS: "bg-emerald-500",
  WARNING: "bg-amber-500",
  ERROR: "bg-red-500",
  INFO: "bg-sky-500",
};

export function NotificationsPanel({ items }: { items: Item[] }) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);
  const unread = items.filter((n) => !n.readAt).length;

  async function markAllRead() {
    setMarking(true);
    try {
      await api.post("/api/notifications");
      router.refresh();
    } finally {
      setMarking(false);
    }
  }

  if (items.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-zinc-500">
        No notifications yet — activity lands here.
      </p>
    );
  }

  return (
    <div>
      {unread > 0 && (
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-2">
          <span className="text-xs text-zinc-500">{unread} unread</span>
          <button onClick={markAllRead} disabled={marking} className="btn-ghost">
            {marking ? "…" : "Mark all read"}
          </button>
        </div>
      )}
      <ul className="max-h-80 divide-y divide-ink-800 overflow-y-auto">
        {items.map((n) => {
          const inner = (
            <div className="flex items-start gap-2.5 px-5 py-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOTS[n.kind]}`} />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${n.readAt ? "text-zinc-400" : "font-medium text-zinc-200"}`}
                >
                  {n.title}
                </p>
                {n.body && <p className="mt-0.5 truncate text-xs text-zinc-500">{n.body}</p>}
              </div>
              <span className="shrink-0 text-[11px] text-zinc-600">{timeAgo(n.createdAt)}</span>
            </div>
          );
          return (
            <li key={n.id} className="transition-colors hover:bg-ink-800/40">
              {n.href ? <Link href={n.href}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
