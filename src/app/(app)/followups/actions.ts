"use server";

import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { revalidatePath } from "next/cache";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["approved", "skipped"],
  approved: ["sent", "skipped"],
};

async function requireWorkspace() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) throw new Error("No workspace found");
  return workspace;
}

export async function updateFollowupMessage(followupId: string, message: string) {
  if (!message || message.length > 2000) {
    throw new Error("Message must be 1-2000 characters");
  }

  const workspace = await requireWorkspace();
  const supabase = await createSSRClient();

  const { data: existing } = await supabase
    .from("followups")
    .select("status")
    .eq("id", followupId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!existing) throw new Error("Follow-up not found");
  if (existing.status !== "draft" && existing.status !== "approved") {
    throw new Error("Can only edit draft or approved follow-ups");
  }

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

  const { data: followup } = await supabase
    .from("followups")
    .select("status, invoice_id, invoices!inner(status)")
    .eq("id", followupId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!followup) throw new Error("Follow-up not found");

  const allowed = VALID_TRANSITIONS[followup.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${followup.status} to ${newStatus}`);
  }

  const invoiceStatus = (followup.invoices as unknown as { status: string })?.status;
  if (invoiceStatus === "paid" && (newStatus === "approved" || newStatus === "sent")) {
    throw new Error("Cannot approve or send follow-ups for paid invoices");
  }

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "sent") {
    updates.sent_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("followups")
    .update(updates)
    .eq("id", followupId)
    .eq("workspace_id", workspace.id);

  if (error) throw new Error("Failed to update follow-up status");
  revalidatePath("/followups");
}
