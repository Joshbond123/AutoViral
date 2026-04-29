// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

    const SUPABASE_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const { data, error } = await supabase
      .from('schedules')
      .insert([{ user_id: userId, scheduled_time: scheduledTime, niche, status: 'pending' }])
      .select();
    if (error) return json({ error: error.message }, 500);

    // Best-effort trigger of the GitHub Actions automation pipeline.
    const ghPat = Deno.env.get('GH_DISPATCH_PAT');
    const owner = Deno.env.get('GH_REPO_OWNER') || 'Joshbond123';
    const repo = Deno.env.get('GH_REPO_NAME') || 'AutoViral';
    if (ghPat) {
      try {
        await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ghPat}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ event_type: 'schedule_trigger' }),
        });
      } catch { /* non-fatal */ }
    }

    return json(data);
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
