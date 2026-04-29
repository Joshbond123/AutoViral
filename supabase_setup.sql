-- 1. Profiles Table (User Storage)
CREATE TABLE profiles (
  id TEXT PRIMARY KEY, -- TikTok OpenID
  username TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Schedules Table
CREATE TABLE schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id),
  scheduled_time TIMESTAMPTZ NOT NULL,
  niche TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, running, success, failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Posts History
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id),
  thumbnail_url TEXT,
  title TEXT,
  topic TEXT,
  niche TEXT,
  status TEXT DEFAULT 'published', -- pending, processing, published, failed
  published_at TIMESTAMPTZ DEFAULT NOW(),
  duration TEXT,
  video_url TEXT,
  publish_result TEXT
);

-- 4. Topic History (TopicShield™)
CREATE TABLE topic_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  niche TEXT NOT NULL,
  topic_title TEXT NOT NULL,
  topic_hash TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. API Credentials
CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL, -- cerebras, cloudflare, unrealspeech
  key_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  request_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

-- Note: Ensure Row Level Security (RLS) is configured based on your needs.
-- For this automation platform, the service role key will bypass RLS.
