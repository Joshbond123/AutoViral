// deno-lint-ignore-file
import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve((req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const TIKTOK_CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY')!;
  const APP_URL = Deno.env.get('APP_URL') || 'https://joshbond123.github.io/AutoViral';
  const SUPABASE_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL')!;

  // After TikTok auth, callback into our supabase edge function
  const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/tiktok-callback`;
  const scope = 'user.info.basic,video.publish,video.upload';
  const state = crypto.randomUUID();

  // Encode app_url in state so callback knows where to redirect
  const stateEncoded = btoa(JSON.stringify({ s: state, app: APP_URL }));

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
