"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * V1 manual revenue entry (admin) — posts to /api/conversions/manual.
 */
export function ConversionForm({
  affiliates,
  campaigns,
}: {
  affiliates: { id: string; displayName: string }[];
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [affiliateId, setAffiliateId] = useState(affiliates[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [revenue, setRevenue] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/conversions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliateId, campaignId, revenue: Number(revenue) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to record conversion");
      setRevenue("");
      setMessage({ kind: "ok", text: "Conversion recorded." });
      router.refresh();
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Failed to record conversion",
      });
    } finally {
      setLoading(false);
    }
  }

  if (affiliates.length === 0 || campaigns.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        You need at least one affiliate and one campaign before recording revenue.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Affiliate</label>
        <select className="input" value={affiliateId} onChange={(e) => setAffiliateId(e.target.value)}>
          {affiliates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Campaign</label>
        <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Revenue (USD)</label>
        <input
          className="input num"
          type="number"
          min="0.01"
          step="0.01"
          required
          placeholder="49.00"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
        />
      </div>
      <div className="flex items-end">
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Saving…" : "Record sale"}
        </button>
      </div>
      {message && (
        <p
          className={`sm:col-span-4 text-xs ${
            message.kind === "ok" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
