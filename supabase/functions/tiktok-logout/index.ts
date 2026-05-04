// deno-lint-ignore-file
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
  import { corsHeaders, handleCors } from '../_shared/cors.ts';

  Deno.serve(async (req) => {
    const cors = handleCors(req);
    if (cors) return cors;

    const TIKTOK_CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY')!;
    const TIKTOK_CLIENT_SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET')!;
    const SUPABASE_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    let userId: string | null = null;
    try {
      const body = await req.json();
      userId = body?.user_id ?? null;
    } catch {
      // no body — treat as anonymous flush
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // If we have a user_id, revoke their TikTok token and delete their profile
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('access_token, refresh_token')
        .eq('id', userId)
        .single();

      // Revoke the access token at TikTok's servers so they cannot be reused
      if (profile?.access_token) {
        try {
          await fetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_key: TIKTOK_CLIENT_KEY,
              client_secret: TIKTOK_CLIENT_SECRET,
              token: profile.access_token,
            }),
          });
        } catch {
          // Non-fatal — proceed with local cleanup regardless
        }
      }

      // Delete all user data: posts, schedules, then profile (FK order)
      await supabase.from('posts').delete().eq('user_id', userId);
      await supabase.from('schedules').delete().eq('user_id', userId);
      await supabase.from('profiles').delete().eq('id', userId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  });
  