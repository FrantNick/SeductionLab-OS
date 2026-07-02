import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

const nav = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/threads", label: "Threads" },
  { href: "/dashboard/links", label: "Tracking links" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.affiliateId && session.user.role !== "ADMIN") redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar
        items={nav}
        userLabel={session.user.email ?? ""}
        roleLabel={session.user.role === "ADMIN" ? "Admin (viewing affiliate area)" : "Affiliate"}
      />
      <main className="ml-60 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
