import { ShieldIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="download-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark"><ShieldIcon /></span>
          TempLink
        </a>
      </header>
      <div className="download-wrap">
        <section className="card login-card">
          <div className="eyebrow">404</div>
          <h1>Document not found</h1>
          <p>This link does not exist or the document is no longer available.</p>
        </section>
      </div>
    </main>
  );
}
