// deno-lint-ignore-file
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { userId, jobId, instant } = await req.json();
    if (!userId || !jobId) {
      return json({ error: 'Missing fields: userId and jobId are required' }, 400);
    }

    const ghPat = Deno.env.get('GH_DISPATCH_PAT');
    const owner = Deno.env.get('GH_REPO_OWNER') || 'Joshbond123';
    const repo = Deno.env.get('GH_REPO_NAME') || 'AutoViral';

    // Only dispatch immediately for "generate now" requests.
    // Scheduled jobs will be picked up by the cron-based manual-generate workflow.
    if (ghPat && instant) {
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
              event_type: 'manual_generate',
              client_payload: { job_id: jobId, user_id: userId },
            }),
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

    return json({ ok: true, dispatched: Boolean(ghPat && instant) });
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
