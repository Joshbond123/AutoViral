-- AutoViral Schema Migration v3
-- Telegram integration + Agent Instructions + Delivery Queue
-- Safe to run multiple times (all statements use IF NOT EXISTS).
-- Run this in the Supabase SQL Editor after supabase_migration_v2.sql.

-- ── telegram_settings — per-user Telegram MTProto credentials ─────────────────

CREATE TABLE IF NOT EXISTS telegram_settings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  api_id        TEXT,
  api_hash      TEXT,
  session_string TEXT,
  target_chat   TEXT DEFAULT 'claw',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE telegram_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_settings_select" ON telegram_settings;
DROP POLICY IF EXISTS "telegram_settings_insert" ON telegram_settings;
DROP POLICY IF EXISTS "telegram_settings_update" ON telegram_settings;
DROP POLICY IF EXISTS "telegram_settings_delete" ON telegram_settings;

CREATE POLICY "telegram_settings_select" ON telegram_settings FOR SELECT USING (true);
CREATE POLICY "telegram_settings_insert" ON telegram_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "telegram_settings_update" ON telegram_settings FOR UPDATE USING (true);
CREATE POLICY "telegram_settings_delete" ON telegram_settings FOR DELETE USING (true);

-- ── agent_instructions — custom instructions sent with every delivery ──────────

CREATE TABLE IF NOT EXISTS agent_instructions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instruction TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_instructions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_instructions_select" ON agent_instructions;
DROP POLICY IF EXISTS "agent_instructions_insert" ON agent_instructions;
DROP POLICY IF EXISTS "agent_instructions_update" ON agent_instructions;
DROP POLICY IF EXISTS "agent_instructions_delete" ON agent_instructions;

CREATE POLICY "agent_instructions_select" ON agent_instructions FOR SELECT USING (true);
CREATE POLICY "agent_instructions_insert" ON agent_instructions FOR INSERT WITH CHECK (true);
CREATE POLICY "agent_instructions_update" ON agent_instructions FOR UPDATE USING (true);
CREATE POLICY "agent_instructions_delete" ON agent_instructions FOR DELETE USING (true);

-- ── telegram_delivery_queue — manual "Send to Agent" queue ────────────────────

CREATE TABLE IF NOT EXISTS telegram_delivery_queue (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  video_url     TEXT NOT NULL,
  title         TEXT,
  caption       TEXT,
  hashtags      TEXT,
  status        TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  sent_at       TIMESTAMPTZ
);

ALTER TABLE telegram_delivery_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_delivery_queue_select" ON telegram_delivery_queue;
DROP POLICY IF EXISTS "telegram_delivery_queue_insert" ON telegram_delivery_queue;
DROP POLICY IF EXISTS "telegram_delivery_queue_update" ON telegram_delivery_queue;
DROP POLICY IF EXISTS "telegram_delivery_queue_delete" ON telegram_delivery_queue;

CREATE POLICY "telegram_delivery_queue_select" ON telegram_delivery_queue FOR SELECT USING (true);
CREATE POLICY "telegram_delivery_queue_insert" ON telegram_delivery_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "telegram_delivery_queue_update" ON telegram_delivery_queue FOR UPDATE USING (true);
CREATE POLICY "telegram_delivery_queue_delete" ON telegram_delivery_queue FOR DELETE USING (true);

-- ── Performance indexes ───────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_telegram_settings_user_id   ON telegram_settings (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_instructions_user_id  ON agent_instructions (user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_telegram_queue_status       ON telegram_delivery_queue (status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_telegram_queue_user_id      ON telegram_delivery_queue (user_id, status);
