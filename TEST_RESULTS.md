# MCP Inspector Test Results
Date: 2026-11-05 17:35 IST
Endpoint: /api/mcp/[token]
Transport: Streamable HTTP (stateless)

## 1. Initialize
```json
{
    "result": {
        "protocolVersion": "2025-03-26",
        "capabilities": {
            "tools": {
                "listChanged": true
            }
        },
        "serverInfo": {
            "name": "dues-desk",
            "version": "1.0.0"
        }
    },
    "jsonrpc": "2.0",
    "id": 1
}
```

## 2. List Tools (5 registered)
```json
[
  {"name": "get_workspace_summary", "description": "Returns today's date (IST), outstanding total, overdue buckets..."},
  {"name": "list_invoices", "description": "List invoices, optionally filtered by status..."},
  {"name": "upsert_invoices", "description": "Add or update invoices. If invoice_no already exists it is updated..."},
  {"name": "create_followups", "description": "Create follow-up messages for invoices. Saved as DRAFTS..."},
  {"name": "update_invoice_status", "description": "Mark an invoice as paid, promised, disputed, or open..."}
]
```

## 3. get_workspace_summary (empty workspace)
```json
{
  "today_ist": "2026-11-05",
  "outstanding_inr": 0,
  "not_yet_due_count": 0,
  "overdue_buckets": {
    "1-30": {
      "count": 0,
      "total": 0
    },
    "31-60": {
      "count": 0,
      "total": 0
    },
    "60+": {
      "count": 0,
      "total": 0
    }
  },
  "dashboard_url": "http://localhost:3000/dashboard"
}
```

## 4. upsert_invoices — first run (create)
```json
{
  "upserted": 3,
  "invoice_nos": [
    "INV-1041",
    "INV-1042",
    "INV-1045"
  ],
  "invoices_url": "http://localhost:3000/invoices"
}
```

## 5. upsert_invoices — second run (idempotency proof)
```json
{
  "upserted": 3,
  "invoice_nos": [
    "INV-1041",
    "INV-1042",
    "INV-1045"
  ],
  "invoices_url": "http://localhost:3000/invoices"
}
```

### DB verification: exactly 3 rows after 2 upserts
```json
[
    {
        "invoice_no": "INV-1041",
        "customer_name": "Sharma Traders",
        "customer_phone": "+919876543210",
        "amount_inr": 48000,
        "due_date": "2026-10-12",
        "status": "open"
    },
    {
        "invoice_no": "INV-1042",
        "customer_name": "Bluepeak Interiors",
        "customer_phone": "+919900112233",
        "amount_inr": 125000,
        "due_date": "2026-09-28",
        "status": "open"
    },
    {
        "invoice_no": "INV-1045",
        "customer_name": "Kaveri Foods",
        "customer_phone": "+919845055667",
        "amount_inr": 22500,
        "due_date": "2026-10-20",
        "status": "open"
    }
]
```

## 6. get_workspace_summary (with data)
```json
{
  "today_ist": "2026-11-05",
  "outstanding_inr": 195500,
  "not_yet_due_count": 0,
  "overdue_buckets": {
    "1-30": {
      "count": 2,
      "total": 70500
    },
    "31-60": {
      "count": 1,
      "total": 125000
    },
    "60+": {
      "count": 0,
      "total": 0
    }
  },
  "dashboard_url": "http://localhost:3000/dashboard"
}
```

## 7. create_followups (draft for INV-1041)
```json
{
  "drafts_created": 1,
  "review_url": "http://localhost:3000/followups"
}
```

## 8. update_invoice_status (INV-1041 → paid)
```json
{
  "invoice_no": "INV-1041",
  "new_status": "paid",
  "followups_skipped": 1,
  "invoice_url": "http://localhost:3000/invoices"
}
```

## 9. DB verification after marking paid

### INV-1041 status + paid_at
```json
[
    {
        "invoice_no": "INV-1041",
        "status": "paid",
        "paid_at": "2026-11-05T12:05:36.808+00:00",
        "promised_date": null
    }
]
```

### Follow-up status (should be skipped)
```json
[
    {
        "send_on": "2026-11-06",
        "channel": "whatsapp",
        "tone": "friendly",
        "status": "skipped"
    }
]
```

### Events audit trail
```json
[
    {
        "type": "invoice_upserted",
        "note": "Upserted via MCP",
        "created_at": "2026-11-05T12:05:32.362949+00:00"
    },
    {
        "type": "invoice_upserted",
        "note": "Upserted via MCP",
        "created_at": "2026-11-05T12:05:32.362949+00:00"
    },
    {
        "type": "invoice_upserted",
        "note": "Upserted via MCP",
        "created_at": "2026-11-05T12:05:32.362949+00:00"
    },
    {
        "type": "invoice_upserted",
        "note": "Upserted via MCP",
        "created_at": "2026-11-05T12:05:33.689075+00:00"
    },
    {
        "type": "invoice_upserted",
        "note": "Upserted via MCP",
        "created_at": "2026-11-05T12:05:33.689075+00:00"
    },
    {
        "type": "invoice_upserted",
        "note": "Upserted via MCP",
        "created_at": "2026-11-05T12:05:33.689075+00:00"
    },
    {
        "type": "followup_drafted",
        "note": "friendly whatsapp follow-up for 2026-11-06",
        "created_at": "2026-11-05T12:05:35.924473+00:00"
    },
    {
        "type": "status_paid",
        "note": "Paid via NEFT",
        "created_at": "2026-11-05T12:05:37.397179+00:00"
    }
]
```
