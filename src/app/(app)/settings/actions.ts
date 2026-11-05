"use server";

import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

async function requireWorkspace() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) throw new Error("No workspace found");
  return workspace;
}

export async function rotateToken() {
  if (process.env.DEMO_MODE === "true") {
    throw new Error("Token rotation is disabled in demo mode");
  }
  const workspace = await requireWorkspace();
  const db = createServiceClient();
  const newToken = randomBytes(32).toString("hex");

  const { error } = await db
    .from("workspaces")
    .update({ mcp_token: newToken })
    .eq("id", workspace.id);

  if (error) throw new Error("Failed to rotate token");
  revalidatePath("/settings");
  return newToken;
}

export async function resetDemoData() {
  const workspace = await requireWorkspace();
  const db = createServiceClient();

  const { error: e1 } = await db.from("events").delete().eq("workspace_id", workspace.id);
  if (e1) throw new Error(`Failed to delete events: ${e1.message}`);

  const { error: e2 } = await db.from("followups").delete().eq("workspace_id", workspace.id);
  if (e2) throw new Error(`Failed to delete follow-ups: ${e2.message}`);

  const { error: e3 } = await db.from("invoices").delete().eq("workspace_id", workspace.id);
  if (e3) throw new Error(`Failed to delete invoices: ${e3.message}`);

  revalidatePath("/invoices");
  revalidatePath("/followups");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function ensureWorkspace() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");

  const supabase = await createSSRClient();
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (existing) return;

  const db = createServiceClient();
  const token = randomBytes(32).toString("hex");
  const { error } = await db.from("workspaces").insert({
    name: "My Workspace",
    mcp_token: token,
    owner_user_id: user.id,
  });

  if (error) throw new Error("Failed to create workspace");
  revalidatePath("/settings");
  revalidatePath("/invoices");
}
