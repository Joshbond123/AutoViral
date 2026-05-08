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
  ADD COLUMN IF NOT EXISTS schedule_id    TEXT,
  ADD COLUMN IF NOT EXISTS manual_job_id  UUID,
  ADD COLUMN IF NOT EXISTS script         TEXT,
  ADD COLUMN IF NOT EXISTS caption        TEXT,
  ADD COLUMN IF NOT EXISTS hashtags       TEXT,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW();

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

-- ── manual_jobs table ─────────────────────────────────────────────────────────
-- Tracks manual video generation requests (no TikTok auto-publish).

CREATE TABLE IF NOT EXISTS manual_jobs (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            TEXT REFERENCES profiles(id),
  scheduled_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  niche              TEXT NOT NULL DEFAULT 'AUTO',
  status             TEXT DEFAULT 'pending',  -- pending, running, success, failed
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  last_run_at        TIMESTAMPTZ,
  last_topic         TEXT,
  last_error         TEXT,
  execution_time_ms  BIGINT
);

-- ── notifications table ───────────────────────────────────────────────────────
-- In-app notification history. Also used as audit trail for push notifications.

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT REFERENCES profiles(id),
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT DEFAULT 'info',   -- info, success, error
  read       BOOLEAN DEFAULT FALSE,
  post_id    UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── push_subscriptions table ──────────────────────────────────────────────────
-- Stores Web Push API subscriptions so videos can trigger OS-level notifications.
-- Generate VAPID keys with: npx web-push generate-vapid-keys
-- Store as Supabase secrets: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
-- Also add VITE_VAPID_PUBLIC_KEY to your .env file for the frontend.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT REFERENCES profiles(id),
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE schedules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions  ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies cleanly (idempotent)
DROP POLICY IF EXISTS "schedules_select"         ON schedules;
DROP POLICY IF EXISTS "schedules_insert"         ON schedules;
DROP POLICY IF EXISTS "schedules_update"         ON schedules;
DROP POLICY IF EXISTS "schedules_delete"         ON schedules;
DROP POLICY IF EXISTS "posts_select"             ON posts;
DROP POLICY IF EXISTS "posts_insert"             ON posts;
DROP POLICY IF EXISTS "posts_update"             ON posts;
DROP POLICY IF EXISTS "posts_delete"             ON posts;
DROP POLICY IF EXISTS "api_keys_select"          ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert"          ON api_keys;
DROP POLICY IF EXISTS "api_keys_update"          ON api_keys;
DROP POLICY IF EXISTS "api_keys_delete"          ON api_keys;
DROP POLICY IF EXISTS "profiles_select"          ON profiles;
DROP POLICY IF EXISTS "manual_jobs_select"       ON manual_jobs;
DROP POLICY IF EXISTS "manual_jobs_insert"       ON manual_jobs;
DROP POLICY IF EXISTS "manual_jobs_update"       ON manual_jobs;
DROP POLICY IF EXISTS "manual_jobs_delete"       ON manual_jobs;
DROP POLICY IF EXISTS "notifications_select"     ON notifications;
DROP POLICY IF EXISTS "notifications_insert"     ON notifications;
DROP POLICY IF EXISTS "notifications_update"     ON notifications;
DROP POLICY IF EXISTS "notifications_delete"     ON notifications;
DROP POLICY IF EXISTS "push_subs_select"         ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_insert"         ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_delete"         ON push_subscriptions;

-- schedules
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (true);
CREATE POLICY "schedules_insert" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedules_update" ON schedules FOR UPDATE USING (true);
CREATE POLICY "schedules_delete" ON schedules FOR DELETE USING (true);

-- posts
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (true);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (true);

-- api_keys
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT USING (true);
CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT WITH CHECK (true);
CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE USING (true);
CREATE POLICY "api_keys_delete" ON api_keys FOR DELETE USING (true);

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);

-- manual_jobs
CREATE POLICY "manual_jobs_select" ON manual_jobs FOR SELECT USING (true);
CREATE POLICY "manual_jobs_insert" ON manual_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "manual_jobs_update" ON manual_jobs FOR UPDATE USING (true);
CREATE POLICY "manual_jobs_delete" ON manual_jobs FOR DELETE USING (true);

-- notifications
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (true);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (true);

-- push_subscriptions
CREATE POLICY "push_subs_select" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "push_subs_insert" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "push_subs_delete" ON push_subscriptions FOR DELETE USING (true);

-- ── Enable Realtime for new tables ────────────────────────────────────────────
-- In Supabase dashboard → Database → Replication → enable for:
--   manual_jobs, notifications, push_subscriptions
-- (already enabled for: schedules, posts, api_keys)
