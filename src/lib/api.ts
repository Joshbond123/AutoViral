import { supabase } from './supabase';
import { ApiKey, Schedule } from '../types';

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

export async function fetchHistory(userId: string): Promise<unknown[]> {
  const url = FUNCS_BASE
    ? `${FUNCS_BASE}/history?userId=${encodeURIComponent(userId)}`
    : `/api/history/${encodeURIComponent(userId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`history: ${res.status}`);
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

// --- Schedule CRUD (direct Supabase) ---

export async function fetchSchedules(userId: string): Promise<Schedule[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_time', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Schedule[];
}

export async function fetchScheduledCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

export async function updateSchedule(id: string, patch: { scheduled_time?: string; niche?: string }): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('schedules')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// --- API Key CRUD (direct Supabase) ---

export async function fetchApiKeys(): Promise<ApiKey[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .order('service');
  if (error) throw new Error(error.message);
  return (data ?? []) as ApiKey[];
}

export async function addApiKey(service: ApiKey['service'], keyValue: string): Promise<ApiKey> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('api_keys')
    .insert([{ service, key_value: keyValue, is_active: true }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ApiKey;
}

export async function updateApiKeyValue(id: string, keyValue: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('api_keys')
    .update({ key_value: keyValue })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function toggleApiKey(id: string, isActive: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteApiKey(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}
