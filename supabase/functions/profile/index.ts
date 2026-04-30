// deno-lint-ignore-file
  // Returns the saved TikTok profile (display_name, avatar_url) for a given open_id.
  // Used by the dashboard to show the connected account.
  import { corsHeaders, handleCors } from '../_shared/cors.ts';
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  Deno.serve(async (req) => {
    const cors = handleCors(req);
    if (cors) return cors;

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    if (!userId) {
      return json({ error: 'userId_required' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, expires_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);

    return json(data ?? null);
  });

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  