# Dues Desk

A collections follow-up desk for Indian SMEs. Paste overdue invoices into Claude, get draft follow-up messages, then approve and send them via WhatsApp or email.

## Architecture

- **Next.js 16** App Router + Supabase (Postgres + Auth)
- **MCP server** at `/api/mcp/[token]` — 5 tools Claude calls to read invoices, create follow-ups, and update statuses
- **No AI/LLM packages inside the app** — Claude writes every message externally; the app only stores and serves

## Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service-role key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Never commit real keys or tokens to the repo.**

## Connect to Claude

1. Open Claude and go to **Settings > Connectors** (or **Customize > Connectors** on claude.ai).
2. Click **Add custom connector**.
3. Paste your MCP Server URL (find it on the Settings page of Dues Desk after signing in).
4. Choose **"No sign in"** as the authentication method.
5. Save.

On **Team or Enterprise** plans, an Owner must add the connector from the workspace admin panel before members can use it.

> **Do not share your MCP URL publicly.** It contains a secret token that grants full access to your workspace data. If compromised, rotate it from Settings.

## MCP Tools

Once connected, Claude has access to these tools:

| Tool | Description |
|------|-------------|
| `get_workspace_summary` | Outstanding total, overdue buckets, due-today count |
| `list_invoices` | List invoices with filters (status, overdue, etc.) |
| `upsert_invoices` | Create or update invoices from pasted data |
| `create_followups` | Draft follow-up messages for overdue invoices |
| `update_invoice_status` | Mark invoices as paid, promised, disputed, etc. |

## Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

Set the same environment variables in your Vercel project settings. Add `DEMO_MODE=true` if you want to hide token rotation and add a confirmation step before data reset.
