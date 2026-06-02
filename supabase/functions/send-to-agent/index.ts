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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { userId, postId, videoUrl, title, caption, hashtags, queueId } = await req.json();
    if (!userId) return json({ error: 'Missing userId' }, 400);

    const ghPat   = Deno.env.get('GH_DISPATCH_PAT');
    const owner   = Deno.env.get('GH_REPO_OWNER') || 'Joshbond123';
    const repo    = Deno.env.get('GH_REPO_NAME')  || 'AutoViral';

    let dispatched = false;
    if (ghPat && queueId) {
      try {
        const dispatchResp = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/dispatches`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${ghPat}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event_type: 'telegram_deliver',
              client_payload: { queue_id: queueId, user_id: userId },
            }),
          }
        );
        if (dispatchResp.ok) {
          dispatched = true;
        } else {
          const errText = await dispatchResp.text();
          console.warn(`GitHub dispatch failed: ${dispatchResp.status} — ${errText}`);
        }
      } catch (e) {
        console.warn(`GitHub dispatch error: ${(e as Error).message}`);
      }
    }

    return json({ ok: true, dispatched, queueId });
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
