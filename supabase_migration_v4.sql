-- AutoViral Schema Migration v4
-- Authentication Fix + Facebook Page Integration
-- Safe to run multiple times (all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- Run this in the Supabase SQL Editor.

-- ── Auth Fix: Auto-create profile on user registration ─────────────────────────
-- When a user signs up via Supabase email/password auth, automatically insert a
-- profiles row so that all FK constraints referencing profiles(id) are satisfied.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, access_token, refresh_token, expires_at)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'user'),
    NULL,
    '',
    '',
    NOW() + INTERVAL '10 years'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users who don't have a profiles record yet
INSERT INTO public.profiles (id, username, avatar_url, access_token, refresh_token, expires_at)
SELECT
  id::text,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1), 'user'),
  NULL,
  '',
  '',
  NOW() + INTERVAL '10 years'
FROM auth.users
WHERE id::text NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- ── RLS on core tables (safe to run again) ─────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (true);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys_select" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update" ON api_keys;
DROP POLICY IF EXISTS "api_keys_delete" ON api_keys;
CREATE POLICY "api_keys_select" ON api_keys FOR SELECT USING (true);
CREATE POLICY "api_keys_insert" ON api_keys FOR INSERT WITH CHECK (true);
CREATE POLICY "api_keys_update" ON api_keys FOR UPDATE USING (true);
CREATE POLICY "api_keys_delete" ON api_keys FOR DELETE USING (true);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedules_select" ON schedules;
DROP POLICY IF EXISTS "schedules_insert" ON schedules;
DROP POLICY IF EXISTS "schedules_update" ON schedules;
DROP POLICY IF EXISTS "schedules_delete" ON schedules;
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (true);
CREATE POLICY "schedules_insert" ON schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "schedules_update" ON schedules FOR UPDATE USING (true);
CREATE POLICY "schedules_delete" ON schedules FOR DELETE USING (true);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_select" ON posts;
DROP POLICY IF EXISTS "posts_insert" ON posts;
DROP POLICY IF EXISTS "posts_update" ON posts;
DROP POLICY IF EXISTS "posts_delete" ON posts;
CREATE POLICY "posts_select" ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (true);
CREATE POLICY "posts_delete" ON posts FOR DELETE USING (true);

ALTER TABLE manual_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manual_jobs_select" ON manual_jobs;
DROP POLICY IF EXISTS "manual_jobs_insert" ON manual_jobs;
DROP POLICY IF EXISTS "manual_jobs_update" ON manual_jobs;
DROP POLICY IF EXISTS "manual_jobs_delete" ON manual_jobs;
CREATE POLICY "manual_jobs_select" ON manual_jobs FOR SELECT USING (true);
CREATE POLICY "manual_jobs_insert" ON manual_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "manual_jobs_update" ON manual_jobs FOR UPDATE USING (true);
CREATE POLICY "manual_jobs_delete" ON manual_jobs FOR DELETE USING (true);

-- ── Notifications table (ensure exists + RLS) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT DEFAULT 'info',
  read       BOOLEAN DEFAULT false,
  post_id    UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (true);
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (true);

-- ── push_subscriptions (ensure exists + RLS) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subs_select" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_delete" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subs_upsert" ON push_subscriptions;
CREATE POLICY "push_subs_select" ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "push_subs_insert" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "push_subs_delete" ON push_subscriptions FOR DELETE USING (true);
CREATE POLICY "push_subs_upsert" ON push_subscriptions FOR UPDATE USING (true);

-- ── Facebook Settings table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS facebook_settings (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  page_access_token TEXT NOT NULL,
  page_id           TEXT,
  page_name         TEXT,
  page_category     TEXT,
  is_active         BOOLEAN DEFAULT true,
  status            TEXT DEFAULT 'active',  -- active | failed | expired
  last_tested_at    TIMESTAMPTZ,
  last_published_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE facebook_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fb_settings_select" ON facebook_settings;
DROP POLICY IF EXISTS "fb_settings_insert" ON facebook_settings;
DROP POLICY IF EXISTS "fb_settings_update" ON facebook_settings;
DROP POLICY IF EXISTS "fb_settings_delete" ON facebook_settings;
CREATE POLICY "fb_settings_select" ON facebook_settings FOR SELECT USING (true);
CREATE POLICY "fb_settings_insert" ON facebook_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "fb_settings_update" ON facebook_settings FOR UPDATE USING (true);
CREATE POLICY "fb_settings_delete" ON facebook_settings FOR DELETE USING (true);

-- ── Facebook Delivery Queue ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS facebook_delivery_queue (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id             UUID REFERENCES posts(id) ON DELETE CASCADE,
  facebook_setting_id UUID REFERENCES facebook_settings(id) ON DELETE SET NULL,
  video_url           TEXT NOT NULL,
  title               TEXT,
  caption             TEXT,
  hashtags            TEXT,
  status              TEXT DEFAULT 'pending',  -- pending | processing | published | failed
  error_message       TEXT,
  fb_post_id          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  published_at        TIMESTAMPTZ
);

ALTER TABLE facebook_delivery_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fb_queue_select" ON facebook_delivery_queue;
DROP POLICY IF EXISTS "fb_queue_insert" ON facebook_delivery_queue;
DROP POLICY IF EXISTS "fb_queue_update" ON facebook_delivery_queue;
DROP POLICY IF EXISTS "fb_queue_delete" ON facebook_delivery_queue;
CREATE POLICY "fb_queue_select" ON facebook_delivery_queue FOR SELECT USING (true);
CREATE POLICY "fb_queue_insert" ON facebook_delivery_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "fb_queue_update" ON facebook_delivery_queue FOR UPDATE USING (true);
CREATE POLICY "fb_queue_delete" ON facebook_delivery_queue FOR DELETE USING (true);

-- ── Performance indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fb_settings_user_id  ON facebook_settings (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_fb_queue_status      ON facebook_delivery_queue (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_fb_queue_user_id     ON facebook_delivery_queue (user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subs_user       ON push_subscriptions (user_id);
