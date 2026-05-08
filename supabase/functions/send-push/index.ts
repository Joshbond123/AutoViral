// deno-lint-ignore-file
// Supabase Edge Function: send-push
// Sends a Web Push notification to all subscriptions for a user.
//
// Required Supabase secrets:
//   VAPID_PUBLIC_KEY  — from: npx web-push generate-vapid-keys
//   VAPID_PRIVATE_KEY — from: npx web-push generate-vapid-keys
//   SUPABASE_URL      — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { userId, title, body, url, postId, tag } = await req.json();
    if (!userId || !title) return json({ error: 'Missing userId or title' }, 400);

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured — push notifications disabled');
      return json({ ok: true, sent: 0, skipped: true });
    }

    webpush.setVapidDetails(
      'mailto:autoviral@noreply.com',
      vapidPublicKey,
      vapidPrivateKey,
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (error) return json({ error: error.message }, 500);
    if (!subs || subs.length === 0) return json({ ok: true, sent: 0 });

    const payload = JSON.stringify({ title, body, url: url || '/AutoViral/manual', postId, tag });

    let sent = 0;
    const expired: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          sent++;
        } catch (e: any) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            expired.push(sub.id);
          } else {
            console.warn(`Push failed for sub ${sub.id}: ${e.message}`);
          }
        }
      })
    );

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
    }

    return json({ ok: true, sent, expired: expired.length });
  } catch (err: any) {
    return json({ error: err?.message ?? String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
