"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import { useToast } from "@/components/toast";

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
  const { toast } = useToast();
  const [affiliateId, setAffiliateId] = useState(affiliates[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [revenue, setRevenue] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/conversions/manual", {
        affiliateId,
        campaignId,
        revenue: Number(revenue),
      });
      setRevenue("");
      toast({ kind: "success", title: "Conversion recorded" });
      router.refresh();
    } catch (err) {
      toast({ kind: "error", title: "Could not record sale", description: errorMessage(err) });
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
        <label htmlFor="conv-affiliate" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Affiliate
        </label>
        <select
          id="conv-affiliate"
          className="input"
          value={affiliateId}
          onChange={(e) => setAffiliateId(e.target.value)}
        >
          {affiliates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="conv-campaign" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Campaign
        </label>
        <select
          id="conv-campaign"
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
        <label htmlFor="conv-revenue" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Revenue (USD)
        </label>
        <input
          id="conv-revenue"
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
    </form>
  );
}
