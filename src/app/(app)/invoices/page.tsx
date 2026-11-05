import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { redirect } from "next/navigation";
import { APP_URL } from "@/lib/constants";
import { InvoiceTable } from "./invoice-table";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConnectClaudeCard } from "@/components/connect-claude-card";

export const instant = false;

export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceForUser(user.id);
  if (!workspace) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No workspace found. Connect your MCP client to create one.</p>
      </div>
    );
  }

  const supabase = await createSSRClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("due_date", { ascending: true });

  const mcpUrl = `${APP_URL}/api/mcp/${workspace.mcp_token}`;
  const hasInvoices = (invoices?.length ?? 0) > 0;

  return (
    <div>
      <AutoRefresh intervalMs={5000} />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <span className="text-sm text-muted-foreground">
          {invoices?.length ?? 0} total
        </span>
      </div>
      {hasInvoices ? (
        <InvoiceTable invoices={invoices!} />
      ) : (
        <ConnectClaudeCard mcpUrl={mcpUrl} />
      )}
    </div>
  );
}
