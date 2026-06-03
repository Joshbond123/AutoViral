import { supabase } from './supabase';
import { ApiKey, ManualJob, AppNotification, Post, Schedule, TelegramSettings, AgentInstruction } from '../types';

const SUPABASE_URL: string =
  (import.meta as any).env?.VITE_SUPABASE_URL || '';

const FUNCS_BASE = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';

export const HAS_BACKEND = Boolean(SUPABASE_URL);


export async function fetchHistory(userId: string): Promise<Post[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, schedule_id, manual_job_id, thumbnail_url, title, topic, niche, script, caption, hashtags, status, published_at, created_at, video_url, publish_result')
    .eq('user_id', userId)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) { console.warn('fetchHistory error:', error.message); return []; }
  return (data ?? []) as Post[];
}

export async function postSchedule(input: { userId: string; scheduledTime: string; niche: string }): Promise<Schedule> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('schedules')
    .insert([{ user_id: input.userId, scheduled_time: input.scheduledTime, niche: input.niche, status: 'pending' }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  if (FUNCS_BASE) {
    fetch(`${FUNCS_BASE}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }).catch(() => {});
  }
  return data as Schedule;
}

export async function fetchSchedules(userId: string): Promise<Schedule[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_time', { ascending: true });
  if (error) { console.warn('fetchSchedules error:', error.message); return []; }
  return (data ?? []) as Schedule[];
}

export async function fetchScheduledCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('schedules')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) { console.warn('fetchScheduledCount error:', error.message); return 0; }
  return count ?? 0;
}

export async function updateSchedule(id: string, patch: { scheduled_time?: string; niche?: string }): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('schedules').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSchedule(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeToSchedules(userId: string, callback: (schedule: Schedule) => void): (() => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`schedules:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules', filter: `user_id=eq.${userId}` }, (payload) => {
      if (payload.new) callback(payload.new as Schedule);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeToPosts(userId: string, callback: (post: Post) => void): (() => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`posts:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts', filter: `user_id=eq.${userId}` }, (payload) => {
      if (payload.new) callback(payload.new as Post);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Manual Job API ────────────────────────────────────────────────────────────

export async function createManualJob(
  input: { userId: string; scheduledTime: string | null; niche: string }
): Promise<{ job: ManualJob; dispatched: boolean }> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('manual_jobs')
    .insert([{
      user_id: input.userId,
      scheduled_time: input.scheduledTime ?? new Date().toISOString(),
      niche: input.niche,
      status: 'pending',
    }])
    .select()
    .single();
  if (error) throw new Error(error.message);

  const isInstant = !input.scheduledTime;
  let dispatched = false;

  if (FUNCS_BASE && isInstant) {
    try {
      const res = await fetch(`${FUNCS_BASE}/manual-trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: input.userId, jobId: (data as ManualJob).id, instant: true }),
      });
      const json = await res.json().catch(() => ({}));
      dispatched = json?.dispatched === true;
    } catch { /* Non-fatal — cron will pick up the job */ }
  }

  return { job: data as ManualJob, dispatched };
}

export async function fetchManualJobs(userId: string): Promise<ManualJob[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('manual_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.warn('fetchManualJobs error:', error.message); return []; }
  return (data ?? []) as ManualJob[];
}

export async function deleteManualJob(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('manual_jobs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateManualJob(id: string, patch: { scheduled_time?: string; niche?: string }): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('manual_jobs').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeToManualJobs(userId: string, callback: (job: ManualJob) => void): (() => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`manual_jobs:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'manual_jobs', filter: `user_id=eq.${userId}` }, (payload) => {
      if (payload.new) callback(payload.new as ManualJob);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function fetchTodaysManualPosts(userId: string): Promise<Post[]> {
  if (!supabase) return [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('posts')
    .select('id, user_id, manual_job_id, thumbnail_url, title, topic, niche, script, caption, hashtags, status, published_at, created_at, video_url, publish_result')
    .eq('user_id', userId)
    .not('manual_job_id', 'is', null)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });
  if (error) { console.warn('fetchTodaysManualPosts error:', error.message); return []; }
  return (data ?? []) as Post[];
}

export async function deletePost(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Notification API ──────────────────────────────────────────────────────────

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) { console.warn('fetchNotifications error:', error.message); return []; }
  return (data ?? []) as AppNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

export async function deleteNotification(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('notifications').delete().eq('id', id);
}

export function subscribeToNotifications(userId: string, callback: (notification: AppNotification) => void): (() => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
      if (payload.new) callback(payload.new as AppNotification);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Push Subscription API ─────────────────────────────────────────────────────

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function savePushSubscription(userId: string, sub: PushSubscriptionJSON): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const keys = sub.keys as { p256dh: string; auth: string };
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: sub.endpoint!,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: navigator.userAgent.slice(0, 255),
    }, { onConflict: 'user_id,endpoint' });
  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  if (!supabase) return;
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
}

export async function getPushSubscription(userId: string): Promise<PushSubscriptionRecord | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return (data as PushSubscriptionRecord | null);
}

// ─── API Key CRUD ──────────────────────────────────────────────────────────────

export async function fetchApiKeys(): Promise<ApiKey[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('api_keys').select('*').order('service');
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
  const { error } = await supabase.from('api_keys').update({ key_value: keyValue }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function toggleApiKey(id: string, isActive: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('api_keys').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteApiKey(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('api_keys').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function resetKeyStatus(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('api_keys').update({ status: 'active', error_count: 0 }).eq('id', id);
  if (error) throw new Error(error.message);
}

export function subscribeToApiKeys(callback: (payload: { eventType: string; key: ApiKey }) => void): (() => void) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('api_keys_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'api_keys' }, (payload) => {
      callback({ eventType: payload.eventType, key: (payload.new ?? payload.old) as ApiKey });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ─── Telegram Settings API ─────────────────────────────────────────────────────

export async function fetchTelegramSettings(userId: string): Promise<TelegramSettings | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('telegram_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as TelegramSettings | null);
}

export async function saveTelegramSettings(
  userId: string,
  settings: { api_id: string; api_hash: string; session_string: string; target_chat: string }
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('telegram_settings')
    .upsert({
      user_id: userId,
      api_id: settings.api_id.trim(),
      api_hash: settings.api_hash.trim(),
      session_string: settings.session_string.trim(),
      target_chat: (settings.target_chat || 'claw').replace(/^@/, '').trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

export async function deleteTelegramSettings(userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('telegram_settings')
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ─── Agent Instructions API ────────────────────────────────────────────────────

export async function fetchAgentInstructions(userId: string): Promise<AgentInstruction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('agent_instructions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('fetchAgentInstructions error:', error.message); return []; }
  return (data ?? []) as AgentInstruction[];
}

export async function addAgentInstruction(userId: string, instruction: string): Promise<AgentInstruction> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('agent_instructions')
    .insert([{ user_id: userId, instruction: instruction.trim() }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as AgentInstruction;
}

export async function updateAgentInstruction(id: string, instruction: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('agent_instructions')
    .update({ instruction: instruction.trim() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteAgentInstruction(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase
    .from('agent_instructions')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Send to Agent (Manual Delivery) ──────────────────────────────────────────

export async function sendToAgent(
  userId: string,
  post: { id: string; video_url: string; title?: string; caption?: string; hashtags?: string }
): Promise<{ ok: boolean; dispatched: boolean }> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: queueRow, error: queueErr } = await supabase
    .from('telegram_delivery_queue')
    .insert([{
      user_id: userId,
      post_id: post.id,
      video_url: post.video_url,
      title: post.title ?? null,
      caption: post.caption ?? null,
      hashtags: post.hashtags ?? null,
      status: 'pending',
    }])
    .select()
    .single();

  if (queueErr) throw new Error(queueErr.message);

  let dispatched = false;
  if (FUNCS_BASE) {
    try {
      const res = await fetch(`${FUNCS_BASE}/send-to-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          postId: post.id,
          videoUrl: post.video_url,
          title: post.title,
          caption: post.caption,
          hashtags: post.hashtags,
          queueId: (queueRow as any)?.id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      dispatched = json?.dispatched === true;
    } catch { /* Non-fatal — queue will be picked up on next pipeline run */ }
  }

  return { ok: true, dispatched };
}
