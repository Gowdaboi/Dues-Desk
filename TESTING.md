# Testing Dues Desk MCP with MCP Inspector

## Prerequisites
1. A Supabase project (free tier works)
2. Node.js 18+

## Setup Steps

### 1. Create Supabase tables
Go to your Supabase project → SQL Editor → paste and run both:
- `supabase/migrations/001_schema.sql`
- `supabase/migrations/002_followup_unique_paid_at.sql`

### 2. Create a test user + workspace
- Go to Authentication → Users → "Add user" with any email/password you choose
- Copy the user's UUID
- Generate a token:
```bash
openssl rand -hex 32
```
- Run in SQL Editor (replace placeholders):
```sql
INSERT INTO workspaces (name, mcp_token, owner_user_id)
VALUES ('Demo Studio', '<your-generated-token>', '<paste-user-uuid>');
```

### 3. Configure env
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and service role key
```

### 4. Start the dev server
```bash
npm run dev
```

### 5. Test with MCP Inspector
```bash
npx @modelcontextprotocol/inspector
```

In the Inspector UI:
- **Transport**: Streamable HTTP
- **URL**: `http://localhost:3000/api/mcp/<your-generated-token>`

### 6. Test the tools

**get_workspace_summary** (no params):
→ Should return today's date in IST, zero outstanding

**upsert_invoices** (run this twice to verify idempotency):
```json
{
  "invoices": [
    {
      "invoice_no": "INV-1041",
      "customer_name": "Sharma Traders",
      "customer_phone": "98765 43210",
      "amount_inr": 48000,
      "due_date": "2026-10-12"
    },
    {
      "invoice_no": "INV-1042",
      "customer_name": "Bluepeak Interiors",
      "customer_phone": "99001 12233",
      "amount_inr": 125000,
      "due_date": "2026-09-28"
    }
  ]
}
```
→ First run: `{ created: 2, updated: 0 }`
→ Second run: `{ created: 0, updated: 2 }`

**update_invoice_status**:
```json
{
  "invoice_no": "INV-1041",
  "status": "paid",
  "note": "Paid via NEFT"
}
```
→ Follow-ups for INV-1041 should flip to "skipped", paid_at should be set
