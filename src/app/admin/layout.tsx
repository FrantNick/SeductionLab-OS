import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllFlags } from "@/lib/feature-flags";
import { getSetting } from "@/lib/app-settings";
import { Sidebar, type NavSection } from "@/components/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [flags, appName] = await Promise.all([
    getAllFlags(),
    getSetting<string>("branding.appName"),
  ]);
  const on = new Set(flags.filter((f) => f.enabled).map((f) => f.key));

  const nav: NavSection[] = [
    {
      items: [
        { href: "/admin", label: "Overview", exact: true },
        { href: "/admin/campaigns", label: "Campaigns" },
        { href: "/admin/affiliates", label: "Affiliates" },
        { href: "/admin/products", label: "Products" },
        { href: "/admin/conversions", label: "Conversions" },
        { href: "/admin/analytics", label: "Analytics" },
        { href: "/admin/leaderboard", label: "Leaderboard" },
      ],
    },
    {
      title: "Growth",
      // flag-gated sections disappear from nav the moment their flag is off
      items: [
        ...(on.has("experiments")
          ? [{ href: "/admin/experiments", label: "Experiments" }]
          : []),
        ...(on.has("ai") ? [{ href: "/admin/ai", label: "AI" }] : []),
        ...(on.has("integrations")
          ? [{ href: "/admin/integrations", label: "Integrations" }]
          : []),
        ...(on.has("proxies") ? [{ href: "/admin/proxies", label: "Proxies" }] : []),
      ],
    },
    {
      title: "Platform",
      items: [
        { href: "/admin/audit", label: "Audit log" },
        { href: "/admin/settings", label: "Settings" },
        { href: "/admin/debug", label: "Debug" },
      ],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen">
      <Sidebar
        sections={nav}
        userLabel={session.user.email ?? ""}
        roleLabel="Admin"
        appName={appName}
      />
      <main className="px-4 pb-8 pt-20 sm:px-8 lg:ml-60 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
