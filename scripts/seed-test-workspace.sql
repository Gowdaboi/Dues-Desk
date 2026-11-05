-- Run in Supabase SQL Editor after running schema migrations.
--
-- Step 1: Create a test user via Auth dashboard (any email/password)
-- Step 2: Copy the user UUID from auth.users
-- Step 3: Generate a token:  openssl rand -hex 32
-- Step 4: Replace placeholders and run:

INSERT INTO workspaces (name, mcp_token, owner_user_id)
VALUES (
  'Demo Studio',
  '<openssl-rand-hex-32-output>',
  '<user-uuid>'
)
ON CONFLICT DO NOTHING;
