# Dues Desk

A collections follow-up desk for Indian SMEs. Paste overdue invoices into Claude, get draft follow-up messages, then review, edit, approve and send them yourself via WhatsApp click-to-send.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Claude (external — writes every message)           │
│  ┌────────────────────────────────────────────┐     │
│  │  MCP Connector (Streamable HTTP, stateless) │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │ JSON-RPC over HTTPS            │
│  ┌──────────────────▼─────────────────────────┐     │
│  │  Next.js 16 App Router (Vercel)            │     │
│  │  /api/mcp/[token]  ← 7 MCP tools          │     │
│  │  /api/health       ← daily cron heartbeat  │     │
│  │  /(app)/*          ← dashboard, invoices,  │     │
│  │                       follow-ups, settings  │     │
│  └──────────────────┬─────────────────────────┘     │
│                     │                                │
│  ┌──────────────────▼─────────────────────────┐     │
│  │  Supabase (Postgres + Auth + RLS)          │     │
│  │  Tables: workspaces, invoices, followups,   │     │
│  │          events                             │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

**No AI inside.** There are zero LLM packages, API keys, or server-side text generation in this codebase. Claude writes every follow-up message externally via MCP; the app only stores and serves what Claude produces.

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
CRON_SECRET=<random string for /api/health auth>
```

For production (Vercel), also set:

```
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app   (no trailing slash)
DEMO_MODE=true                                        (hides token rotation, adds reset confirmation)
CRON_SECRET=<same random string>
```

> **Never commit real keys or tokens to the repo.**

## Connect to Claude

1. Sign in to Dues Desk and go to **Settings** to find your MCP URL.
2. In Claude, open **Settings > Connectors** (or **Customize > Connectors** on claude.ai).
3. Click **Add custom connector**, paste the URL, and choose **"No sign in"**.
4. Save. On Team/Enterprise plans, an Owner adds the connector from the workspace admin panel first.

> **Do not share your MCP URL publicly.** It contains a secret token that grants full access to your workspace data. Rotate it from Settings if compromised.

## MCP Tools (7)

Once connected, Claude has access to these tools:

| Tool | Description |
|------|-------------|
| `get_workspace_summary` | Today's date (IST), outstanding total, overdue buckets (1-30, 31-60, 60+ days) |
| `list_invoices` | List invoices filtered by status, with days_overdue |
| `upsert_invoices` | Create or update invoices (max 500 per workspace). Omitted fields are preserved on update |
| `create_followups` | Draft follow-up messages (max 2000 per workspace). Skips paid invoices. Upserts on (invoice, date, channel) |
| `update_invoice_status` | Mark invoices as paid, promised, disputed, or open. Paid auto-skips pending follow-ups |
| `list_followups` | List follow-ups filtered by status and due date, with invoice details |
| `update_followup_message` | Rewrite a draft follow-up message. Rejects edits to non-drafts |

## Known Limitations

- **Token-in-URL auth** is a demo-stage choice. Production should use OAuth or signed tokens.
- **No email/WhatsApp sending.** Follow-ups are drafted and approved in the UI; actual delivery is manual (WhatsApp click-to-send links are provided).
- **Free-tier hosting.** A daily Vercel cron keeps the Supabase project from pausing; Supabase's free tier has database size and bandwidth limits.
- **Per-workspace caps.** 500 invoices and 2000 follow-ups per workspace to prevent runaway usage.

## Roadmap

- OAuth-based MCP authentication
- Automated email delivery via SendGrid/Resend
- WhatsApp Business API integration
- Multi-user workspaces with role-based access
- Invoice PDF attachment support
- Scheduled follow-up auto-send with approval queue
