import { randomUUID } from "node:crypto";
import { hasAdminSession } from "@/lib/admin-session";
import { DOCUMENT_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function safeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(-120) || "document";
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    if (!fileName || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return Response.json(
        { error: "Invalid file or file exceeds 100 MB." },
        { status: 400 },
      );
    }

    const path = `${randomUUID()}/${safeFilename(fileName)}`;
    const { data, error } = await getSupabaseAdmin()
      .storage.from(DOCUMENT_BUCKET)
      .createSignedUploadUrl(path);

    if (error) throw error;
    return Response.json({ path, token: data.token });
  } catch {
    return Response.json({ error: "Could not start the upload." }, { status: 500 });
  }
}
