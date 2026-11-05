import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { redirect } from "next/navigation";
import { todayIST, APP_URL } from "@/lib/constants";
import { FollowupList } from "./followup-list";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConnectClaudeCard } from "@/components/connect-claude-card";

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

  const mcpUrl = `${APP_URL}/api/mcp/${workspace.mcp_token}`;
  const hasFollowups = (followups?.length ?? 0) > 0;

  return (
    <div>
      <AutoRefresh intervalMs={5000} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Today: {today}</p>
      </div>
      {hasFollowups ? (
        <FollowupList followups={followups!} today={today} />
      ) : (
        <ConnectClaudeCard mcpUrl={mcpUrl} />
      )}
    </div>
  );
}
