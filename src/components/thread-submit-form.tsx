"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ThreadSubmitForm({
  campaigns,
}: {
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, twitterUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setTwitterUrl("");
      setMessage({
        kind: "ok",
        text:
          data.initialScrape === "ok"
            ? "Thread submitted — metrics scraped."
            : data.initialScrape === "failed"
              ? "Thread submitted. Initial scrape failed; the 6-hour job will retry."
              : "Thread submitted. Metrics will populate when Apify is configured.",
      });
      router.refresh();
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Submission failed",
      });
    } finally {
      setLoading(false);
    }
  }

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        You have no active campaign assignments yet — ask an admin to assign you to a campaign.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Campaign</label>
        <select
          className="input"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        >
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Thread URL</label>
        <input
          className="input"
          type="url"
          required
          placeholder="https://x.com/yourhandle/status/1234567890"
          value={twitterUrl}
          onChange={(e) => setTwitterUrl(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={loading || !campaignId}>
        {loading ? "Submitting…" : "Submit thread"}
      </button>
      {message && (
        <p className={`text-xs ${message.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
