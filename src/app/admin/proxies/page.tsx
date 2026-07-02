import { prisma } from "@/lib/prisma";
import { isFlagEnabled } from "@/lib/feature-flags";
import { PROXY_SERVICES } from "@/lib/proxies";
import { timeAgo } from "@/lib/format";
import { Badge, Card, EmptyState, FeatureDisabledNotice, PageHeader } from "@/components/ui";
import { ToggleSwitch } from "@/components/toggle-switch";
import { ConfirmAction } from "@/components/confirm-dialog";
import { assignProxy, createProxy, deleteProxy, testProxy, toggleProxy } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminProxiesPage() {
  if (!(await isFlagEnabled("proxies"))) {
    return (
      <>
        <PageHeader title="Proxies" subtitle="Outbound routing for integration traffic." />
        <FeatureDisabledNotice feature="Proxy management" />
      </>
    );
  }

  const [proxies, assignments] = await Promise.all([
    prisma.proxy.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.proxyAssignment.findMany(),
  ]);
  const assignmentByService = new Map(assignments.map((a) => [a.service, a.proxyId]));

  return (
    <>
      <PageHeader
        title="Proxies"
        subtitle="Outbound routes for reliability and geo-accurate routing of authorized integration traffic — always within each provider's terms of service."
      />

      {/* Routes */}
      <Card title={`Routes (${proxies.length})`} padded={false}>
        {proxies.length === 0 ? (
          <EmptyState
            title="No proxies configured"
            hint="Traffic goes direct until a route is added below — nothing depends on this."
          />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th className="text-right">Latency</th>
                <th className="text-right">OK / fail</th>
                <th className="w-44" />
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => (
                <tr key={proxy.id}>
                  <td>
                    <p className="font-medium text-zinc-200">{proxy.name}</p>
                    <p className="text-xs text-zinc-500">
                      {proxy.kind.toLowerCase()}
                      {proxy.provider && ` · ${proxy.provider}`}
                    </p>
                  </td>
                  <td>
                    <code className="text-xs text-zinc-400">
                      {proxy.protocol.toLowerCase()}://{proxy.host}:{proxy.port}
                    </code>
                    {proxy.username && <p className="text-xs text-zinc-600">authenticated</p>}
                  </td>
                  <td>
                    <Badge value={proxy.status} />
                    {proxy.lastCheckedAt && (
                      <p className="mt-0.5 text-[11px] text-zinc-600">
                        {timeAgo(proxy.lastCheckedAt)}
                      </p>
                    )}
                  </td>
                  <td className="num text-right">
                    {proxy.latencyMs != null ? `${proxy.latencyMs}ms` : "—"}
                  </td>
                  <td className="num text-right text-xs">
                    <span className="text-emerald-400">{proxy.successCount}</span>
                    {" / "}
                    <span className="text-red-400">{proxy.failureCount}</span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <form action={testProxy.bind(null, proxy.id)}>
                        <button type="submit" className="btn-ghost">
                          Test
                        </button>
                      </form>
                      {/* disabling also bypasses it for any assigned service (getProxyFor checks enabled) */}
                      <ToggleSwitch
                        action={toggleProxy.bind(null, proxy.id, !proxy.enabled)}
                        checked={proxy.enabled}
                        label={`Toggle ${proxy.name}`}
                      />
                      <ConfirmAction
                        action={deleteProxy.bind(null, proxy.id)}
                        title={`Delete proxy "${proxy.name}"?`}
                        description="Any service assigned to it falls back to a direct connection."
                        confirmLabel="Delete"
                      >
                        <span className="btn-ghost text-red-400">Delete</span>
                      </ConfirmAction>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Add route */}
        <Card title="Add route">
          <form action={createProxy} className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Name</label>
                <input name="name" className="input" required placeholder="EU residential 1" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Provider (label)
                </label>
                <input name="provider" className="input" placeholder="vendor name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Kind</label>
                <select name="kind" className="input" defaultValue="DATACENTER">
                  <option value="DATACENTER">Datacenter</option>
                  <option value="RESIDENTIAL">Residential</option>
                  <option value="MOBILE">Mobile</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Protocol</label>
                <select name="protocol" className="input" defaultValue="HTTP">
                  <option value="HTTP">HTTP</option>
                  <option value="HTTPS">HTTPS</option>
                  <option value="SOCKS5">SOCKS5</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Host</label>
                <input name="host" className="input" required placeholder="proxy.example.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Port</label>
                <input name="port" type="number" min={1} max={65535} className="input num" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Username</label>
                <input name="username" className="input" autoComplete="off" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
                <input name="password" type="password" className="input" autoComplete="off" />
                <p className="mt-1 text-xs text-zinc-500">Encrypted at rest.</p>
              </div>
            </div>
            <button type="submit" className="btn-primary w-fit">
              Add route
            </button>
          </form>
        </Card>

        {/* Per-service assignment */}
        <Card title="Service assignment" padded={false}>
          <p className="border-b border-ink-800 px-5 py-3 text-xs text-zinc-500">
            Route a service&apos;s outbound requests through a proxy. Unassigned services connect
            directly.
          </p>
          <ul className="divide-y divide-ink-800">
            {PROXY_SERVICES.map(({ service, label }) => (
              <li key={service} className="px-5 py-3.5">
                <form
                  action={assignProxy.bind(null, service)}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-zinc-300">{label}</span>
                  <div className="flex items-center gap-2">
                    <select
                      name="proxyId"
                      className="input w-52"
                      aria-label={`Proxy for ${label}`}
                      defaultValue={assignmentByService.get(service) ?? ""}
                    >
                      <option value="">Direct (no proxy)</option>
                      {proxies
                        .filter((p) => p.enabled)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <button type="submit" className="btn-secondary">
                      Save
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
