import { createServiceClient } from "../supabase-server";

export async function resolveWorkspace(token: string) {
  if (!token || token.length < 32) return null;

  const db = createServiceClient();

  const { data, error } = await db
    .from("workspaces")
    .select("id, name")
    .eq("mcp_token", token)
    .maybeSingle();

  if (error || !data) return null;

  return { id: data.id, name: data.name };
}
