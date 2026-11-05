import { getSessionUser, getWorkspaceForUser } from "@/lib/supabase-ssr";
import { redirect } from "next/navigation";
import { APP_URL } from "@/lib/constants";
import { SettingsPanel } from "./settings-panel";

export const instant = false;

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceForUser(user.id);

  const demoMode = process.env.DEMO_MODE === "true";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <SettingsPanel
        workspace={workspace}
        appUrl={APP_URL}
        demoMode={demoMode}
      />
    </div>
  );
}
