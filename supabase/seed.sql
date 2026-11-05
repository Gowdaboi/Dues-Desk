-- Seed: run AFTER creating a test user via Supabase Auth
-- Replace <USER_ID> with the auth.users id of your test user
-- The MCP token is a 32-byte hex string for demo purposes

-- Example: insert a test workspace
-- insert into workspaces (name, mcp_token, owner_user_id)
-- values (
--   'Demo Studio',
--   'a]1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
--   '<USER_ID>'
-- );

-- The app's Settings page has a "Reset demo data" button that handles seeding.
-- For manual testing, create the user in Supabase Auth dashboard first,
-- then run the insert above with that user's ID.
