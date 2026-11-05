"use server";

import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { updateInvoiceStatus } from "@/lib/invoice-actions";
import { normalizePhone } from "@/lib/phone";
import { revalidatePath } from "next/cache";

async function requireWorkspace() {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) throw new Error("No workspace found");
  return { user, workspace };
}

const FIELD_VALIDATORS: Record<string, (v: unknown) => unknown> = {
  customer_name: (v) => {
    if (typeof v !== "string" || v.trim().length === 0)
      throw new Error("Customer name is required");
    return v.trim();
  },
  customer_phone: (v) => {
    if (typeof v !== "string") throw new Error("Invalid phone");
    return normalizePhone(v);
  },
  customer_email: (v) => {
    if (typeof v !== "string") throw new Error("Invalid email");
    if (v.trim() === "") return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
      throw new Error("Invalid email format");
    return v.trim();
  },
  amount_inr: (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
      throw new Error("Amount must be a positive number");
    return n;
  },
  due_date: (v) => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
      throw new Error("Date must be YYYY-MM-DD");
    return v;
  },
  notes: (v) => {
    if (typeof v !== "string") throw new Error("Invalid notes");
    return v.trim() || null;
  },
};

export async function updateInvoiceField(
  invoiceId: string,
  field: string,
  value: string | number | null
) {
  const { workspace } = await requireWorkspace();

  const validator = FIELD_VALIDATORS[field];
  if (!validator) throw new Error("Invalid field");

  const validated = validator(value);
  const supabase = await createSSRClient();

  const { error } = await supabase
    .from("invoices")
    .update({ [field]: validated })
    .eq("id", invoiceId)
    .eq("workspace_id", workspace.id);

  if (error) throw new Error("Failed to update invoice");

  await supabase.from("events").insert({
    workspace_id: workspace.id,
    invoice_id: invoiceId,
    type: "field_edited",
    note: `${field} updated via UI`,
  });

  revalidatePath("/invoices");
}

export async function changeInvoiceStatus(
  invoiceId: string,
  _oldStatus: string,
  newStatus: string,
  promisedDate?: string
) {
  const { workspace } = await requireWorkspace();
  const supabase = await createSSRClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!invoice) throw new Error("Invoice not found");

  await updateInvoiceStatus(
    supabase,
    invoiceId,
    workspace.id,
    invoice.status,
    newStatus,
    promisedDate
  );

  revalidatePath("/invoices");
  revalidatePath("/followups");
  revalidatePath("/dashboard");
}
