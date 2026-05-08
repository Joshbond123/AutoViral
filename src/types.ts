export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  schedule_id?: string;
  manual_job_id?: string;
  thumbnail_url?: string;
  title?: string;
  topic?: string;
  niche?: string;
  script?: string;
  caption?: string;
  hashtags?: string;
  status: 'pending' | 'processing' | 'rendered' | 'published' | 'failed';
  published_at?: string;
  created_at?: string;
  duration?: string;
  video_url?: string;
  publish_result?: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  scheduled_time: string;
  niche: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  error_message?: string;
  created_at?: string;
  last_run_at?: string;
  last_run_status?: string;
  last_topic?: string;
  last_error?: string;
  execution_time_ms?: number;
}

export interface ManualJob {
  id: string;
  user_id: string;
  scheduled_time: string | null;
  niche: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  created_at?: string;
  last_run_at?: string;
  last_topic?: string;
  last_error?: string;
  execution_time_ms?: number;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error';
  read: boolean;
  post_id?: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  service: 'cerebras' | 'cloudflare' | 'cloudflare_id' | 'unrealspeech';
  key_value: string;
  is_active: boolean;
  status: 'active' | 'rate_limited' | 'failed';
  request_count: number;
  success_count: number;
  error_count: number;
  last_used_at?: string;
}
