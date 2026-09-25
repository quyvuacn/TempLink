import { randomBytes } from "node:crypto";
import { hasAdminSession } from "@/lib/admin-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

function createSlug() {
  return randomBytes(12).toString("base64url").toLowerCase();
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const originalName = typeof body.originalName === "string" ? body.originalName : "";
    const mimeType =
      typeof body.mimeType === "string" ? body.mimeType : "application/octet-stream";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    const password = typeof body.password === "string" ? body.password : "";
    const downloadStart =
      typeof body.downloadStart === "string" && body.downloadStart
        ? new Date(body.downloadStart)
        : null;
    const downloadEnd =
      typeof body.downloadEnd === "string" && body.downloadEnd
        ? new Date(body.downloadEnd)
        : null;

    if (
      !/^[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(storagePath) ||
      !title ||
      title.length > 120 ||
      !originalName ||
      sizeBytes <= 0 ||
      (password.length > 0 && password.length < 6) ||
      password.length > 64 ||
      (downloadStart && Number.isNaN(downloadStart.getTime())) ||
      (downloadEnd && Number.isNaN(downloadEnd.getTime())) ||
      (downloadStart && downloadEnd && downloadEnd <= downloadStart)
    ) {
      return Response.json({ error: "Invalid document details." }, { status: 400 });
    }

    const slug = createSlug();
    const { data, error } = await getSupabaseAdmin()
      .from("documents")
      .insert({
        slug,
        title,
        original_name: originalName,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        access_password: password || null,
        password_hash: null,
        download_start: downloadStart?.toISOString() ?? null,
        download_end: downloadEnd?.toISOString() ?? null,
      })
      .select(
        "id, slug, title, original_name, size_bytes, download_start, download_end, created_at, access_password",
      )
      .single();

    if (error) throw error;
    return Response.json({
      document: {
        id: data.id,
        slug: data.slug,
        title: data.title,
        originalName: data.original_name,
        sizeBytes: Number(data.size_bytes),
        downloadStart: data.download_start,
        downloadEnd: data.download_end,
        createdAt: data.created_at,
        accessPassword: data.access_password,
      },
    });
  } catch {
    return Response.json({ error: "Could not save the document." }, { status: 500 });
  }
}
