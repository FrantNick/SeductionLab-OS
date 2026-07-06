"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

/** Edit a thread's name/description after submission (owner only). */
export function ThreadMetaForm({
  threadId,
  initialName,
  initialDescription,
}: {
  threadId: string;
  initialName: string | null;
  initialDescription: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [threadName, setThreadName] = useState(initialName ?? "");
  const [threadDescription, setThreadDescription] = useState(initialDescription ?? "");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/threads/${threadId}`, { threadName, threadDescription });
      toast({ kind: "success", title: "Thread details saved" });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Could not save", description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3">
      <div>
        <label htmlFor="meta-name" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Thread name
        </label>
        <input
          id="meta-name"
          className="input"
          maxLength={120}
          placeholder="Give this thread a short name"
          value={threadName}
          onChange={(e) => setThreadName(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="meta-desc" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Description
        </label>
        <textarea
          id="meta-desc"
          className="input min-h-20"
          maxLength={2000}
          placeholder="Notes — angle, hook variant, what you're testing…"
          value={threadDescription}
          onChange={(e) => setThreadDescription(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-secondary w-fit" disabled={saving}>
        {saving ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
