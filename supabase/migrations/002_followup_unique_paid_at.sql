-- Add unique constraint on followups to prevent duplicate drafts
ALTER TABLE followups
  ADD CONSTRAINT uq_followup_invoice_send_channel
  UNIQUE (invoice_id, send_on, channel);

-- Add paid_at timestamp to invoices
ALTER TABLE invoices
  ADD COLUMN paid_at timestamptz;
