"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

/**
 * Binds an unused tracking link to a thread that has none — needed only
 * for threads submitted before per-thread links existed. New threads are
 * bound at submission time.
 */
export function LinkThreadForm({
  threadId,
  options,
}: {
  threadId: string;
  options: { id: string; slug: string; url: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [trackingLinkId, setTrackingLinkId] = useState(options[0]?.id ?? "");
  const [loading, setLoading] = useState(false);

  async function bind(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingLinkId) return;
    setLoading(true);
    try {
      await api.post(`/api/threads/${threadId}/link`, { trackingLinkId });
      toast({
        kind: "success",
        title: "Tracking link bound",
        description: "This thread's clicks and sales now attribute exactly.",
      });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Could not bind link", description: errorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No unused links in this campaign — create one under Tracking links first.
      </p>
    );
  }

  return (
    <form onSubmit={bind} className="flex flex-wrap items-center gap-3">
      <select
        className="input max-w-md flex-1"
        value={trackingLinkId}
        onChange={(e) => setTrackingLinkId(e.target.value)}
        aria-label="Tracking link to bind"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.slug} — {o.url}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-primary" disabled={loading || !trackingLinkId}>
        {loading ? "Binding…" : "Bind link"}
      </button>
    </form>
  );
}
