import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "../phone";
import { APP_URL, todayIST } from "../constants";

export function createDuesDeskMcp(
  db: SupabaseClient,
  workspaceId: string
): McpServer {
  const server = new McpServer({
    name: "dues-desk",
    version: "1.0.0",
  });

  // Tool 1: get_workspace_summary
  server.tool(
    "get_workspace_summary",
    "Returns today's date (IST), outstanding total, overdue buckets (1-30, 31-60, 60+ days) with counts and totals. Call this first to understand the current state.",
    {},
    async () => {
      const today = todayIST();

      const { data: invoices, error } = await db
        .from("invoices")
        .select("amount_inr, due_date, status")
        .eq("workspace_id", workspaceId)
        .in("status", ["open", "promised", "disputed"]);

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }

      let outstanding = 0;
      const buckets = { "1-30": { count: 0, total: 0 }, "31-60": { count: 0, total: 0 }, "60+": { count: 0, total: 0 } };
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

      const summary = {
        today_ist: today,
        outstanding_inr: outstanding,
        not_yet_due_count: notYetDue,
        overdue_buckets: buckets,
        dashboard_url: `${APP_URL}/dashboard`,
      };

      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    }
  );

  // Tool 3: upsert_invoices
  server.tool(
    "upsert_invoices",
    "Add or update invoices. Each invoice needs invoice_no (unique), customer_name, amount_inr, and due_date (YYYY-MM-DD). If an invoice_no already exists for this workspace, it will be updated. Returns created/updated counts and a link to view them.",
    {
      invoices: z
        .array(
          z.object({
            invoice_no: z.string().min(1),
            customer_name: z.string().min(1),
            customer_phone: z.string().optional(),
            customer_email: z.string().email().optional(),
            amount_inr: z.number().positive(),
            due_date: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
            notes: z.string().optional(),
          })
        )
        .min(1)
        .max(100),
    },
    async ({ invoices: items }) => {
      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const item of items) {
        const phone = normalizePhone(item.customer_phone);

        const { data: existing } = await db
          .from("invoices")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("invoice_no", item.invoice_no)
          .maybeSingle();

        if (existing) {
          const { error } = await db
            .from("invoices")
            .update({
              customer_name: item.customer_name,
              customer_phone: phone,
              customer_email: item.customer_email ?? null,
              amount_inr: item.amount_inr,
              due_date: item.due_date,
              notes: item.notes ?? null,
            })
            .eq("id", existing.id);

          if (error) {
            errors.push(`${item.invoice_no}: ${error.message}`);
          } else {
            updated++;
            await db.from("events").insert({
              workspace_id: workspaceId,
              invoice_id: existing.id,
              type: "invoice_updated",
              note: `Updated via MCP`,
            });
          }
        } else {
          const { data: newInv, error } = await db
            .from("invoices")
            .insert({
              workspace_id: workspaceId,
              invoice_no: item.invoice_no,
              customer_name: item.customer_name,
              customer_phone: phone,
              customer_email: item.customer_email ?? null,
              amount_inr: item.amount_inr,
              due_date: item.due_date,
              notes: item.notes ?? null,
            })
            .select("id")
            .single();

          if (error) {
            errors.push(`${item.invoice_no}: ${error.message}`);
          } else {
            created++;
            await db.from("events").insert({
              workspace_id: workspaceId,
              invoice_id: newInv.id,
              type: "invoice_created",
              note: `Created via MCP`,
            });
          }
        }
      }

      const result = {
        created,
        updated,
        errors: errors.length > 0 ? errors : undefined,
        invoices_url: `${APP_URL}/invoices`,
      };

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 2: list_invoices
  server.tool(
    "list_invoices",
    "List invoices, optionally filtered by status (open, promised, paid, disputed). Returns invoice_no, customer, amount, due_date, status, and days_overdue for each.",
    {
      status: z.enum(["open", "promised", "paid", "disputed"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ status, limit }) => {
      let query = db
        .from("invoices")
        .select("invoice_no, customer_name, customer_phone, amount_inr, due_date, status")
        .eq("workspace_id", workspaceId)
        .order("due_date", { ascending: true })
        .limit(limit ?? 50);

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
      }

      const today = todayIST();
      const rows = (data ?? []).map((inv) => {
        const diff = Math.floor(
          (new Date(today).getTime() - new Date(inv.due_date).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return {
          ...inv,
          days_overdue: diff > 0 ? diff : 0,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { invoices: rows, invoices_url: `${APP_URL}/invoices` },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 4: create_followups
  server.tool(
    "create_followups",
    "Create follow-up messages for invoices. Each follow-up is saved as a DRAFT that the human must approve before sending. Write the actual final message text — short, warm Indian business English, naming the invoice number, amount and due date. No placeholders like [name] or {amount}. Escalate tone: friendly for early, firm for mid, final for very late.",
    {
      items: z
        .array(
          z.object({
            invoice_no: z.string().min(1),
            send_on: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
            channel: z.enum(["whatsapp", "email"]),
            tone: z.enum(["friendly", "firm", "final"]),
            message: z.string().min(1).max(2000),
          })
        )
        .min(1)
        .max(100),
    },
    async ({ items }) => {
      let created = 0;
      const errors: string[] = [];

      for (const item of items) {
        const { data: invoice } = await db
          .from("invoices")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("invoice_no", item.invoice_no)
          .maybeSingle();

        if (!invoice) {
          errors.push(`${item.invoice_no}: invoice not found`);
          continue;
        }

        const { error } = await db.from("followups").insert({
          workspace_id: workspaceId,
          invoice_id: invoice.id,
          send_on: item.send_on,
          channel: item.channel,
          tone: item.tone,
          message_text: item.message,
          status: "draft",
        });

        if (error) {
          errors.push(`${item.invoice_no}: ${error.message}`);
        } else {
          created++;
          await db.from("events").insert({
            workspace_id: workspaceId,
            invoice_id: invoice.id,
            type: "followup_drafted",
            note: `${item.tone} ${item.channel} follow-up for ${item.send_on}`,
          });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                drafts_created: created,
                errors: errors.length > 0 ? errors : undefined,
                review_url: `${APP_URL}/followups`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Tool 5: update_invoice_status
  server.tool(
    "update_invoice_status",
    "Mark an invoice as paid, promised, disputed, or open. Marking 'paid' automatically skips all pending follow-ups. Marking 'promised' with a date pauses follow-ups until that date + 1 day.",
    {
      invoice_no: z.string().min(1),
      status: z.enum(["open", "promised", "paid", "disputed"]),
      promised_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")
        .optional(),
      note: z.string().max(500).optional(),
    },
    async ({ invoice_no, status, promised_date, note }) => {
      if (status === "promised" && !promised_date) {
        return {
          content: [{ type: "text", text: "Error: promised_date is required when status is 'promised'" }],
          isError: true,
        };
      }

      const { data: invoice, error: fetchErr } = await db
        .from("invoices")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .eq("invoice_no", invoice_no)
        .maybeSingle();

      if (fetchErr || !invoice) {
        return {
          content: [{ type: "text", text: `Error: invoice ${invoice_no} not found` }],
          isError: true,
        };
      }

      const updates: Record<string, unknown> = { status };
      if (status === "promised") {
        updates.promised_date = promised_date;
      }

      const { error: updateErr } = await db
        .from("invoices")
        .update(updates)
        .eq("id", invoice.id);

      if (updateErr) {
        return {
          content: [{ type: "text", text: `Error: ${updateErr.message}` }],
          isError: true,
        };
      }

      // If paid: skip all draft and approved followups
      if (status === "paid") {
        await db
          .from("followups")
          .update({ status: "skipped" })
          .eq("invoice_id", invoice.id)
          .in("status", ["draft", "approved"]);
      }

      await db.from("events").insert({
        workspace_id: workspaceId,
        invoice_id: invoice.id,
        type: `status_${status}`,
        note: note ?? `Marked ${status} via MCP`,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                invoice_no,
                new_status: status,
                followups_skipped: status === "paid" ? true : false,
                invoice_url: `${APP_URL}/invoices`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
