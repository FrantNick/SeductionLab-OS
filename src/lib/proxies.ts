import { Socket } from "net";
import { prisma } from "@/lib/prisma";

/**
 * Proxy management. Health checking is a TCP connect + latency probe —
 * protocol-agnostic, so HTTP, HTTPS and SOCKS5 proxies are all checked
 * the same way without protocol-specific dependencies.
 *
 * Services declare which proxy they use via ProxyAssignment
 * ("apify", "ai", …); consumers call getProxyFor(service).
 */

export const PROXY_SERVICES = [
  { service: "apify", label: "Apify scraping" },
  { service: "ai", label: "AI providers" },
] as const;

export async function checkProxyHealth(
  proxyId: string,
): Promise<{ healthy: boolean; latencyMs: number | null; detail: string }> {
  const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
  if (!proxy) return { healthy: false, latencyMs: null, detail: "Proxy not found" };

  const started = Date.now();
  const result = await new Promise<{ healthy: boolean; detail: string }>((resolve) => {
    const socket = new Socket();
    const finish = (healthy: boolean, detail: string) => {
      socket.destroy();
      resolve({ healthy, detail });
    };
    socket.setTimeout(8000);
    socket.once("connect", () => finish(true, "TCP connect OK"));
    socket.once("timeout", () => finish(false, "Connection timed out"));
    socket.once("error", (err) => finish(false, err.message));
    socket.connect(proxy.port, proxy.host);
  });

  const latencyMs = result.healthy ? Date.now() - started : null;

  await prisma.proxy.update({
    where: { id: proxyId },
    data: {
      status: result.healthy ? "healthy" : "unhealthy",
      latencyMs,
      lastCheckedAt: new Date(),
      ...(result.healthy ? { successCount: { increment: 1 } } : { failureCount: { increment: 1 } }),
    },
  });

  return { healthy: result.healthy, latencyMs, detail: result.detail };
}

/** Resolves the enabled proxy assigned to a service, if any. */
export async function getProxyFor(service: string) {
  const assignment = await prisma.proxyAssignment.findUnique({
    where: { service },
    include: { proxy: true },
  });
  if (!assignment || !assignment.proxy.enabled) return null;
  return assignment.proxy;
}

/** proxy URL for consumers that accept one (e.g. Apify proxyUrls input). */
export function proxyUrl(proxy: {
  protocol: string;
  host: string;
  port: number;
  username: string | null;
  passwordPlain?: string | null;
}): string {
  const scheme = proxy.protocol.toLowerCase() === "socks5" ? "socks5" : "http";
  const auth =
    proxy.username && proxy.passwordPlain
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.passwordPlain)}@`
      : "";
  return `${scheme}://${auth}${proxy.host}:${proxy.port}`;
}
