"use server";

import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { updateInvoiceStatus } from "@/lib/invoice-actions";
import { revalidatePath } from "next/cache";

async function requireWorkspace() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) throw new Error("No workspace found");
  return { user, workspace };
}

export async function updateInvoiceField(
  invoiceId: string,
  field: string,
  value: string | number | null
) {
  const { workspace } = await requireWorkspace();
  const supabase = await createSSRClient();

  const allowed = [
    "customer_name",
    "customer_phone",
    "customer_email",
    "amount_inr",
    "due_date",
    "notes",
  ];
  if (!allowed.includes(field)) throw new Error("Invalid field");

  const { error } = await supabase
    .from("invoices")
    .update({ [field]: value })
    .eq("id", invoiceId)
    .eq("workspace_id", workspace.id);

  if (error) throw new Error("Failed to update invoice");
  revalidatePath("/invoices");
}

export async function changeInvoiceStatus(
  invoiceId: string,
  oldStatus: string,
  newStatus: string,
  promisedDate?: string
) {
  const { workspace } = await requireWorkspace();
  const supabase = await createSSRClient();

  await updateInvoiceStatus(
    supabase,
    invoiceId,
    workspace.id,
    oldStatus,
    newStatus,
    promisedDate
  );

  revalidatePath("/invoices");
  revalidatePath("/followups");
  revalidatePath("/dashboard");
}
