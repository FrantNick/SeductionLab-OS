"use client";

import { useState } from "react";
import { PROVIDER_PRESETS } from "@/lib/ai/registry";
import { saveProvider } from "@/app/admin/ai/actions";

/**
 * "Connect a provider" form. Picking a preset prefills the base URL
 * (still editable — any OpenAI-compatible host works); submission goes
 * through the saveProvider server action, which encrypts the key.
 */
export function ProviderConnectForm({ configuredSlugs }: { configuredSlugs: string[] }) {
  const [slug, setSlug] = useState(
    PROVIDER_PRESETS.find((p) => !configuredSlugs.includes(p.slug))?.slug ??
      PROVIDER_PRESETS[0].slug,
  );
  const preset = PROVIDER_PRESETS.find((p) => p.slug === slug) ?? PROVIDER_PRESETS[0];
  // key prop below resets the default value when the preset changes
  return (
    <form action={saveProvider} className="grid gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Provider</label>
        <select
          name="slug"
          className="input"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        >
          {PROVIDER_PRESETS.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
              {configuredSlugs.includes(p.slug) ? " (configured)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">Base URL</label>
        <input
          key={preset.slug}
          name="baseUrl"
          className="input"
          required
          defaultValue={preset.baseUrl}
        />
        <p className="mt-1 text-xs text-zinc-500">
          Any OpenAI-compatible endpoint works — see{" "}
          <a
            href={preset.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ember-text underline-offset-2 hover:underline"
          >
            {preset.name} docs
          </a>
          .
        </p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-zinc-400">API key</label>
        <input
          name="apiKey"
          type="password"
          className="input"
          autoComplete="off"
          placeholder={
            configuredSlugs.includes(slug) ? "Leave empty to keep the saved key" : "sk-…"
          }
        />
        <p className="mt-1 text-xs text-zinc-500">
          Stored encrypted (AES-256-GCM) — never logged, never sent back to the browser.
        </p>
      </div>
      <button type="submit" className="btn-primary w-fit">
        {configuredSlugs.includes(slug) ? "Update provider" : "Connect provider"}
      </button>
    </form>
  );
}
