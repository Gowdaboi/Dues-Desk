-- Run this in your Supabase SQL Editor after running the schema migration.
-- Step 1: Create a test user via Supabase Auth dashboard (email: test@duesdesk.com, password: testpass123)
-- Step 2: Get the user's UUID from the auth.users table
-- Step 3: Run this with that UUID:

-- Replace YOUR_USER_UUID below with the actual UUID from auth.users
INSERT INTO workspaces (name, mcp_token, owner_user_id)
VALUES (
  'Demo Studio',
  'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
  'YOUR_USER_UUID'
)
ON CONFLICT DO NOTHING;
