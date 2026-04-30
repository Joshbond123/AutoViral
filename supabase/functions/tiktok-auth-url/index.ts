// deno-lint-ignore-file
  import { corsHeaders, handleCors } from '../_shared/cors.ts';

  Deno.serve((req) => {
    const cors = handleCors(req);
    if (cors) return cors;

    const TIKTOK_CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY')!;
    const APP_URL = Deno.env.get('APP_URL') || 'https://joshbond123.github.io/AutoViral';
    const SUPABASE_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL')!;

    // After TikTok auth, callback into our Supabase Edge Function.
    const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/tiktok-callback`;

    // Sandbox / unaudited-app safe scopes.
    // user.info.basic   -> read open_id, display_name, avatar_url
    // video.upload      -> upload videos into the authenticated user's TikTok inbox/drafts
    const scope = 'user.info.basic,video.upload';
    const csrfToken = crypto.randomUUID();

    // Encode appUrl in state so callback knows where to redirect the browser back to.
    const stateEncoded = btoa(JSON.stringify({ s: csrfToken, app: APP_URL }));

    const url =
      `https://www.tiktok.com/v2/auth/authorize/` +
      `?client_key=${TIKTOK_CLIENT_KEY}` +
      `&scope=${encodeURIComponent(scope)}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&state=${encodeURIComponent(stateEncoded)}`;

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  });
  