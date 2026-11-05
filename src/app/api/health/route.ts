import { createServiceClient } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const { count, error } = await db
    .from("workspaces")
    .select("id", { count: "exact", head: true });

  if (error) {
    return Response.json({ ok: false, error: "DB check failed" }, { status: 500 });
  }

  return Response.json({ ok: true, workspaces: count });
}
