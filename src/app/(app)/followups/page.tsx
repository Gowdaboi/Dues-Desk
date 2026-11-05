import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { redirect } from "next/navigation";
import { todayIST } from "@/lib/constants";
import { FollowupList } from "./followup-list";

export const instant = false;

export default async function FollowupsPage() {
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
  const { data: followups } = await supabase
    .from("followups")
    .select("*, invoices!inner(invoice_no, customer_name, customer_phone, amount_inr, status, promised_date)")
    .eq("workspace_id", workspace.id)
    .order("send_on", { ascending: true });

  const today = todayIST();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Today: {today}</p>
      </div>
      <FollowupList followups={followups ?? []} today={today} />
    </div>
  );
}
