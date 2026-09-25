import { hasAdminSession } from "@/lib/admin-session";
import { DOCUMENT_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

function validStoragePath(value: string) {
  return /^[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(value);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!(await hasAdminSession())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  let replacementPath = "";

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const downloadStart =
      typeof body.downloadStart === "string" && body.downloadStart
        ? new Date(body.downloadStart)
        : null;
    const downloadEnd =
      typeof body.downloadEnd === "string" && body.downloadEnd
        ? new Date(body.downloadEnd)
        : null;
    const passwordProvided = typeof body.password === "string";

    replacementPath = typeof body.storagePath === "string" ? body.storagePath : "";
    const originalName = typeof body.originalName === "string" ? body.originalName : "";
    const mimeType =
      typeof body.mimeType === "string" ? body.mimeType : "application/octet-stream";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    const replacingFile = Boolean(replacementPath);

    if (
      !/^[0-9a-f-]{36}$/.test(id) ||
      !title ||
      title.length > 120 ||
      (password.length > 0 && (password.length < 6 || password.length > 64)) ||
      (downloadStart && Number.isNaN(downloadStart.getTime())) ||
      (downloadEnd && Number.isNaN(downloadEnd.getTime())) ||
      (downloadStart && downloadEnd && downloadEnd <= downloadStart) ||
      (replacingFile && (!validStoragePath(replacementPath) || !originalName || sizeBytes <= 0))
    ) {
      if (replacementPath && validStoragePath(replacementPath)) {
        await getSupabaseAdmin().storage.from(DOCUMENT_BUCKET).remove([replacementPath]);
      }
      return Response.json({ error: "Invalid document details." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!current) {
      if (replacementPath) {
        await supabase.storage.from(DOCUMENT_BUCKET).remove([replacementPath]);
      }
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      title,
      download_start: downloadStart?.toISOString() ?? null,
      download_end: downloadEnd?.toISOString() ?? null,
    };

    if (passwordProvided) {
      updates.access_password = password || null;
      updates.password_hash = null;
    }
    if (replacingFile) {
      updates.storage_path = replacementPath;
      updates.original_name = originalName;
      updates.mime_type = mimeType;
      updates.size_bytes = sizeBytes;
    }

    const { data, error } = await supabase
      .from("documents")
      .update(updates)
      .eq("id", id)
      .select(
        "id, slug, title, original_name, size_bytes, download_start, download_end, created_at, access_password",
      )
      .single();

    if (error) throw error;

    if (replacingFile && current.storage_path !== replacementPath) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([current.storage_path]);
    }

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
    if (replacementPath) {
      await getSupabaseAdmin().storage.from(DOCUMENT_BUCKET).remove([replacementPath]);
    }
    return Response.json({ error: "Could not update the document." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!(await hasAdminSession())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return Response.json({ error: "Invalid document ID." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: document, error: findError } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();

    if (findError) throw findError;
    if (!document) return Response.json({ error: "Document not found." }, { status: 404 });

    const { error: storageError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .remove([document.storage_path]);
    if (storageError) throw storageError;

    const { error: deleteError } = await supabase.from("documents").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not delete the document." }, { status: 500 });
  }
}
