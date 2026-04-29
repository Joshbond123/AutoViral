// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state') || '';

  let appUrl = Deno.env.get('APP_URL') || 'https://joshbond123.github.io/AutoViral';
  try {
    const decoded = JSON.parse(atob(stateRaw));
    if (decoded?.app) appUrl = decoded.app;
  } catch {
    /* ignore */
  }

  if (!code) {
    return htmlResponse(`<p>No code provided.</p>`, 400);
  }

  const TIKTOK_CLIENT_KEY = Deno.env.get('TIKTOK_CLIENT_KEY')!;
  const TIKTOK_CLIENT_SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET')!;
  const SUPABASE_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/tiktok-callback`;

  try {
    const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: TIKTOK_CLIENT_KEY,
        client_secret: TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok || !tokenJson.access_token) {
      return htmlResponse(
        `<pre>Token exchange failed: ${JSON.stringify(tokenJson)}</pre>`,
        500,
      );
    }
    const { access_token, refresh_token, expires_in, open_id } = tokenJson;

    const userResp = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    const userJson = await userResp.json();
    const user = userJson?.data?.user || {};

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('profiles').upsert({
      id: open_id,
      username: user.display_name ?? null,
      avatar_url: user.avatar_url ?? null,
      access_token,
      refresh_token,
      expires_at: new Date(Date.now() + (expires_in ?? 0) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Send postMessage back to opener and close popup; if no opener, redirect.
    return htmlResponse(`
      <html><body><script>
        try {
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user_id: ${JSON.stringify(open_id)} }, '*');
            window.close();
          } else {
            localStorage.setItem('tiktok_user_id', ${JSON.stringify(open_id)});
            window.location.href = ${JSON.stringify(appUrl + '/dashboard')};
          }
        } catch (e) {
          document.body.innerText = 'Logged in. You can close this window.';
        }
      </script></body></html>
    `);
  } catch (err: any) {
    return htmlResponse(`<pre>Error: ${err?.message ?? String(err)}</pre>`, 500);
  }
});

function htmlResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
