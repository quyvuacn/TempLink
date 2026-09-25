import { authenticateAdmin, setAdminSession } from "@/lib/admin-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password !== "string") {
      return Response.json({ error: "Invalid password." }, { status: 400 });
    }
    if (!(await authenticateAdmin(body.password))) {
      return Response.json({ error: "Incorrect admin password." }, { status: 401 });
    }
    await setAdminSession();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "The system is not fully configured." }, { status: 503 });
  }
}
