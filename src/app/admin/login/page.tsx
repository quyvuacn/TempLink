import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { ShieldIcon } from "@/components/icons";
import { hasAdminSession } from "@/lib/admin-session";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isDemoMode() || (await hasAdminSession())) redirect("/admin");

  return (
    <main className="login-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark"><ShieldIcon /></span>
          TempLink
        </a>
      </header>
      <div className="login-wrap">
        <section className="card login-card">
          <h1>Sign in</h1>
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
