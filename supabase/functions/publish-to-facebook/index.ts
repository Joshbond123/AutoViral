// deno-lint-ignore-file
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return null;
}

const FB_GRAPH_VERSION = 'v20.0';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { userId, postId, videoUrl, title, caption, hashtags } = await req.json();
    if (!userId) return json({ error: 'Missing userId' }, 400);
    if (!videoUrl) return json({ error: 'Missing videoUrl' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      return json({ error: 'Supabase not configured' }, 500);
    }

    const authHeaders = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    // Fetch the user's first active Facebook Page token
    const settingsResp = await fetch(
      `${supabaseUrl}/rest/v1/facebook_settings?user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&status=neq.failed&order=created_at.asc&limit=1`,
      { headers: authHeaders },
    );

    const settings: any[] = await settingsResp.json().catch(() => []);

    if (!settings || settings.length === 0 || !settings[0]?.page_access_token) {
      return json({ ok: false, dispatched: false, error: 'No active Facebook Page token configured. Add one in Settings.' });
    }

    const setting = settings[0];
    const token = setting.page_access_token;
    const pageId = setting.page_id || 'me';
    const description = [caption, hashtags].filter(Boolean).join('\n');

    // Insert into delivery queue so we have a record regardless of outcome
    const queueResp = await fetch(`${supabaseUrl}/rest/v1/facebook_delivery_queue`, {
      method: 'POST',
      headers: { ...authHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId,
        post_id: postId ?? null,
        facebook_setting_id: setting.id,
        video_url: videoUrl,
        title: title ?? null,
        caption: caption ?? null,
        hashtags: hashtags ?? null,
        status: 'processing',
      }),
    });
    const queueRow: any = await queueResp.json().catch(() => null);
    const queueId = Array.isArray(queueRow) ? queueRow[0]?.id : queueRow?.id;

    // Publish video to Facebook Page
    const fbResp = await fetch(
      `https://graph-video.facebook.com/${FB_GRAPH_VERSION}/${pageId}/videos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          file_url: videoUrl,
          description: description || undefined,
          title: title || undefined,
        }),
      },
    );

    if (!fbResp.ok) {
      const errText = await fbResp.text();
      let errMsg = `Facebook API ${fbResp.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message ?? errMsg;
      } catch { errMsg = errText.slice(0, 200) || errMsg; }

      // Mark setting as failed + update queue
      await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/facebook_settings?id=eq.${setting.id}`, {
          method: 'PATCH',
          headers: { ...authHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'failed', updated_at: new Date().toISOString() }),
        }),
        queueId ? fetch(`${supabaseUrl}/rest/v1/facebook_delivery_queue?id=eq.${queueId}`, {
          method: 'PATCH',
          headers: { ...authHeaders, Prefer: 'return=minimal' },
          body: JSON.stringify({ status: 'failed', error_message: errMsg }),
        }) : Promise.resolve(),
      ]);

      return json({ ok: false, dispatched: false, error: errMsg });
    }

    const fbJson: any = await fbResp.json().catch(() => ({}));
    const fbPostId: string = fbJson?.id ?? '';

    const now = new Date().toISOString();

    // Update queue, setting, post record, and insert notification in parallel
    await Promise.all([
      // Update delivery queue
      queueId ? fetch(`${supabaseUrl}/rest/v1/facebook_delivery_queue?id=eq.${queueId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'published', fb_post_id: fbPostId, published_at: now }),
      }) : Promise.resolve(),

      // Update facebook_settings — mark as active + last published
      fetch(`${supabaseUrl}/rest/v1/facebook_settings?id=eq.${setting.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'active', last_published_at: now, updated_at: now }),
      }),

      // Update post record if provided
      postId ? fetch(`${supabaseUrl}/rest/v1/posts?id=eq.${postId}`, {
        method: 'PATCH',
        headers: { ...authHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'published',
          published_at: now,
          publish_result: `facebook:${fbPostId}`,
        }),
      }) : Promise.resolve(),

      // Insert success notification
      fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: 'POST',
        headers: { ...authHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          title: 'Published to Facebook',
          message: `"${title ?? 'Your video'}" has been published to your Facebook Page${setting.page_name ? ` (${setting.page_name})` : ''}.`,
          type: 'success',
          post_id: postId ?? null,
        }),
      }),
    ]);

    return json({ ok: true, dispatched: true, fbPostId, pageName: setting.page_name ?? null });

  } catch (err: any) {
    console.error('publish-to-facebook error:', err);
    return json({ ok: false, dispatched: false, error: err?.message ?? String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
