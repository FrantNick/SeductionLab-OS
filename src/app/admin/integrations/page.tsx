import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/feature-flags";
import { INTEGRATION_DEFS } from "@/lib/integrations";
import { timeAgo } from "@/lib/format";
import { Badge, Card, FeatureDisabledNotice, PageHeader } from "@/components/ui";
import { ToggleSwitch } from "@/components/toggle-switch";
import { saveIntegration, toggleIntegration } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  if (!(await isFlagEnabled("integrations"))) {
    return (
      <>
        <PageHeader title="Integrations" subtitle="External service connections." />
        <FeatureDisabledNotice feature="Integrations" />
      </>
    );
  }

  const rows = await prisma.integration.findMany();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Credentials are encrypted at rest and validated against the live API — a service is only ever shown as connected when it really is."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {INTEGRATION_DEFS.map((def) => {
          const row = bySlug.get(def.slug);
          const config = (row?.config as Record<string, string> | null) ?? {};
          const hasCredential = Boolean(row?.credentialEncrypted);
          const status = row?.status ?? "unconfigured";

          return (
            <Card
              key={def.slug}
              title={def.name}
              action={
                <div className="flex items-center gap-3">
                  <Badge value={status} />
                  {row && (
                    <ToggleSwitch
                      action={toggleIntegration.bind(null, def.slug, !row.enabled)}
                      checked={row.enabled}
                      label={`Toggle ${def.name}`}
                    />
                  )}
                </div>
              }
            >
              <p className="text-xs text-zinc-500">{def.description}</p>
              {row?.statusDetail && (
                <p
                  className={`mt-2 text-xs ${
                    status === "error" ? "text-red-400" : "text-zinc-400"
                  }`}
                >
                  {row.statusDetail}
                  {row.lastCheckedAt && ` · checked ${timeAgo(row.lastCheckedAt)}`}
                </p>
              )}

              <form action={saveIntegration.bind(null, def.slug)} className="mt-4 grid gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                    {def.credentialLabel}
                  </label>
                  <input
                    name="credential"
                    type="password"
                    className="input"
                    autoComplete="off"
                    placeholder={
                      hasCredential ? "Saved — enter a new value to rotate" : "Not configured"
                    }
                  />
                </div>
                {def.configFields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                      {field.label}
                    </label>
                    <input
                      name={`config.${field.key}`}
                      className="input"
                      placeholder={field.placeholder}
                      defaultValue={config[field.key] ?? ""}
                    />
                  </div>
                ))}
                <button type="submit" className="btn-primary w-fit">
                  {def.validate ? "Save & validate" : "Save"}
                </button>
              </form>
            </Card>
          );
        })}
      </div>
    </>
  );
}
