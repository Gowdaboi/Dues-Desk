"use client";

import { useState, useTransition } from "react";
import { rotateToken, resetDemoData, ensureWorkspace } from "./actions";
import { useRouter } from "next/navigation";

type Workspace = {
  id: string;
  name: string;
  mcp_token: string;
} | null;

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function SettingsPanel({
  workspace,
  appUrl,
  demoMode = false,
}: {
  workspace: Workspace;
  appUrl: string;
  demoMode?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!workspace) {
    return (
      <div className="rounded-xl border border-border p-8 text-center">
        <p className="mb-4 text-muted-foreground">
          No workspace yet. Create one to get started.
        </p>
        <button
          onClick={() =>
            startTransition(async () => {
              await ensureWorkspace();
              router.refresh();
            })
          }
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create Workspace"}
        </button>
      </div>
    );
  }

  const mcpUrl = `${appUrl}/api/mcp/${workspace.mcp_token}`;

  function copyUrl() {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRotate() {
    if (!confirm("Rotate token? Your current MCP URL will stop working.")) return;
    startTransition(async () => {
      await rotateToken();
      router.refresh();
    });
  }

  function handleReset() {
    if (!confirm("Delete ALL invoices, follow-ups, and events? This cannot be undone."))
      return;
    if (demoMode && !confirm("Are you sure? This resets demo data for everyone."))
      return;
    startTransition(async () => {
      await resetDemoData();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-6">
        <h2 className="mb-1 text-lg font-semibold">MCP Server URL</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Add this URL to your Claude MCP config to connect.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-hidden rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">
            {escapeText(mcpUrl)}
          </code>
          <button
            onClick={copyUrl}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground hover:opacity-90"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {!demoMode && (
        <div className="rounded-xl border border-border p-6">
          <h2 className="mb-1 text-lg font-semibold">Security</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Rotate your MCP token if it was compromised.
          </p>
          <button
            onClick={handleRotate}
            disabled={pending}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {pending ? "Rotating..." : "Rotate Token"}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-destructive/30 p-6">
        <h2 className="mb-1 text-lg font-semibold text-destructive">Danger Zone</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Delete all invoices, follow-ups, and events. Cannot be undone.
        </p>
        <button
          onClick={handleReset}
          disabled={pending}
          className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Resetting..." : "Reset All Data"}
        </button>
      </div>
    </div>
  );
}
