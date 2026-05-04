// deno-lint-ignore-file
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { userId, scheduledTime, niche } = await req.json();
    if (!userId || !scheduledTime || !niche) {
      return json({ error: 'Missing fields' }, 400);
    }

    // NOTE: The DB insert already happened client-side via the Supabase JS client.
    // This edge function only triggers the GitHub Actions pipeline dispatch.
    // Do NOT insert again here to prevent duplicate schedule records.

    const ghPat = Deno.env.get('GH_DISPATCH_PAT');
    const owner = Deno.env.get('GH_REPO_OWNER') || 'Joshbond123';
    const repo = Deno.env.get('GH_REPO_NAME') || 'AutoViral';

    if (ghPat) {
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
            body: JSON.stringify({ event_type: 'schedule_trigger' }),
          }
        );
        if (!dispatchResp.ok) {
          const errText = await dispatchResp.text();
          console.warn(`GitHub dispatch failed: ${dispatchResp.status} — ${errText}`);
        }
      } catch (e) {
        console.warn(`GitHub dispatch error: ${(e as Error).message}`);
      }
    }

    return json({ ok: true, dispatched: Boolean(ghPat) });
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
