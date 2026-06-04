/**
 * facebook-publish.ts — Standalone Facebook Page Publisher
 *
 * Processes pending items from facebook_delivery_queue.
 * Called by the GitHub Actions `facebook-publish.yml` workflow.
 *
 * Usage:
 *   npx tsx scripts/facebook-publish.ts                        # process all pending
 *   npx tsx scripts/facebook-publish.ts --queue-id <uuid>      # specific item only
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const queueIdIdx = args.indexOf('--queue-id');
const targetQueueId: string | null = queueIdIdx !== -1 ? (args[queueIdIdx + 1] ?? null) : null;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔷 Facebook Page Publisher starting…');

  let query = supabase
    .from('facebook_delivery_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (targetQueueId) {
    query = supabase
      .from('facebook_delivery_queue')
      .select('*')
      .eq('id', targetQueueId)
      .eq('status', 'pending');
  }

  const { data: items, error } = await query;
  if (error) {
    console.error('❌  Failed to fetch queue:', error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('✅  No pending Facebook delivery items.');
    return;
  }

  console.log(`📋  Found ${items.length} pending item(s).`);

  for (const item of items) {
    console.log(`\n→ Processing queue item ${item.id} (post: ${item.post_id ?? 'none'})`);
    await processItem(item);
  }

  console.log('\n✅  facebook-publish.ts complete.');
}

async function processItem(item: any) {
  // Mark as processing
  await supabase
    .from('facebook_delivery_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', item.id);

  // Get Facebook settings for this user
  const { data: fbSettings } = await supabase
    .from('facebook_settings')
    .select('id, page_access_token, page_id, page_name')
    .eq('user_id', item.user_id)
    .eq('is_active', true)
    .neq('status', 'failed')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fbSettings?.page_access_token) {
    console.warn('  ⚠ No active Facebook Page token found — skipping.');
    await supabase.from('facebook_delivery_queue').update({
      status: 'failed',
      error_message: 'No active Facebook Page token configured for this user.',
      completed_at: new Date().toISOString(),
    }).eq('id', item.id);
    return;
  }

  const token = fbSettings.page_access_token;
  const pageId = fbSettings.page_id || 'me';
  const description = [item.caption, item.hashtags].filter(Boolean).join('\n');

  try {
    const resp = await fetch(
      `https://graph-video.facebook.com/v20.0/${pageId}/videos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          file_url: item.video_url,
          description: description || undefined,
          title: item.title || undefined,
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `Facebook API ${resp.status}`;
      try { const ej = JSON.parse(errText); errMsg = ej?.error?.message ?? errMsg; } catch { errMsg = errText.slice(0, 300) || errMsg; }
      throw new Error(errMsg);
    }

    const json: any = await resp.json();
    const fbPostId = json?.id ?? '';
    console.log(`  ✅ Published${fbSettings.page_name ? ` to ${fbSettings.page_name}` : ''}: post ${fbPostId}`);

    // Update queue item
    await supabase.from('facebook_delivery_queue').update({
      status: 'delivered',
      fb_post_id: fbPostId,
      completed_at: new Date().toISOString(),
    }).eq('id', item.id);

    // Update post record if linked
    if (item.post_id) {
      await supabase.from('posts').update({
        status: 'published',
        publish_result: `facebook:${fbPostId}`,
        published_at: new Date().toISOString(),
      }).eq('id', item.post_id);
    }

    // Update facebook_settings last_published_at
    await supabase.from('facebook_settings').update({
      status: 'active',
      last_published_at: new Date().toISOString(),
    }).eq('id', fbSettings.id);

    // Create notification
    try {
      await supabase.from('notifications').insert({
        user_id: item.user_id,
        title: 'Published to Facebook',
        message: `"${item.title || 'Video'}" has been published to your Facebook Page.`,
        type: 'success',
        post_id: item.post_id ?? null,
      });
    } catch { /* non-critical */ }

  } catch (e: any) {
    const errMsg = e.message?.slice(0, 500) ?? String(e);
    console.error(`  ❌ Publish failed: ${errMsg}`);
    await supabase.from('facebook_delivery_queue').update({
      status: 'failed',
      error_message: errMsg,
      completed_at: new Date().toISOString(),
    }).eq('id', item.id);
    await supabase.from('facebook_settings').update({ status: 'failed' }).eq('id', fbSettings.id);
  }
}

main().catch(err => {
  console.error('❌  Unhandled error:', err);
  process.exit(1);
});
