import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSetting } from "@/lib/app-settings";
import { Sidebar, type NavSection } from "@/components/sidebar";

const nav: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", exact: true },
      { href: "/dashboard/campaigns", label: "Campaigns" },
      { href: "/dashboard/threads", label: "Threads" },
      { href: "/dashboard/links", label: "Tracking links" },
      { href: "/dashboard/leaderboard", label: "Leaderboard" },
      { href: "/dashboard/settings", label: "Settings" },
    ],
  },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.affiliateId && session.user.role !== "ADMIN") redirect("/login");

  const appName = await getSetting<string>("branding.appName");

  return (
    <div className="min-h-screen">
      <Sidebar
        sections={nav}
        userLabel={session.user.email ?? ""}
        roleLabel={session.user.role === "ADMIN" ? "Admin (viewing affiliate area)" : "Affiliate"}
        appName={appName}
      />
      <main className="ml-60 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
