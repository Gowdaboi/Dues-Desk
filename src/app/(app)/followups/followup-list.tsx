"use client";

import { useState, useTransition } from "react";
import { updateFollowupMessage, updateFollowupStatus } from "./actions";

type Followup = {
  id: string;
  invoice_id: string;
  send_on: string;
  channel: string;
  tone: string;
  message_text: string;
  status: string;
  edited_by_human: boolean;
  invoices: {
    invoice_no: string;
    customer_name: string;
    customer_phone: string | null;
    amount_inr: number;
    status: string;
    promised_date: string | null;
  };
};

const STATUS_GROUPS = ["draft", "approved", "sent", "skipped"] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  skipped: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400",
};

const TONE_COLORS: Record<string, string> = {
  friendly: "text-green-600 dark:text-green-400",
  firm: "text-yellow-600 dark:text-yellow-400",
  final: "text-red-600 dark:text-red-400",
};

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function whatsappLink(phone: string | null, message: string) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function FollowupCard({ followup, isDueToday, today }: { followup: Followup; isDueToday: boolean; today: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(followup.message_text);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function saveMessage() {
    if (draft === followup.message_text) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateFollowupMessage(followup.id, draft);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function handleStatus(status: "approved" | "skipped" | "sent") {
    setError(null);
    startTransition(async () => {
      try {
        await updateFollowupStatus(followup.id, status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Status change failed");
      }
    });
  }

  const waLink = whatsappLink(followup.invoices.customer_phone, followup.message_text);

  return (
    <div
      className={`rounded-lg border p-4 ${
        isDueToday ? "border-accent bg-accent/5" : "border-border"
      } ${pending ? "opacity-50" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium">
          {escapeText(followup.invoices.invoice_no)}
        </span>
        <span className="text-sm">{escapeText(followup.invoices.customer_name)}</span>
        <span className={`text-xs font-medium ${TONE_COLORS[followup.tone] ?? ""}`}>
          {followup.tone}
        </span>
        <span className="text-xs text-muted-foreground">{followup.channel}</span>
        <span className="text-xs text-muted-foreground">{followup.send_on}</span>
        {followup.edited_by_human && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            edited
          </span>
        )}
        {isDueToday && (() => {
          const overdueDays = Math.floor(
            (new Date(today).getTime() - new Date(followup.send_on).getTime()) / (1000 * 60 * 60 * 24)
          );
          return (
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {overdueDays > 0 ? `OVERDUE BY ${overdueDays}d` : "DUE TODAY"}
            </span>
          );
        })()}
      </div>

      {editing ? (
        <div className="mb-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              onClick={saveMessage}
              disabled={pending}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
            >
              Save
            </button>
            <button
              onClick={() => {
                setDraft(followup.message_text);
                setEditing(false);
              }}
              className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          onClick={() => {
            if (followup.status === "draft" || followup.status === "approved") {
              setDraft(followup.message_text);
              setEditing(true);
            }
          }}
          className={`mb-3 whitespace-pre-wrap text-sm ${
            followup.status === "draft" || followup.status === "approved"
              ? "cursor-pointer rounded px-1 hover:bg-muted"
              : ""
          }`}
        >
          {escapeText(followup.message_text)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {followup.status === "draft" && (
          <>
            <button
              onClick={() => handleStatus("approved")}
              disabled={pending}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
            >
              Approve
            </button>
            <button
              onClick={() => handleStatus("skipped")}
              disabled={pending}
              className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Skip
            </button>
          </>
        )}
        {followup.status === "approved" && (
          <>
            <button
              onClick={() => handleStatus("sent")}
              disabled={pending}
              className="rounded-md bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Mark Sent
            </button>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:opacity-90"
              >
                Send on WhatsApp
              </a>
            )}
            <button
              onClick={() => handleStatus("skipped")}
              disabled={pending}
              className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Skip
            </button>
          </>
        )}
        {followup.status === "sent" && waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Resend on WhatsApp
          </a>
        )}
      </div>
      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

export function FollowupList({
  followups,
  today,
}: {
  followups: Followup[];
  today: string;
}) {
  const [filter, setFilter] = useState<string>("all");

  if (followups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-muted/50 py-16 text-center">
        <p className="text-muted-foreground">
          No follow-ups yet. Use the MCP tools to create draft messages.
        </p>
      </div>
    );
  }

  const dueToday = followups.filter(
    (f) =>
      f.send_on <= today &&
      (f.status === "draft" || f.status === "approved") &&
      f.invoices.status !== "paid" &&
      (!f.invoices.promised_date || f.invoices.promised_date < today)
  );

  const filtered =
    filter === "all"
      ? followups
      : followups.filter((f) => f.status === filter);

  return (
    <div className="space-y-6">
      {dueToday.length > 0 && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-accent">
            Due Today ({dueToday.length})
          </h2>
          <div className="space-y-3">
            {dueToday.map((f) => (
              <FollowupCard key={f.id} followup={f} isDueToday today={today} />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {["all", ...STATUS_GROUPS].map((s) => {
          const count =
            s === "all"
              ? followups.length
              : followups.filter((f) => f.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === s
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered.map((f) => (
          <FollowupCard
            key={f.id}
            followup={f}
            isDueToday={f.send_on <= today}
            today={today}
          />
        ))}
      </div>
    </div>
  );
}
