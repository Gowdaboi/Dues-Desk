# Testing Dues Desk MCP with MCP Inspector

## Prerequisites
1. A Supabase project (free tier works)
2. Node.js 18+

## Setup Steps

### 1. Create Supabase tables
Go to your Supabase project → SQL Editor → paste and run `supabase/migrations/001_schema.sql`.

### 2. Disable RLS temporarily (for MCP testing with service role)
The MCP server uses the service-role key which bypasses RLS. No changes needed.

### 3. Create a test user + workspace
- Go to Authentication → Users → "Add user" → email: `test@duesdesk.com`, password: `testpass123`
- Copy the user's UUID
- Run in SQL Editor:
```sql
INSERT INTO workspaces (name, mcp_token, owner_user_id)
VALUES ('Demo Studio', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', '<paste-user-uuid>');
```

### 4. Configure env
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and service role key
```

### 5. Start the dev server
```bash
npm run dev
```

### 6. Test with MCP Inspector
```bash
npx @modelcontextprotocol/inspector
```

In the Inspector UI:
- **Transport**: Streamable HTTP
- **URL**: `http://localhost:3000/api/mcp/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6`

### 7. Test the tools

**get_workspace_summary** (no params):
→ Should return today's date in IST, zero outstanding

**upsert_invoices**:
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
→ Should return `{ created: 2, updated: 0, invoices_url: "..." }`

**get_workspace_summary** again:
→ Should now show outstanding total and overdue buckets

**list_invoices** `{ "status": "open" }`:
→ Should list the two invoices with days_overdue

**create_followups**:
```json
{
  "items": [
    {
      "invoice_no": "INV-1041",
      "send_on": "2026-11-06",
      "channel": "whatsapp",
      "tone": "friendly",
      "message": "Hi Sharma Traders, just a gentle reminder about invoice INV-1041 for ₹48,000 that was due on 12 Oct. Would appreciate if you could process this at the earliest. Thanks!"
    }
  ]
}
```

**update_invoice_status**:
```json
{
  "invoice_no": "INV-1041",
  "status": "paid",
  "note": "Paid via NEFT"
}
```
→ Follow-ups for INV-1041 should flip to "skipped"
