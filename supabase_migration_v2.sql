-- AutoViral Schema Migration v2
-- ProteusCleanupEngine support + api_keys enhancements
-- Safe to run multiple times (all statements use IF NOT EXISTS / DO NOTHING).
-- Run this in the Supabase SQL Editor after supabase_migration.sql.

-- ── api_keys table — add missing tracking columns ────────────────────────────

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_used_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS success_count  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count    INTEGER DEFAULT 0;

-- ── posts table — add topic and video fields ──────────────────────────────────

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS topic          TEXT,
  ADD COLUMN IF NOT EXISTS schedule_id    TEXT,
  ADD COLUMN IF NOT EXISTS manual_job_id  UUID,
  ADD COLUMN IF NOT EXISTS script         TEXT,
  ADD COLUMN IF NOT EXISTS caption        TEXT,
  ADD COLUMN IF NOT EXISTS hashtags       TEXT,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW();

-- ── schedules table — add execution tracking columns ─────────────────────────

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS last_run_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_run_status    TEXT,
  ADD COLUMN IF NOT EXISTS last_topic         TEXT,
  ADD COLUMN IF NOT EXISTS last_error         TEXT,
  ADD COLUMN IF NOT EXISTS execution_time_ms  BIGINT,
  ADD COLUMN IF NOT EXISTS error_message      TEXT;

-- ── cleanup_logs table — ProteusCleanupEngine audit trail ─────────────────────

CREATE TABLE IF NOT EXISTS cleanup_logs (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by               TEXT NOT NULL DEFAULT 'daily_scheduler',
  user_id                    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  orphaned_videos_deleted    INTEGER DEFAULT 0,
  orphaned_thumbs_deleted    INTEGER DEFAULT 0,
  failed_post_videos_deleted INTEGER DEFAULT 0,
  expired_videos_deleted     INTEGER DEFAULT 0,
  stale_jobs_reset           INTEGER DEFAULT 0,
  stale_schedules_reset      INTEGER DEFAULT 0,
  api_keys_reset             INTEGER DEFAULT 0,
  cleanup_logs_deleted       INTEGER DEFAULT 0,
  videos_deleted             INTEGER DEFAULT 0,
  thumbs_deleted             INTEGER DEFAULT 0,
  error_count                INTEGER DEFAULT 0,
  errors                     TEXT,
  notes                      TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ── topic_history — ensure it exists (also in v1 but safe to re-run) ──────────

CREATE TABLE IF NOT EXISTS topic_history (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche       TEXT NOT NULL,
  topic_title TEXT NOT NULL,
  topic_hash  TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── manual_jobs — ensure full column set ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS manual_jobs (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            TEXT REFERENCES profiles(id),
  scheduled_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  niche              TEXT NOT NULL DEFAULT 'AUTO',
  status             TEXT DEFAULT 'pending',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  last_run_at        TIMESTAMPTZ,
  last_topic         TEXT,
  last_error         TEXT,
  execution_time_ms  BIGINT
);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE cleanup_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_history   ENABLE ROW LEVEL SECURITY;

-- cleanup_logs policies
DROP POLICY IF EXISTS "cleanup_logs_select" ON cleanup_logs;
DROP POLICY IF EXISTS "cleanup_logs_insert" ON cleanup_logs;
DROP POLICY IF EXISTS "cleanup_logs_delete" ON cleanup_logs;

CREATE POLICY "cleanup_logs_select" ON cleanup_logs FOR SELECT USING (true);
CREATE POLICY "cleanup_logs_insert" ON cleanup_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "cleanup_logs_delete" ON cleanup_logs FOR DELETE USING (true);

-- topic_history policies
DROP POLICY IF EXISTS "topic_history_select" ON topic_history;
DROP POLICY IF EXISTS "topic_history_insert" ON topic_history;
DROP POLICY IF EXISTS "topic_history_delete" ON topic_history;

CREATE POLICY "topic_history_select" ON topic_history FOR SELECT USING (true);
CREATE POLICY "topic_history_insert" ON topic_history FOR INSERT WITH CHECK (true);
CREATE POLICY "topic_history_delete" ON topic_history FOR DELETE USING (true);

-- ── Performance indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cleanup_logs_created_at    ON cleanup_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_triggered_by  ON cleanup_logs (triggered_by);
CREATE INDEX IF NOT EXISTS idx_topic_history_niche        ON topic_history (niche, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_history_hash         ON topic_history (topic_hash);
CREATE INDEX IF NOT EXISTS idx_manual_jobs_status         ON manual_jobs (status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_schedules_status           ON schedules (status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_posts_user_status          ON posts (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_video_url            ON posts (video_url) WHERE video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_service_status    ON api_keys (service, status) WHERE is_active = true;

-- ── Realtime — enable for cleanup_logs ────────────────────────────────────────
-- In Supabase dashboard → Database → Replication → enable for: cleanup_logs
-- (already enabled for: schedules, posts, api_keys, manual_jobs, notifications)
