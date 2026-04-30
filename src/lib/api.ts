// API client. On GitHub Pages there is no Node backend, so we route to
  // Supabase Edge Functions when configured. For local dev (`tsx server.ts`),
  // VITE_SUPABASE_URL is empty so calls fall back to the Express server.
  const SUPABASE_URL: string =
    (import.meta as any).env?.VITE_SUPABASE_URL || '';

  const FUNCS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

  export const HAS_BACKEND = Boolean(SUPABASE_URL);

  export async function fetchTikTokAuthUrl(): Promise<string> {
    const url = FUNCS_BASE
      ? `${FUNCS_BASE}/tiktok-auth-url`
      : '/api/auth/tiktok/url';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`auth url: ${res.status}`);
    const json = await res.json();
    return json.url;
  }

  export interface TikTokProfile {
    id: string;
    username: string | null;
    avatar_url: string | null;
    expires_at: string | null;
  }

  export async function fetchProfile(userId: string): Promise<TikTokProfile | null> {
    const url = FUNCS_BASE
      ? `${FUNCS_BASE}/profile?userId=${encodeURIComponent(userId)}`
      : `/api/profile/${encodeURIComponent(userId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`profile: ${res.status}`);
    return res.json();
  }

  export interface UploadResult {
    ok: boolean;
    publish_id?: string;
    upload_status?: number;
    upload_response?: string;
    tiktok_init?: unknown;
    error?: string;
    tiktok?: unknown;
    detail?: string;
  }

  export async function uploadVideoToTikTok(input: { userId: string; file: File }): Promise<UploadResult> {
    const url = FUNCS_BASE
      ? `${FUNCS_BASE}/upload-video`
      : '/api/upload-video';
    const fd = new FormData();
    fd.append('userId', input.userId);
    fd.append('video', input.file);
    const res = await fetch(url, { method: 'POST', body: fd });
    return res.json();
  }

  export async function postSchedule(input: {
    userId: string;
    scheduledTime: string;
    niche: string;
  }): Promise<unknown> {
    const url = FUNCS_BASE ? `${FUNCS_BASE}/schedule` : '/api/schedule';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`schedule: ${res.status}`);
    return res.json();
  }

  export async function fetchHistory(userId: string): Promise<unknown[]> {
    const url = FUNCS_BASE
      ? `${FUNCS_BASE}/history?userId=${encodeURIComponent(userId)}`
      : `/api/history/${encodeURIComponent(userId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`history: ${res.status}`);
    return res.json();
  }
  