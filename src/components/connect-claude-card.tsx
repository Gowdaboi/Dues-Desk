"use client";

import { useState } from "react";

const SAMPLE_PROMPT = `I have these overdue invoices. Please add them and draft follow-up messages:

INV-1041 Sharma Traders ₹48,000 due 12 Oct
INV-1042 Bluepeak Interiors ₹1,25,000 due 28 Sep
INV-1045 Kaveri Foods ₹22,500 due 20 Oct
INV-1047 Nandi Logistics ₹74,000 due 2 Oct
INV-1050 Lotus Clinic ₹15,000 due 29 Oct
INV-1052 Orbit Studios ₹2,10,000 due 15 Sep`;

export function ConnectClaudeCard({ mcpUrl }: { mcpUrl: string | null }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  function copyMcpUrl() {
    if (!mcpUrl) return;
    navigator.clipboard.writeText(mcpUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  function copyPrompt() {
    navigator.clipboard.writeText(SAMPLE_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-muted/30 p-8">
      <h2 className="mb-1 text-lg font-semibold">Connect Claude to get started</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Dues Desk works with Claude. Add your invoices by chatting — no manual entry needed.
      </p>

      <ol className="space-y-5 text-sm">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            1
          </span>
          <div className="flex-1">
            <p className="font-medium">Copy your MCP URL</p>
            {mcpUrl ? (
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 overflow-hidden rounded-lg bg-muted px-2.5 py-1.5 font-mono text-[11px] break-all">
                  {mcpUrl}
                </code>
                <button
                  onClick={copyMcpUrl}
                  className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
                >
                  {copiedUrl ? "Copied!" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="mt-1 text-muted-foreground">
                Go to <strong>Settings</strong> to find your MCP URL.
              </p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            2
          </span>
          <div>
            <p className="font-medium">Add it in Claude</p>
            <p className="mt-1 text-muted-foreground">
              Open Claude &rarr; <strong>Customize</strong> &rarr; <strong>Connectors</strong> &rarr;{" "}
              <strong>Add custom connector</strong> &rarr; paste the URL &rarr; choose{" "}
              <strong>&ldquo;No sign in&rdquo;</strong>.
            </p>
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            3
          </span>
          <div className="flex-1">
            <p className="font-medium">Paste this sample prompt</p>
            <div className="mt-1.5 rounded-lg bg-muted p-3">
              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                {SAMPLE_PROMPT}
              </pre>
              <button
                onClick={copyPrompt}
                className="mt-2 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:opacity-90"
              >
                {copiedPrompt ? "Copied!" : "Copy prompt"}
              </button>
            </div>
          </div>
        </li>
      </ol>
    </div>
  );
}
