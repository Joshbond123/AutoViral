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

const WEBSITE_LINK = 'https://onchain-detectives.free.nf';

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

// ─── Video Feed Post ID Resolver ───────────────────────────────────────────────
// Video uploads return a video_id; commenting requires the feed post_id ({PAGE_ID}_{POST_ID})

async function getVideoFeedPostId(token: string, videoId: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v20.0/${videoId}?fields=id,posts&access_token=${encodeURIComponent(token)}`
    );
    if (resp.ok) {
      const json: any = await resp.json();
      const postId = json?.posts?.data?.[0]?.id;
      if (postId) {
        console.log(`  🔗 Resolved feed post ID for comment: ${postId}`);
        return postId;
      }
    }
  } catch {}
  console.log(`  🔗 Using video ID directly for comment: ${videoId}`);
  return videoId;
}

// ─── Cerebras Comment Generator ───────────────────────────────────────────────

async function generateAndPostFacebookComment(
  supabaseClient: ReturnType<typeof createClient>,
  pageToken: string,
  fbPostId: string,
  title: string,
  topic: string
): Promise<void> {
  // Fetch one active Cerebras key from Supabase
  const { data: keys } = await supabaseClient
    .from('api_keys')
    .select('api_key')
    .eq('service', 'cerebras')
    .eq('status', 'active')
    .limit(1);

  const cerebrasKey = keys?.[0]?.api_key as string | undefined;
  let commentText: string;

  if (cerebrasKey) {
    const prompt = `You are a social media engagement specialist for a crypto scam awareness page.

Write a single engaging Facebook comment to post under a newly published video about:
Title: "${title}"
Topic: "${topic || title}"

REQUIREMENTS:
- Directly relevant to this specific scam type — not generic
- Encourages viewers to like and share the post
- Asks one thought-provoking question to spark discussion
- Naturally includes this link: ${WEBSITE_LINK}
- Maximum 280 characters total (including the link)
- Urgent, authentic tone — like an investigator speaking to potential victims
- NEVER start with "Great video", "Thanks for watching", or similar generic openers
- Return ONLY the comment text — no quotes, no labels, no explanation`;

    try {
      const aiResp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cerebrasKey}` },
        body: JSON.stringify({
          model: 'gpt-oss-120b',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
        }),
      });
      if (aiResp.ok) {
        const aiJson: any = await aiResp.json();
        const raw = ((aiJson?.choices?.[0]?.message?.content as string) || '').trim().replace(/^["']|["']$/g, '');
        commentText = raw.includes(WEBSITE_LINK)
          ? raw.slice(0, 500)
          : `${raw.slice(0, 220)} ${WEBSITE_LINK}`.trim();
      } else {
        throw new Error(`Cerebras ${aiResp.status}`);
      }
    } catch (e: any) {
      console.warn(`  ⚠ Cerebras comment generation failed: ${e.message} — using fallback`);
      commentText = `Have you or someone you know been targeted by this type of scam? Share your experience below — your story could protect others. Get free help at ${WEBSITE_LINK}`;
    }
  } else {
    console.warn('  ⚠ No active Cerebras key found — using fallback comment');
    commentText = `Have you or someone you know been targeted by this type of scam? Share your experience below — your story could protect others. Get free help at ${WEBSITE_LINK}`;
  }

  // Wait for Facebook to finish processing the video before commenting
  console.log('  ⏳ Waiting 8s for Facebook to process video before commenting...');
  await new Promise(r => setTimeout(r, 8000));

  // Post the comment with retry logic
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const commentResp = await fetch(
      `https://graph.facebook.com/v20.0/${fbPostId}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: pageToken, message: commentText }),
      }
    );
    if (commentResp.ok) {
      const commentJson: any = await commentResp.json();
      console.log(`  💬 Auto-comment posted successfully: ${commentJson.id}`);
      return;
    }
    const err = await commentResp.text();
    const errMsg = `Facebook comment API ${commentResp.status}: ${err.slice(0, 300)}`;
    console.warn(`  ⚠ Comment attempt ${attempt}/${maxRetries} failed: ${errMsg}`);
    if (attempt < maxRetries) {
      const waitMs = 5000 * attempt;
      console.log(`  ⏳ Retrying comment in ${waitMs / 1000}s...`);
      await new Promise(r => setTimeout(r, waitMs));
    } else {
      throw new Error(errMsg);
    }
  }
}

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
      `https://graph.facebook.com/v20.0/${pageId}/videos`,
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

    // Auto-generate and post an engaging comment with the website link
    try {
      console.log('  💬 Generating auto-comment...');
      // Resolve feed post ID — video upload returns video_id, comments need the feed post_id
      const commentPostId = await getVideoFeedPostId(token, fbPostId);
      await generateAndPostFacebookComment(supabase, token, commentPostId, item.title || '', item.topic || item.title || '');
    } catch (ce: any) {
      console.warn(`  ⚠ Auto-comment failed (non-critical): ${ce.message?.slice(0, 200)}`);
    }

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
