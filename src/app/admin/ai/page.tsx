import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/feature-flags";
import { ensureAiFeatureConfigs } from "@/lib/ai/service";
import { AI_FEATURES } from "@/lib/ai/registry";
import { timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, FeatureDisabledNotice, PageHeader } from "@/components/ui";
import { AiTabs } from "@/components/ai-tabs";
import { ToggleSwitch } from "@/components/toggle-switch";
import { ProviderConnectForm } from "@/components/provider-connect-form";
import { saveModelConfig, toggleProvider, validateProvider } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  if (!(await isFlagEnabled("ai"))) {
    return (
      <>
        <PageHeader title="AI" subtitle="Providers, models, prompts and knowledge base." />
        <FeatureDisabledNotice feature="AI" />
      </>
    );
  }

  await ensureAiFeatureConfigs();

  const [providers, configs, prompts] = await Promise.all([
    prisma.aiProvider.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.aiModelConfig.findMany({
      include: { provider: { select: { name: true } } },
    }),
    prisma.prompt.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const configByFeature = new Map(configs.map((c) => [c.feature, c]));

  return (
    <>
      <PageHeader
        title="AI"
        subtitle="Every provider, model, prompt and parameter is database-configured — nothing hardcoded."
      />
      <AiTabs />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configured providers */}
        <Card title="Providers" padded={false}>
          {providers.length === 0 ? (
            <EmptyState
              title="No providers connected"
              hint="Connect one on the right — AI features stay honestly disabled until then."
            />
          ) : (
            <ul className="divide-y divide-ink-800">
              {providers.map((p) => (
                <li key={p.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-200">{p.name}</p>
                        <Badge value={p.status.startsWith("error") ? "error" : p.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        <code>{p.baseUrl}</code>
                        {p.apiKeyEncrypted ? " · key saved" : " · no key"}
                        {p.lastValidatedAt && ` · checked ${timeAgo(p.lastValidatedAt)}`}
                      </p>
                      {p.status.startsWith("error") && (
                        <p className="mt-1 text-xs text-red-400">{p.status}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <form action={validateProvider.bind(null, p.id)}>
                        <button type="submit" className="btn-ghost" disabled={!p.apiKeyEncrypted}>
                          Validate
                        </button>
                      </form>
                      <ToggleSwitch
                        action={toggleProvider.bind(null, p.id, !p.enabled)}
                        checked={p.enabled}
                        label={`Toggle ${p.name}`}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Connect / rotate */}
        <Card title="Connect a provider">
          <ProviderConnectForm configuredSlugs={providers.map((p) => p.slug)} />
        </Card>
      </div>

      {/* Per-feature model configuration */}
      <Card title="Feature model configs" className="mt-6" padded={false}>
        <p className="border-b border-ink-800 px-5 py-3 text-xs text-zinc-500">
          Each AI capability resolves its provider, model, parameters and system prompt from this
          table at runtime. A feature stays off until it has an enabled provider and a model.
        </p>
        <ul className="divide-y divide-ink-800">
          {AI_FEATURES.map((feature) => {
            const config = configByFeature.get(feature.feature);
            if (!config) return null;
            return (
              <li key={feature.feature}>
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-ink-800/40">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{feature.name}</p>
                      <p className="text-xs text-zinc-500">{feature.description}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      {config.enabled && config.provider ? (
                        <span>
                          {config.provider.name} · <code>{config.model || "no model"}</code>
                        </span>
                      ) : null}
                      <Badge value={config.enabled ? "ACTIVE" : "PAUSED"} />
                      <span className="text-zinc-600 transition-transform group-open:rotate-90">
                        →
                      </span>
                    </div>
                  </summary>

                  <form
                    action={saveModelConfig}
                    className="grid gap-4 border-t border-ink-800 bg-ink-900/40 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <input type="hidden" name="feature" value={config.feature} />
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Provider
                      </label>
                      <select
                        name="providerId"
                        className="input"
                        defaultValue={config.providerId ?? ""}
                      >
                        <option value="">— none —</option>
                        {providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {!p.enabled ? " (disabled)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Model
                      </label>
                      <input
                        name="model"
                        className="input"
                        defaultValue={config.model}
                        placeholder="provider model id"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        System prompt
                      </label>
                      <select
                        name="systemPromptId"
                        className="input"
                        defaultValue={config.systemPromptId ?? ""}
                      >
                        <option value="">— none —</option>
                        {prompts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Temperature
                      </label>
                      <input
                        name="temperature"
                        type="number"
                        step="0.1"
                        min={0}
                        max={2}
                        className="input num"
                        defaultValue={config.temperature}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Max tokens
                      </label>
                      <input
                        name="maxTokens"
                        type="number"
                        min={1}
                        max={200000}
                        className="input num"
                        defaultValue={config.maxTokens}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                        Reasoning level
                      </label>
                      <select
                        name="reasoningLevel"
                        className="input"
                        defaultValue={config.reasoningLevel}
                      >
                        {["none", "low", "medium", "high"].map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-3">
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={config.enabled}
                          className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-ember"
                        />
                        Enabled
                      </label>
                      <button type="submit" className="btn-primary">
                        Save {feature.name}
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
