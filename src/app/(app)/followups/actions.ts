"use server";

import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { revalidatePath } from "next/cache";

async function requireWorkspace() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) throw new Error("No workspace found");
  return workspace;
}

export async function updateFollowupMessage(followupId: string, message: string) {
  const workspace = await requireWorkspace();
  const supabase = await createSSRClient();

  const { error } = await supabase
    .from("followups")
    .update({ message_text: message, edited_by_human: true })
    .eq("id", followupId)
    .eq("workspace_id", workspace.id);

  if (error) throw new Error("Failed to update message");
  revalidatePath("/followups");
}

export async function updateFollowupStatus(
  followupId: string,
  newStatus: "approved" | "skipped" | "sent"
) {
  const workspace = await requireWorkspace();
  const supabase = await createSSRClient();

  const { error } = await supabase
    .from("followups")
    .update({ status: newStatus })
    .eq("id", followupId)
    .eq("workspace_id", workspace.id);

  if (error) throw new Error("Failed to update follow-up status");
  revalidatePath("/followups");
}
