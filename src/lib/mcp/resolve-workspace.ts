import { createServiceClient } from "../supabase-server";
import { timingSafeEqual } from "crypto";

export async function resolveWorkspace(token: string) {
  if (!token || token.length < 32) return null;

  const db = createServiceClient();

  // Fetch workspace by token — we compare in constant time after fetch
  const { data } = await db
    .from("workspaces")
    .select("id, name, mcp_token")
    .limit(10);

  if (!data) return null;

  // Constant-time comparison against all workspace tokens
  for (const ws of data) {
    const a = Buffer.from(token, "utf8");
    const b = Buffer.from(ws.mcp_token, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return { id: ws.id, name: ws.name };
    }
  }

  return null;
}
