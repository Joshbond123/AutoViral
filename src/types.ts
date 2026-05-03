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
  thumbnail_url: string;
  title: string;
  topic: string;
  niche: string;
  status: 'pending' | 'processing' | 'published' | 'failed';
  published_at?: string;
  duration: string;
  publish_result?: string;
}

export interface Schedule {
  id: string;
  user_id: string;
  scheduled_time: string;
  niche: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  created_at?: string;
}

export interface ApiKey {
  id: string;
  service: 'cerebras' | 'cloudflare' | 'cloudflare_id' | 'unrealspeech';
  key_value: string;
  is_active: boolean;
  request_count: number;
  success_count: number;
  error_count: number;
  last_used_at?: string;
}
