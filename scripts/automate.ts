import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NICHES = [
  'Daily Crypto Scam',
  'Crypto Wallet Drain',
  'Fake Crypto Guru Exposed',
  'Crypto Investment Scam',
  'Crypto Scam Psychology',
  'AI Crypto Scam',
  'Crypto Romance Scam',
];

// ─── Key Rotation System ───────────────────────────────────────────────────────

interface KeyRecord {
  id: string;
  key_value: string;
  request_count: number;
  success_count: number;
  error_count: number;
}

async function tryWithKeys<T>(service: string, fn: (key: string) => Promise<T>): Promise<T> {
  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, key_value, request_count, success_count, error_count, status')
    .eq('service', service)
    .eq('is_active', true)
    .neq('status', 'failed')
    .order('request_count', { ascending: true })
    .order('last_used_at', { ascending: true, nullsFirst: true });

  const pool: KeyRecord[] = keys ?? [];
  if (pool.length === 0) throw new Error(`No available API keys for service: ${service}`);

  // Try active keys first, then rate_limited as fallback
  const sorted = [
    ...pool.filter((k: any) => k.status !== 'rate_limited'),
    ...pool.filter((k: any) => k.status === 'rate_limited'),
  ];

  let lastError: Error | null = null;

  for (const key of sorted) {
    try {
      const result = await fn(key.key_value);
      await supabase.from('api_keys').update({
        request_count: key.request_count + 1,
        success_count: key.success_count + 1,
        status: 'active',
        last_used_at: new Date().toISOString(),
      }).eq('id', key.id);
      return result;
    } catch (e: any) {
      const isRateLimit = /429|rate.?limit|too.?many|quota|exceeded/i.test(e.message ?? '');
      await supabase.from('api_keys').update({
        error_count: key.error_count + 1,
        request_count: key.request_count + 1,
        status: isRateLimit ? 'rate_limited' : 'failed',
        last_used_at: new Date().toISOString(),
      }).eq('id', key.id);
      console.warn(`  ⚠ Key [${key.id.slice(0, 8)}] for ${service}: ${isRateLimit ? 'rate_limited' : 'failed'} — ${e.message.slice(0, 120)}`);
      lastError = e;
    }
  }

  throw lastError ?? new Error(`All keys for ${service} exhausted`);
}

// ─── TopicShield™ ─────────────────────────────────────────────────────────────

interface ScriptResult {
  title: string;
  script: string;
  scenes: string[];
}

async function pickUniqueTopic(niche: string): Promise<string> {
  const { data: history } = await supabase
    .from('topic_history')
    .select('topic_title')
    .eq('niche', niche)
    .order('created_at', { ascending: false })
    .limit(100);

  const used = (history ?? []).map((h: any) => h.topic_title.toLowerCase());

  const prompt = `You are a TikTok content researcher for crypto scam awareness.
Generate ONE specific, real-sounding viral topic title for the niche: "${niche}".
The title should be dramatic, specific, and educational (warning people about scams).
AVOID these already-used topics: ${used.slice(0, 40).join(' | ')}
Return ONLY the topic title — nothing else, no quotes, no extra text.`;

  return tryWithKeys('cerebras', async (key) => {
    const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-3-235b-a22b-instruct-2507',
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error(`Cerebras topic ${resp.status}: ${await resp.text()}`);
    const json = await resp.json() as any;
    const topic = (json.choices?.[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
    return topic || `${niche} Warning — ${new Date().toLocaleDateString()}`;
  });
}

// ─── Script Generation ────────────────────────────────────────────────────────

async function generateScript(topic: string, niche: string): Promise<ScriptResult> {
  const prompt = `Create a VIRAL TikTok script for crypto scam awareness.
Topic: "${topic}"
Niche: ${niche}

Rules:
- Hook in first 2 seconds (shocking fact or question)
- Total 45-55 seconds of spoken content
- Fast-paced, dramatic, informative
- End with: "Follow for daily crypto scam warnings!"
- Do NOT use emojis in the voiceover script

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Eye-catching TikTok title under 80 chars",
  "script": "Full voiceover script as single paragraph, natural speech",
  "scenes": [
    "Scene 1: detailed visual for AI image gen, dramatic dark style",
    "Scene 2: ...",
    "Scene 3: ...",
    "Scene 4: ...",
    "Scene 5: ..."
  ]
}`;

  return tryWithKeys('cerebras', async (key) => {
    const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-3-235b-a22b-instruct-2507',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!resp.ok) throw new Error(`Cerebras script ${resp.status}: ${await resp.text()}`);
    const json = await resp.json() as any;
    const content = (json.choices?.[0]?.message?.content ?? '').trim();

    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          title: (parsed.title || topic).slice(0, 150),
          script: parsed.script || content,
          scenes: Array.isArray(parsed.scenes) && parsed.scenes.length > 0
            ? parsed.scenes.slice(0, 5)
            : [`${topic} dramatic warning visual, dark background, cinematic 9:16`],
        };
      }
    } catch { /* fall through */ }

    return {
      title: topic.slice(0, 150),
      script: content,
      scenes: [`${topic} crypto scam warning, dark dramatic visuals, news-style`],
    };
  });
}

// ─── Voiceover ────────────────────────────────────────────────────────────────

async function generateVoiceover(script: string): Promise<Buffer> {
  const cleanScript = script.replace(/[*_~`#\[\]]/g, '').slice(0, 3000);
  return tryWithKeys('unrealspeech', async (key) => {
    const resp = await fetch('https://api.v6.unrealspeech.com/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Text: cleanScript,
        VoiceId: 'Scarlett',
        Bitrate: '192k',
        Speed: '0',
        Pitch: '1.0',
        Codec: 'libmp3lame',
        Temperature: '0.25',
      }),
    });
    if (!resp.ok) throw new Error(`UnrealSpeech ${resp.status}: ${await resp.text()}`);
    return Buffer.from(await resp.arrayBuffer());
  });
}

// ─── Image Generation ─────────────────────────────────────────────────────────

async function generateImage(sceneDesc: string, index: number): Promise<Buffer> {
  const prompt = `${sceneDesc}. Vertical 9:16 format, cinematic, dark dramatic atmosphere, professional, no text.`;
  return tryWithKeys('cloudflare', async (cfToken) => {
    const { data: idKeys } = await supabase
      .from('api_keys')
      .select('key_value')
      .eq('service', 'cloudflare_id')
      .eq('is_active', true)
      .limit(1)
      .single();
    const cfAccountId = idKeys?.key_value;
    if (!cfAccountId) throw new Error('No Cloudflare Account ID configured');

    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, num_steps: 4 }),
      }
    );
    if (!resp.ok) throw new Error(`Cloudflare image (scene ${index + 1}) ${resp.status}: ${await resp.text()}`);

    const ct = resp.headers.get('content-type') ?? '';
    if (ct.includes('image/')) return Buffer.from(await resp.arrayBuffer());

    const json = await resp.json() as any;
    if (json?.result?.image) return Buffer.from(json.result.image, 'base64');
    throw new Error(`Unexpected Cloudflare response for scene ${index + 1}`);
  });
}

// ─── Remotion Video Assembly ───────────────────────────────────────────────────

async function assembleVideoWithRemotion(
  imagePaths: string[],
  audioPath: string,
  outputPath: string,
  script: string,
  title: string,
): Promise<void> {
  const { bundle } = await import('@remotion/bundler') as any;
  const { renderMedia, selectComposition, ensureBrowser } = await import('@remotion/renderer') as any;

  console.log('  Converting assets to data URLs...');
  const scenes = imagePaths.map(p => {
    const data = readFileSync(p).toString('base64');
    return `data:image/jpeg;base64,${data}`;
  });

  const audioData = readFileSync(audioPath).toString('base64');
  const audioSrc = `data:audio/mpeg;base64,${audioData}`;

  // Estimate duration from MP3 file size (192kbps encoding)
  const audioBytes = readFileSync(audioPath).byteLength;
  const estimatedSeconds = Math.max((audioBytes * 8) / (192 * 1000), 20);
  const durationInFrames = Math.ceil(estimatedSeconds * 30);
  console.log(`  Estimated duration: ${estimatedSeconds.toFixed(1)}s → ${durationInFrames} frames`);

  const inputProps = { scenes, audioSrc, script, title, durationInFrames };

  console.log('  Bundling Remotion composition...');
  const entryPoint = join(__dirname, 'remotion', 'root.tsx');
  const bundleLocation = await bundle({ entryPoint, webpackOverride: (cfg: any) => cfg });

  console.log('  Launching Chromium...');
  await ensureBrowser();

  console.log('  Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'TikTokVideo',
    inputProps,
  });

  console.log(`  Rendering ${durationInFrames} frames at 1080×1920...`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 15 * 60 * 1000,
    chromiumOptions: { disableWebSecurity: true },
    onProgress: ({ renderedFrames, totalFrames }: any) => {
      if (renderedFrames % 150 === 0 || renderedFrames === totalFrames) {
        const pct = ((renderedFrames / totalFrames) * 100).toFixed(0);
        console.log(`    ↳ ${renderedFrames}/${totalFrames} frames (${pct}%)`);
      }
    },
  });
}

// ─── Storage Upload ───────────────────────────────────────────────────────────

async function uploadFile(localPath: string, bucketPath: string, mime: string): Promise<string> {
  const fileData = readFileSync(localPath);
  const { error } = await supabase.storage
    .from('videos')
    .upload(bucketPath, fileData, { contentType: mime, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from('videos').getPublicUrl(bucketPath);
  return data.publicUrl;
}

// ─── TikTok Publishing ────────────────────────────────────────────────────────

async function publishToTikTok(videoPath: string, accessToken: string): Promise<string> {
  const videoData = readFileSync(videoPath);
  const videoSize = videoData.byteLength;

  const initResp = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
  });

  const initJson = await initResp.json() as any;
  if (!initResp.ok || !initJson?.data?.upload_url) {
    throw new Error(`TikTok init failed: ${JSON.stringify(initJson)}`);
  }

  const { upload_url, publish_id } = initJson.data;
  const putResp = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoSize),
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoData,
  });

  if (!putResp.ok) throw new Error(`TikTok upload PUT failed: ${putResp.status}`);
  return publish_id as string;
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

async function runPipeline(schedule: any): Promise<void> {
  const startTime = Date.now();
  const tmpDir = join(tmpdir(), `autoviral_${schedule.id.slice(0, 8)}_${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const niche = schedule.niche === 'AUTO'
    ? NICHES[Math.floor(Math.random() * NICHES.length)]
    : schedule.niche;

  console.log(`\n▶ Schedule ${schedule.id.slice(0, 8)} | niche: ${niche}`);

  await supabase.from('schedules').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
  }).eq('id', schedule.id);

  const { data: postRow } = await supabase.from('posts').insert({
    user_id: schedule.user_id,
    schedule_id: schedule.id,
    niche,
    status: 'processing',
  }).select().single();

  const postId: string | null = postRow?.id ?? null;

  const failSchedule = async (msg: string) => {
    const elapsed = Date.now() - startTime;
    console.error(`  ❌ ${msg}`);
    if (postId) {
      await supabase.from('posts').update({ status: 'failed', publish_result: msg }).eq('id', postId);
    }
    await supabase.from('schedules').update({
      status: 'failed',
      last_run_status: 'failed',
      last_error: msg.slice(0, 500),
      execution_time_ms: elapsed,
      error_message: msg.slice(0, 500),
      scheduled_time: new Date(Date.now() + 86400000).toISOString(),
    }).eq('id', schedule.id);
  };

  try {
    // 1. TopicShield
    console.log('  1/7 Researching unique topic...');
    const topic = await pickUniqueTopic(niche);
    console.log(`     → "${topic}"`);

    await supabase.from('topic_history').upsert({
      niche,
      topic_title: topic,
      topic_hash: Buffer.from(topic.toLowerCase().replace(/\s+/g, '_')).toString('base64').slice(0, 64),
    }).catch(() => {});

    if (postId) await supabase.from('posts').update({ topic, niche }).eq('id', postId);

    // 2. Script generation
    console.log('  2/7 Generating viral script...');
    const { title, script, scenes } = await generateScript(topic, niche);
    console.log(`     → "${title}"`);
    if (postId) await supabase.from('posts').update({ title, script }).eq('id', postId);

    // 3. Voiceover
    console.log('  3/7 Generating voiceover (UnrealSpeech)...');
    const audioBuffer = await generateVoiceover(script);
    const audioPath = join(tmpDir, 'voice.mp3');
    writeFileSync(audioPath, audioBuffer);
    console.log(`     → ${(audioBuffer.byteLength / 1024).toFixed(0)} KB`);

    // 4. Scene images
    console.log('  4/7 Generating scene images (Cloudflare AI)...');
    const imagePaths: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      try {
        const imgBuf = await generateImage(scenes[i], i);
        const imgPath = join(tmpDir, `scene_${i}.jpg`);
        writeFileSync(imgPath, imgBuf);
        imagePaths.push(imgPath);
        console.log(`     → Scene ${i + 1}: ${(imgBuf.byteLength / 1024).toFixed(0)} KB`);
      } catch (e: any) {
        console.warn(`     ⚠ Scene ${i + 1} failed: ${e.message}`);
        // Solid color fallback via Node.js
        const placeholderPath = join(tmpDir, `scene_${i}.jpg`);
        try {
          execSync(`convert -size 1080x1920 xc:#0a0a1e "${placeholderPath}" 2>/dev/null || true`);
          if (require('fs').existsSync(placeholderPath)) imagePaths.push(placeholderPath);
        } catch { /* skip */ }
      }
    }
    if (imagePaths.length === 0) throw new Error('All scene images failed to generate');

    // 5. Remotion video render
    console.log('  5/7 Rendering professional video with Remotion...');
    const videoPath = join(tmpDir, 'final.mp4');
    await assembleVideoWithRemotion(imagePaths, audioPath, videoPath, script, title);
    const videoSize = readFileSync(videoPath).byteLength;
    console.log(`     → ${(videoSize / (1024 * 1024)).toFixed(1)} MB`);

    // 6. Upload to Supabase Storage
    console.log('  6/7 Uploading to Supabase Storage...');
    const timestamp = Date.now();
    const userId = schedule.user_id;
    const videoUrl = await uploadFile(videoPath, `videos/${userId}/${timestamp}.mp4`, 'video/mp4');
    const thumbUrl = await uploadFile(imagePaths[0], `thumbnails/${userId}/${timestamp}.jpg`, 'image/jpeg');
    console.log(`     → ${videoUrl}`);

    if (postId) {
      await supabase.from('posts').update({
        video_url: videoUrl,
        thumbnail_url: thumbUrl,
        status: 'rendered',
      }).eq('id', postId);
    }

    // 7. Publish to TikTok
    console.log('  7/7 Publishing to TikTok...');
    const { data: profile } = await supabase
      .from('profiles')
      .select('access_token')
      .eq('id', userId)
      .maybeSingle();

    let publishId: string | null = null;
    let publishError: string | null = null;

    if (profile?.access_token) {
      try {
        publishId = await publishToTikTok(videoPath, profile.access_token);
        console.log(`     → publish_id: ${publishId}`);
      } catch (e: any) {
        publishError = e.message;
        console.warn(`     ⚠ TikTok publish failed: ${e.message}`);
      }
    } else {
      publishError = 'No TikTok access token found';
      console.warn('     ⚠ No TikTok access token — video saved to storage only');
    }

    const elapsed = Date.now() - startTime;

    if (postId) {
      await supabase.from('posts').update({
        status: publishId ? 'published' : 'rendered',
        publish_result: publishId ? `publish_id:${publishId}` : (publishError ?? null),
        published_at: publishId ? new Date().toISOString() : null,
      }).eq('id', postId);
    }

    await supabase.from('schedules').update({
      status: 'success',
      last_run_at: new Date().toISOString(),
      last_run_status: 'success',
      last_topic: topic,
      last_error: publishError,
      execution_time_ms: elapsed,
      scheduled_time: new Date(Date.now() + 86400000).toISOString(),
    }).eq('id', schedule.id);

    console.log(`  ✅ Done in ${(elapsed / 1000).toFixed(1)}s — ${publishId ? `published: ${publishId}` : 'stored: ' + videoUrl}`);

  } catch (err: any) {
    await failSchedule(err.message ?? String(err));
  } finally {
    try { execSync(`rm -rf "${tmpDir}"`); } catch { /* ignore */ }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀 AutoViral Pipeline (Remotion) — ' + new Date().toISOString());

  const { data: activeKeys } = await supabase
    .from('api_keys')
    .select('service')
    .eq('is_active', true)
    .neq('status', 'failed');

  const servicesPresent = new Set((activeKeys ?? []).map((k: any) => k.service));
  const required = ['cerebras', 'cloudflare', 'cloudflare_id', 'unrealspeech'];
  const missing = required.filter(s => !servicesPresent.has(s));

  if (missing.length > 0) {
    console.error(`❌ Missing API keys in Supabase: ${missing.join(', ')}`);
    console.error('   → Add them via the Settings page in the AutoViral dashboard.');
    process.exit(1);
  }

  const { data: schedules, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_time', new Date().toISOString());

  if (error) {
    console.error('Failed to fetch schedules:', error.message);
    process.exit(1);
  }

  if (!schedules || schedules.length === 0) {
    console.log('✓ No pending schedules due right now.');
    return;
  }

  console.log(`Found ${schedules.length} schedule(s) to run.`);
  for (const schedule of schedules) {
    await runPipeline(schedule);
  }

  console.log('\n✅ All pipelines complete!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
