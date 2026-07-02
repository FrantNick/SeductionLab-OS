import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

const nav = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/affiliates", label: "Affiliates" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/conversions", label: "Conversions" },
  { href: "/admin/products", label: "Products" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <Sidebar items={nav} userLabel={session.user.email ?? ""} roleLabel="Admin" />
      <main className="ml-60 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
