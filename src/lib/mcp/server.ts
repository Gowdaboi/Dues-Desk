import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "../phone";
import { APP_URL, todayIST } from "../constants";

function toolError(msg: string) {
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

function toolJson(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function logErr(context: string, err: unknown) {
  console.error(`[dues-desk] ${context}:`, err);
}

export function createDuesDeskMcp(
  db: SupabaseClient,
  workspaceId: string
): McpServer {
  const server = new McpServer({
    name: "dues-desk",
    version: "1.0.0",
  });

  // ── Tool 1: get_workspace_summary ──────────────────────────────────
  server.registerTool(
    "get_workspace_summary",
    {
      description:
        "Returns today's date (IST), outstanding total, overdue buckets (1-30, 31-60, 60+ days) with counts and totals. Call this FIRST so you know today's date and what's owed.",
      inputSchema: z.object({}),
    },
    async () => {
      const today = todayIST();

      const { data: invoices, error } = await db
        .from("invoices")
        .select("amount_inr, due_date, status")
        .eq("workspace_id", workspaceId)
        .in("status", ["open", "promised", "disputed"]);

      if (error) {
        logErr("get_workspace_summary", error);
        return toolError("Failed to load workspace summary. Try again.");
      }

      let outstanding = 0;
      const buckets = {
        "1-30": { count: 0, total: 0 },
        "31-60": { count: 0, total: 0 },
        "60+": { count: 0, total: 0 },
      };
      let notYetDue = 0;

      for (const inv of invoices ?? []) {
        const amt = Number(inv.amount_inr);
        outstanding += amt;
        const diff = Math.floor(
          (new Date(today).getTime() - new Date(inv.due_date).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (diff <= 0) {
          notYetDue++;
        } else if (diff <= 30) {
          buckets["1-30"].count++;
          buckets["1-30"].total += amt;
        } else if (diff <= 60) {
          buckets["31-60"].count++;
          buckets["31-60"].total += amt;
        } else {
          buckets["60+"].count++;
          buckets["60+"].total += amt;
        }
      }

      return toolJson({
        today_ist: today,
        outstanding_inr: outstanding,
        not_yet_due_count: notYetDue,
        overdue_buckets: buckets,
        dashboard_url: `${APP_URL}/dashboard`,
      });
    }
  );

  // ── Tool 2: list_invoices ──────────────────────────────────────────
  server.registerTool(
    "list_invoices",
    {
      description:
        "List invoices, optionally filtered by status (open, promised, paid, disputed). Returns invoice_no, customer, amount, due_date, status, and days_overdue.",
      inputSchema: z.object({
        status: z
          .enum(["open", "promised", "paid", "disputed"])
          .describe("Filter by invoice status")
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .describe("Max rows to return (default 50)")
          .optional(),
      }),
    },
    async ({ status, limit }) => {
      let query = db
        .from("invoices")
        .select(
          "invoice_no, customer_name, customer_phone, amount_inr, due_date, status"
        )
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true })
        .limit(limit ?? 50);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        logErr("list_invoices", error);
        return toolError("Failed to list invoices. Try again.");
      }

      const today = todayIST();
      const rows = (data ?? []).map((inv) => {
        const diff = Math.floor(
          (new Date(today).getTime() - new Date(inv.due_date).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return { ...inv, days_overdue: diff > 0 ? diff : 0 };
      });

      return toolJson({ invoices: rows, invoices_url: `${APP_URL}/invoices` });
    }
  );

  // ── Tool 3: upsert_invoices ────────────────────────────────────────
  server.registerTool(
    "upsert_invoices",
    {
      description:
        "Add or update invoices. If invoice_no already exists it is updated — only fields you include are changed (omitted phone/email/notes stay as-is). Returns created/updated counts and a link to view them.",
      inputSchema: z.object({
        invoices: z
          .array(
            z.object({
              invoice_no: z
                .string()
                .min(1)
                .describe("Unique invoice identifier, e.g. INV-1041"),
              customer_name: z
                .string()
                .min(1)
                .describe("Business or person name"),
              customer_phone: z
                .string()
                .describe(
                  "Phone digits only. 10 digits assumed +91. Include country code for non-Indian numbers."
                )
                .optional(),
              customer_email: z
                .string()
                .email()
                .describe("Customer email address")
                .optional(),
              amount_inr: z
                .number()
                .positive()
                .describe(
                  "Amount in plain rupees as a number — no commas, no currency symbol. E.g. 125000 not 1,25,000."
                ),
              due_date: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
                .describe(
                  "Due date in YYYY-MM-DD. Call get_workspace_summary first for today's date and infer the year from context."
                ),
              notes: z.string().describe("Optional notes about this invoice").optional(),
            })
          )
          .min(1)
          .max(100)
          .describe("Array of invoices to add or update (max 100)"),
      }),
    },
    async ({ invoices: items }) => {
      const rows = items.map((item) => ({
        workspace_id: workspaceId,
        invoice_no: item.invoice_no,
        customer_name: item.customer_name,
        ...(item.customer_phone !== undefined && {
          customer_phone: normalizePhone(item.customer_phone),
        }),
        ...(item.customer_email !== undefined && {
          customer_email: item.customer_email,
        }),
        amount_inr: item.amount_inr,
        due_date: item.due_date,
        ...(item.notes !== undefined && { notes: item.notes }),
      }));

      const { data, error } = await db
        .from("invoices")
        .upsert(rows, {
          onConflict: "workspace_id,invoice_no",
          ignoreDuplicates: false,
        })
        .select("id, invoice_no");

      if (error) {
        logErr("upsert_invoices", error);
        return toolError("Failed to upsert invoices. Try again.");
      }

      const upserted = data ?? [];

      // Bulk insert events
      if (upserted.length > 0) {
        const eventRows = upserted.map((inv) => ({
          workspace_id: workspaceId,
          invoice_id: inv.id,
          type: "invoice_upserted",
          note: "Upserted via MCP",
        }));
        const { error: evErr } = await db.from("events").insert(eventRows);
        if (evErr) logErr("upsert_invoices:events", evErr);
      }

      return toolJson({
        upserted: upserted.length,
        invoice_nos: upserted.map((r) => r.invoice_no),
        invoices_url: `${APP_URL}/invoices`,
      });
    }
  );

  // ── Tool 4: create_followups ───────────────────────────────────────
  server.registerTool(
    "create_followups",
    {
      description:
        "Create follow-up messages for invoices. Saved as DRAFTS for human review — never sent automatically. Write the actual final message text: short, warm Indian business English, name the invoice number, amount (with ₹) and due date. No placeholders like [name] or {amount}. Escalate tone: friendly for early, firm for mid, final for very late. Invoices already marked paid are skipped and reported.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              invoice_no: z
                .string()
                .min(1)
                .describe("The invoice this follow-up is for"),
              send_on: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
                .describe(
                  "Scheduled send date in YYYY-MM-DD. Call get_workspace_summary first for today's date."
                ),
              channel: z
                .enum(["whatsapp", "email"])
                .describe("Delivery channel"),
              tone: z
                .enum(["friendly", "firm", "final"])
                .describe(
                  "Message tone — friendly (1-15 days late), firm (15-45), final (45+)"
                ),
              message: z
                .string()
                .min(1)
                .max(2000)
                .describe(
                  "The complete, ready-to-send message. No placeholders. Short and warm."
                ),
            })
          )
          .min(1)
          .max(100)
          .describe("Array of follow-ups to create (max 100)"),
      }),
    },
    async ({ items }) => {
      let created = 0;
      const skippedPaid: string[] = [];
      const notFound: string[] = [];

      // Resolve all invoice_nos in one query
      const invoiceNos = [...new Set(items.map((i) => i.invoice_no))];
      const { data: invoices, error: lookupErr } = await db
        .from("invoices")
        .select("id, invoice_no, status")
        .eq("workspace_id", workspaceId)
        .in("invoice_no", invoiceNos);

      if (lookupErr) {
        logErr("create_followups:lookup", lookupErr);
        return toolError("Failed to look up invoices. Try again.");
      }

      const invoiceMap = new Map(
        (invoices ?? []).map((inv) => [inv.invoice_no, inv])
      );

      const insertRows: Array<Record<string, unknown>> = [];
      const eventRows: Array<Record<string, unknown>> = [];

      for (const item of items) {
        const invoice = invoiceMap.get(item.invoice_no);
        if (!invoice) {
          notFound.push(item.invoice_no);
          continue;
        }
        if (invoice.status === "paid") {
          skippedPaid.push(item.invoice_no);
          continue;
        }

        insertRows.push({
          workspace_id: workspaceId,
          invoice_id: invoice.id,
          send_on: item.send_on,
          channel: item.channel,
          tone: item.tone,
          message_text: item.message,
          status: "draft",
        });

        eventRows.push({
          workspace_id: workspaceId,
          invoice_id: invoice.id,
          type: "followup_drafted",
          note: `${item.tone} ${item.channel} follow-up for ${item.send_on}`,
        });
      }

      if (insertRows.length > 0) {
        const { data: inserted, error: insErr } = await db
          .from("followups")
          .upsert(insertRows, {
            onConflict: "invoice_id,send_on,channel",
            ignoreDuplicates: false,
          })
          .select("id");

        if (insErr) {
          logErr("create_followups:insert", insErr);
          return toolError("Failed to create follow-ups. Try again.");
        }
        created = inserted?.length ?? 0;

        if (eventRows.length > 0) {
          const { error: evErr } = await db.from("events").insert(eventRows);
          if (evErr) logErr("create_followups:events", evErr);
        }
      }

      return toolJson({
        drafts_created: created,
        skipped_paid: skippedPaid.length > 0 ? skippedPaid : undefined,
        not_found: notFound.length > 0 ? notFound : undefined,
        review_url: `${APP_URL}/followups`,
      });
    }
  );

  // ── Tool 5: update_invoice_status ──────────────────────────────────
  server.registerTool(
    "update_invoice_status",
    {
      description:
        "Mark an invoice as paid, promised, disputed, or open. 'paid' sets paid_at and skips all pending follow-ups. 'promised' requires a promised_date and pauses follow-ups until that date + 1. Leaving 'promised' clears promised_date.",
      inputSchema: z.object({
        invoice_no: z
          .string()
          .min(1)
          .describe("The invoice to update"),
        status: z
          .enum(["open", "promised", "paid", "disputed"])
          .describe("New status for the invoice"),
        promised_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
          .describe(
            "Required when status is 'promised'. The date the customer promised to pay by."
          )
          .optional(),
        note: z
          .string()
          .max(500)
          .describe("Optional note for the audit trail, e.g. 'Paid via NEFT'")
          .optional(),
      }),
    },
    async ({ invoice_no, status, promised_date, note }) => {
      if (status === "promised" && !promised_date) {
        return toolError(
          "promised_date is required when status is 'promised'."
        );
      }

      const { data: invoice, error: fetchErr } = await db
        .from("invoices")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("invoice_no", invoice_no)
        .maybeSingle();

      if (fetchErr) {
        logErr("update_invoice_status:fetch", fetchErr);
        return toolError("Failed to look up invoice. Try again.");
      }
      if (!invoice) {
        return toolError(`Invoice ${invoice_no} not found.`);
      }

      const updates: Record<string, unknown> = { status };

      if (status === "paid") {
        updates.paid_at = new Date().toISOString();
        updates.promised_date = null;
      } else if (status === "promised") {
        updates.promised_date = promised_date;
      } else {
        // leaving promised → clear promised_date; leaving paid → clear paid_at
        if (invoice.status === "promised") updates.promised_date = null;
        if (invoice.status === "paid") updates.paid_at = null;
      }

      const { error: updateErr } = await db
        .from("invoices")
        .update(updates)
        .eq("id", invoice.id);

      if (updateErr) {
        logErr("update_invoice_status:update", updateErr);
        return toolError("Failed to update invoice. Try again.");
      }

      let followupsSkipped = 0;
      if (status === "paid") {
        const { data: skipped } = await db
          .from("followups")
          .update({ status: "skipped" })
          .eq("invoice_id", invoice.id)
          .in("status", ["draft", "approved"])
          .select("id");
        followupsSkipped = skipped?.length ?? 0;
      }

      await db.from("events").insert({
        workspace_id: workspaceId,
        invoice_id: invoice.id,
        type: `status_${status}`,
        note: note ?? `Marked ${status} via MCP`,
      });

      return toolJson({
        invoice_no,
        new_status: status,
        followups_skipped: followupsSkipped,
        invoice_url: `${APP_URL}/invoices`,
      });
    }
  );

  return server;
}
