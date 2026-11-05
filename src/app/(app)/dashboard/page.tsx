import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { redirect } from "next/navigation";
import { todayIST } from "@/lib/constants";

export const instant = false;

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No workspace found.
      </div>
    );
  }

  const supabase = await createSSRClient();
  const today = todayIST();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("amount_inr, due_date, status")
    .eq("workspace_id", workspace.id)
    .in("status", ["open", "promised", "disputed"]);

  let outstanding = 0;
  const buckets = { "1-30": { count: 0, total: 0 }, "31-60": { count: 0, total: 0 }, "60+": { count: 0, total: 0 } };
  let notYetDue = 0;

  for (const inv of invoices ?? []) {
    const amt = Number(inv.amount_inr);
    outstanding += amt;
    const diff = Math.floor(
      (new Date(today).getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff <= 0) notYetDue++;
    else if (diff <= 30) { buckets["1-30"].count++; buckets["1-30"].total += amt; }
    else if (diff <= 60) { buckets["31-60"].count++; buckets["31-60"].total += amt; }
    else { buckets["60+"].count++; buckets["60+"].total += amt; }
  }

  // Due Today: draft/approved followups due today or earlier, excluding paid
  // invoices and invoices with a promised_date that hasn't passed yet
  const { count: dueTodayCount } = await supabase
    .from("followups")
    .select("id, invoices!inner(id)", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .lte("send_on", today)
    .in("status", ["draft", "approved"])
    .neq("invoices.status", "paid")
    .or(`promised_date.is.null,promised_date.lt.${today}`, { referencedTable: "invoices" });

  const stats = [
    { label: "Outstanding", value: formatINR(outstanding), sub: `${(invoices ?? []).length} invoices` },
    { label: "Due Today", value: String(dueTodayCount ?? 0), sub: "follow-ups pending" },
    { label: "Not Yet Due", value: String(notYetDue), sub: "invoices" },
  ];

  const bucketCards = [
    { label: "1-30 days", ...buckets["1-30"] },
    { label: "31-60 days", ...buckets["31-60"] },
    { label: "60+ days", ...buckets["60+"] },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today: {escapeText(today)}</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-border p-5"
          >
            <p className="text-sm text-muted-foreground">{escapeText(s.label)}</p>
            <p className="mt-1 text-2xl font-bold">{escapeText(s.value)}</p>
            <p className="text-xs text-muted-foreground">{escapeText(s.sub)}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Overdue Buckets</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {bucketCards.map((b) => (
          <div
            key={b.label}
            className="rounded-xl border border-border p-5"
          >
            <p className="text-sm text-muted-foreground">{escapeText(b.label)}</p>
            <p className="mt-1 text-xl font-bold">
              {b.count} <span className="text-sm font-normal text-muted-foreground">invoices</span>
            </p>
            <p className="text-sm font-medium">{formatINR(b.total)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
