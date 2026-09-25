import { notFound } from "next/navigation";
import { DownloadPanel } from "@/components/download-panel";
import { ShieldIcon } from "@/components/icons";
import { getPublicDocument } from "@/lib/documents";
import { isDemoMode, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function DownloadPage({ params }: PageProps<"/d/[slug]">) {
  const { slug } = await params;
  const document = await getPublicDocument(slug);
  if (!document) notFound();

  return (
    <main className="download-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark"><ShieldIcon /></span>
          TempLink
        </a>
      </header>
      <div className="download-wrap">
        <DownloadPanel
          document={document}
          demoMode={isDemoMode() || !isSupabaseConfigured()}
        />
      </div>
    </main>
  );
}
