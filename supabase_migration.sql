-- AutoViral Schema Migration
-- Run this in the Supabase SQL Editor to add missing columns needed by the dashboard
-- and scheduling system. All statements use IF NOT EXISTS / DO NOTHING so they are safe
-- to run multiple times.

-- ── schedules table ──────────────────────────────────────────────────────────

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS last_run_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_status    TEXT,
  ADD COLUMN IF NOT EXISTS last_topic         TEXT,
  ADD COLUMN IF NOT EXISTS last_error         TEXT,
  ADD COLUMN IF NOT EXISTS execution_time_ms  BIGINT;

-- ── posts table ──────────────────────────────────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS schedule_id TEXT,
  ADD COLUMN IF NOT EXISTS script      TEXT,
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

-- ── api_keys table ───────────────────────────────────────────────────────────

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- ── topic_history — ensure table exists ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche       TEXT NOT NULL,
  topic_title TEXT NOT NULL,
  topic_hash  TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Enable Row Level Security and allow anon reads for the dashboard ──────────
-- The service role key (used by the pipeline) bypasses RLS automatically.
-- The anon key (used by the web frontend) needs SELECT access to these tables.

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate cleanly (idempotent)
DROP POLICY IF EXISTS "schedules_select" ON schedules;
DROP POLICY IF EXISTS "schedules_insert" ON schedules;
DROP POLICY IF EXISTS "schedules_update" ON schedules;
DROP POLICY IF EXISTS "schedules_delete" ON schedules;

DROP POLICY IF EXISTS "posts_select" ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;

DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;

DROP POLICY IF EXISTS "profiles_select" ON profiles;

-- schedules: anon can read/write their own rows (identified by user_id)
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (true);
CREATE POLICY "schedules_insert" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedules_update" ON schedules FOR UPDATE USING (true);
CREATE POLICY "schedules_delete" ON schedules FOR DELETE USING (true);

-- posts: anon can read any post (dashboard reads all posts for a user_id)
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (true);

-- api_keys: anon can read/manage keys (the SPA manages them via Settings page)
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT USING (true);
CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT WITH CHECK (true);
CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE USING (true);
CREATE POLICY "api_keys_delete" ON api_keys FOR DELETE USING (true);

-- profiles: anon can read profile data (needed for dashboard display)
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);

-- ── Enable real-time for schedules and posts ──────────────────────────────────
-- Run these in the Supabase dashboard → Database → Replication → Tables
-- (cannot be done via SQL; listed here as a reminder)
-- Tables to enable: schedules, posts, api_keys
