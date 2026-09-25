import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isDemoMode, isSupabaseConfigured } from "@/lib/env";
import type { DocumentListItem, PublicDocument } from "@/types/document";

type DocumentRow = {
  id: string;
  slug: string;
  title: string;
  original_name: string;
  size_bytes: number | string;
  download_start: string;
  download_end: string;
  created_at: string;
};

const now = Date.now();

export const demoDocuments: DocumentListItem[] = [
  {
    id: "demo-1",
    slug: "tai-lieu-buoi-hoc-mau",
    title: "Workshop: Product thinking",
    originalName: "product-thinking.pdf",
    sizeBytes: 2_840_000,
    downloadStart: new Date(now - 20 * 60_000).toISOString(),
    downloadEnd: new Date(now + 100 * 60_000).toISOString(),
    createdAt: new Date(now - 24 * 60 * 60_000).toISOString(),
  },
  {
    id: "demo-2",
    slug: "slide-thuc-hanh-mau",
    title: "Practice slides",
    originalName: "practice-slides.pptx",
    sizeBytes: 8_420_000,
    downloadStart: new Date(now + 24 * 60 * 60_000).toISOString(),
    downloadEnd: new Date(now + 26 * 60 * 60_000).toISOString(),
    createdAt: new Date(now - 2 * 60 * 60_000).toISOString(),
  },
];

function mapRow(row: DocumentRow): DocumentListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    originalName: row.original_name,
    sizeBytes: Number(row.size_bytes),
    downloadStart: row.download_start,
    downloadEnd: row.download_end,
    createdAt: row.created_at,
  };
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  if (isDemoMode() || !isSupabaseConfigured()) return demoDocuments;

  const { data, error } = await getSupabaseAdmin()
    .from("documents")
    .select(
      "id, slug, title, original_name, size_bytes, download_start, download_end, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data as DocumentRow[]).map(mapRow);
}

export async function getPublicDocument(slug: string): Promise<PublicDocument | null> {
  if (isDemoMode() || !isSupabaseConfigured()) {
    const document = demoDocuments.find((item) => item.slug === slug);
    if (!document) return null;
    const { id: _id, createdAt: _createdAt, ...safe } = document;
    return safe;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("documents")
    .select("slug, title, original_name, size_bytes, download_start, download_end")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    slug: data.slug,
    title: data.title,
    originalName: data.original_name,
    sizeBytes: Number(data.size_bytes),
    downloadStart: data.download_start,
    downloadEnd: data.download_end,
  };
}
