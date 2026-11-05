"use client";

import { useState, useTransition } from "react";
import { updateInvoiceField, changeInvoiceStatus } from "./actions";

type Invoice = {
  id: string;
  invoice_no: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  amount_inr: number;
  due_date: string;
  status: string;
  promised_date: string | null;
  paid_at: string | null;
  notes: string | null;
};

const STATUS_OPTIONS = ["open", "promised", "paid", "disputed"] as const;

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  promised: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  disputed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function daysOverdue(dueDate: string) {
  const now = new Date();
  const due = new Date(dueDate);
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

function escapeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function EditableCell({
  value,
  invoiceId,
  field,
}: {
  value: string;
  invoiceId: string;
  field: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  function save() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await updateInvoiceField(invoiceId, field, draft);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        disabled={pending}
        className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-accent"
      />
    );
  }

  return (
    <span
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-muted"
      title="Click to edit"
    >
      {escapeText(value) || " "}
    </span>
  );
}

function StatusDropdown({
  invoiceId,
  currentStatus,
}: {
  invoiceId: string;
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return;

    let promisedDate: string | undefined;
    if (newStatus === "promised") {
      const dateStr = prompt("Enter promised payment date (YYYY-MM-DD):");
      if (!dateStr) return;
      promisedDate = dateStr;
    }

    startTransition(async () => {
      await changeInvoiceStatus(invoiceId, currentStatus, newStatus, promisedDate);
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={(e) => handleChange(e.target.value)}
      disabled={pending}
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[currentStatus] ?? ""} border-none outline-none cursor-pointer`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/50 py-16 text-center">
        <p className="text-muted-foreground">
          No invoices yet. Use the MCP tools to add invoices from Claude.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Invoice</th>
            <th className="px-4 py-3 text-left font-medium">Customer</th>
            <th className="px-4 py-3 text-left font-medium">Phone</th>
            <th className="px-4 py-3 text-right font-medium">Amount</th>
            <th className="px-4 py-3 text-left font-medium">Due Date</th>
            <th className="px-4 py-3 text-center font-medium">Overdue</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const overdue = daysOverdue(inv.due_date);
            return (
              <tr
                key={inv.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/30"
              >
                <td className="px-4 py-2.5 font-mono text-xs">
                  {escapeText(inv.invoice_no)}
                </td>
                <td className="px-4 py-2.5">
                  <EditableCell
                    value={inv.customer_name}
                    invoiceId={inv.id}
                    field="customer_name"
                  />
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  <EditableCell
                    value={inv.customer_phone ?? ""}
                    invoiceId={inv.id}
                    field="customer_phone"
                  />
                </td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {formatINR(inv.amount_inr)}
                </td>
                <td className="px-4 py-2.5">{inv.due_date}</td>
                <td className="px-4 py-2.5 text-center">
                  {inv.status !== "paid" && overdue > 0 ? (
                    <span className="text-destructive font-medium">
                      {overdue}d
                    </span>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <StatusDropdown
                    invoiceId={inv.id}
                    currentStatus={inv.status}
                  />
                </td>
                <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">
                  <EditableCell
                    value={inv.notes ?? ""}
                    invoiceId={inv.id}
                    field="notes"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
