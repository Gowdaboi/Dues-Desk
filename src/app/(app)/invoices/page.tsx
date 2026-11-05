import { createSSRClient, getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { redirect } from "next/navigation";
import { InvoiceTable } from "./invoice-table";

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <span className="text-sm text-muted-foreground">
          {invoices?.length ?? 0} total
        </span>
      </div>
      <InvoiceTable invoices={invoices ?? []} />
    </div>
  );
}
