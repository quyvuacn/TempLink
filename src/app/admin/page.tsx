import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { hasAdminSession } from "@/lib/admin-session";
import { isDemoMode, isSupabaseConfigured } from "@/lib/env";
import { listDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const demoMode = isDemoMode() || !isSupabaseConfigured();

  if (!demoMode && !(await hasAdminSession())) {
    redirect("/admin/login");
  }

  const documents = await listDocuments();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <AdminDashboard
      initialDocuments={documents}
      demoMode={demoMode}
      siteUrl={siteUrl.replace(/\/$/, "")}
    />
  );
}
