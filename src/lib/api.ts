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
