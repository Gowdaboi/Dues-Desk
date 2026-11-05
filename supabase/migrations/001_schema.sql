-- Dues Desk schema
-- Run this in Supabase SQL Editor to set up all tables

-- Workspaces: each business gets one, identified by an MCP token
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mcp_token text not null unique,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_workspaces_mcp_token on workspaces(mcp_token);

-- Invoices: the core receivable records
create table invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_no text not null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  amount_inr numeric not null check (amount_inr > 0),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'promised', 'paid', 'disputed')),
  promised_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, invoice_no)
);

create index idx_invoices_workspace on invoices(workspace_id);
create index idx_invoices_status on invoices(workspace_id, status);

-- Follow-ups: messages Claude drafts, humans approve
create table followups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  send_on date not null,
  channel text not null check (channel in ('whatsapp', 'email')),
  tone text not null check (tone in ('friendly', 'firm', 'final')),
  message_text text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'skipped')),
  edited_by_human boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_followups_workspace on followups(workspace_id);
create index idx_followups_due on followups(workspace_id, status, send_on);

-- Events: audit trail per invoice
create table events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  type text not null,
  note text,
  created_at timestamptz not null default now()
);

create index idx_events_invoice on events(invoice_id);

-- RLS policies: every table scoped by workspace
alter table workspaces enable row level security;
alter table invoices enable row level security;
alter table followups enable row level security;
alter table events enable row level security;

-- Workspace owners can see their own workspaces
create policy "workspace_owner" on workspaces
  for all using (owner_user_id = auth.uid());

-- All child tables: user must own the parent workspace
create policy "invoices_workspace_member" on invoices
  for all using (
    workspace_id in (select id from workspaces where owner_user_id = auth.uid())
  );

create policy "followups_workspace_member" on followups
  for all using (
    workspace_id in (select id from workspaces where owner_user_id = auth.uid())
  );

create policy "events_workspace_member" on events
  for all using (
    workspace_id in (select id from workspaces where owner_user_id = auth.uid())
  );

-- Function to auto-update updated_at on invoices
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at();
