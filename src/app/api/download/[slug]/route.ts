import { hashIp, safeCompare, verifyPassword } from "@/lib/security";
import { DOCUMENT_BUCKET, getSupabaseAdmin } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";

type DocumentRow = {
  id: string;
  storage_path: string;
  original_name: string;
  password_hash: string | null;
  access_password: string | null;
  download_start: string | null;
  download_end: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("documents")
      .select(
        "id, storage_path, original_name, password_hash, access_password, download_start, download_end",
      )
      .eq("slug", slug)
      .eq("active", true)
      .maybeSingle<DocumentRow>();
    if (error) throw error;
    if (!data) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const now = Date.now();
    if (data.download_start && now < new Date(data.download_start).getTime()) {
      return Response.json({ error: "This download is not available yet." }, { status: 403 });
    }
    if (data.download_end && now > new Date(data.download_end).getTime()) {
      return Response.json(
        { error: "This download has expired." },
        { status: 403 },
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwardedFor || request.headers.get("x-real-ip") || "unknown";
    const { appSecret } = getServerEnv();
    const ipHash = hashIp(ip, appSecret);
    const cutoff = new Date(now - 10 * 60_000).toISOString();
    const passwordRequired = Boolean(data.access_password || data.password_hash);

    if (passwordRequired) {
      const { count } = await supabase
        .from("download_attempts")
        .select("id", { count: "exact", head: true })
        .eq("document_id", data.id)
        .eq("ip_hash", ipHash)
        .eq("success", false)
        .gte("attempted_at", cutoff);

      if ((count ?? 0) >= 5) {
        return Response.json(
          { error: "Too many failed attempts. Try again in 10 minutes." },
          { status: 429 },
        );
      }
    }

    if (passwordRequired && !password) {
      return Response.json({ error: "Please enter the password." }, { status: 400 });
    }

    const valid = data.access_password
      ? safeCompare(password, data.access_password)
      : data.password_hash
        ? await verifyPassword(password, data.password_hash)
        : true;
    if (passwordRequired) {
      await supabase.from("download_attempts").insert({
        document_id: data.id,
        ip_hash: ipHash,
        success: valid,
      });
    }

    if (!valid) {
      return Response.json({ error: "Incorrect password." }, { status: 401 });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(data.storage_path, 60, { download: data.original_name });
    if (signedError) throw signedError;

    return Response.json(
      { url: signed.signedUrl, expiresIn: 60 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Could not create a download link right now." }, { status: 500 });
  }
}
