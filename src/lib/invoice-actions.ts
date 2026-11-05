import { SupabaseClient } from "@supabase/supabase-js";

export async function markInvoicePaid(
  db: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
  note?: string
) {
  const { error: updateErr } = await db
    .from("invoices")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      promised_date: null,
    })
    .eq("id", invoiceId);

  if (updateErr) throw updateErr;

  const { data: skipped } = await db
    .from("followups")
    .update({ status: "skipped" })
    .eq("invoice_id", invoiceId)
    .in("status", ["draft", "approved"])
    .select("id");

  await db.from("events").insert({
    workspace_id: workspaceId,
    invoice_id: invoiceId,
    type: "status_paid",
    note: note ?? "Marked paid",
  });

  return { followupsSkipped: skipped?.length ?? 0 };
}

export async function updateInvoiceStatus(
  db: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
  oldStatus: string,
  newStatus: string,
  promisedDate?: string | null,
  note?: string
) {
  if (newStatus === "paid") {
    return markInvoicePaid(db, invoiceId, workspaceId, note);
  }

  const updates: Record<string, unknown> = { status: newStatus };

  if (newStatus === "promised") {
    updates.promised_date = promisedDate;
  } else {
    if (oldStatus === "promised") updates.promised_date = null;
    if (oldStatus === "paid") updates.paid_at = null;
  }

  const { error } = await db
    .from("invoices")
    .update(updates)
    .eq("id", invoiceId);

  if (error) throw error;

  await db.from("events").insert({
    workspace_id: workspaceId,
    invoice_id: invoiceId,
    type: `status_${newStatus}`,
    note: note ?? `Marked ${newStatus}`,
  });

  return { followupsSkipped: 0 };
}
