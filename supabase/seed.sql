-- Seed: run AFTER creating a test user via Supabase Auth dashboard.
--
-- 1. Create a user in Auth → Users → "Add user"
-- 2. Copy the user's UUID from auth.users
-- 3. Generate a token: openssl rand -hex 32
-- 4. Run the insert below with your values:

-- INSERT INTO workspaces (name, mcp_token, owner_user_id)
-- VALUES ('Demo Studio', '<openssl-rand-hex-32-output>', '<user-uuid>');

-- The app's Settings page will have a "Reset demo data" button for reviewers.
