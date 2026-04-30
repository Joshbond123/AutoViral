// deno-lint-ignore-file
  // Uploads a video to the authenticated TikTok user's inbox (drafts).
  // Uses the v2 Content Posting API:  /post/publish/inbox/video/init/  with FILE_UPLOAD.
  // Suitable for unaudited / sandbox apps that have ONLY the video.upload scope.
  //
  // Frontend POSTs multipart/form-data with:
  //   userId : the TikTok open_id (same value the SPA stores in localStorage)
  //   video  : the video file (mp4 etc), single chunk, keep under ~5 MB for demos
  import { corsHeaders, handleCors } from '../_shared/cors.ts';
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  Deno.serve(async (req) => {
    const cors = handleCors(req);
    if (cors) return cors;
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let userId = '';
    let videoBytes: Uint8Array | null = null;
    let videoMime = 'video/mp4';

    try {
      const form = await req.formData();
      userId = String(form.get('userId') || '');
      const file = form.get('video');
      if (file instanceof File) {
        videoBytes = new Uint8Array(await file.arrayBuffer());
        if (file.type) videoMime = file.type;
      }
    } catch (e) {
      return json({ error: 'parse_failed', detail: (e as Error).message }, 400);
    }

    if (!userId || !videoBytes || videoBytes.byteLength === 0) {
      return json({ error: 'userId_and_video_required' }, 400);
    }

    const SUPABASE_URL = Deno.env.get('SB_URL') || Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY =
      Deno.env.get('SB_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('access_token')
      .eq('id', userId)
      .maybeSingle();

    if (profErr || !profile?.access_token) {
      return json(
        { error: 'profile_not_found_or_no_token', detail: profErr?.message ?? null },
        404,
      );
    }

    const videoSize = videoBytes.byteLength;

    // Step 1: init the upload. Single-chunk for simplicity (the last chunk may be < 5 MB).
    const initResp = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${profile.access_token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: videoSize,
            total_chunk_count: 1,
          },
        }),
      },
    );
    const initJson = await initResp.json();
    if (!initResp.ok || !initJson?.data?.upload_url) {
      return json({ error: 'init_failed', tiktok: initJson }, 502);
    }

    const uploadUrl: string = initJson.data.upload_url;
    const publishId: string = initJson.data.publish_id;

    // Step 2: PUT the video bytes to the signed upload URL TikTok returned.
    const putResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': videoMime,
        'Content-Length': String(videoSize),
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBytes,
    });
    const putText = await putResp.text();

    return json(
      {
        ok: putResp.ok,
        publish_id: publishId,
        upload_status: putResp.status,
        upload_response: putText.slice(0, 500),
        tiktok_init: initJson,
      },
      putResp.ok ? 200 : 502,
    );
  });

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  