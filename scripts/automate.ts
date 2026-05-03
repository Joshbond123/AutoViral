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

// ─── Curated Royalty-Free Background Music ─────────────────────────────────
// All tracks are royalty-free and suitable for social media content
const BACKGROUND_MUSIC_TRACKS = [
  'https://assets.mixkit.co/music/preview/mixkit-dramatic-mystery-trailer-599.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-news-big-moment-574.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-adventure-awaits-471.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-epic-orchestra-736.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-dark-suspense-tension-583.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-cinematic-tension-pulsing-521.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-inspiring-cinematic-documentary-120.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3',
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

  const sorted = [
    ...pool.filter((k: any) => k.status !== 'rate_limited'),
    ...pool.filter((k: any) => k.status === 'rate_limited'),
  ];

  let lastError: Error | null = null;

  for (const key of sorted) {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        const isRateLimit = /429|rate.?limit|too.?many|quota|exceeded|high.?traffic/i.test(e.message ?? '');
        if (isRateLimit && attempt < maxAttempts) {
          const delay = attempt * 4000;
          console.warn(`  ⚠ Key [${key.id.slice(0, 8)}] rate limited — retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        await supabase.from('api_keys').update({
          error_count: key.error_count + 1,
          request_count: key.request_count + 1,
          status: isRateLimit ? 'rate_limited' : 'failed',
          last_used_at: new Date().toISOString(),
        }).eq('id', key.id);
        console.warn(`  ⚠ Key [${key.id.slice(0, 8)}] [${service}]: ${isRateLimit ? 'rate_limited' : 'failed'} — ${e.message.slice(0, 120)}`);
        lastError = e;
        break;
      }
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
        model: 'llama3.1-8b',
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

CRITICAL: You MUST generate exactly 5 unique scene descriptions. Each scene MUST be a pure VISUAL description only — NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO CAPTIONS in any scene. Describe ONLY what is visually happening (people, objects, environments, emotions, colors, lighting).

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Eye-catching TikTok title under 80 chars",
  "script": "Full voiceover script as single paragraph, natural speech, 45-55 seconds when read aloud",
  "scenes": [
    "Scene 1: [pure visual description — e.g. A shadowy figure in a dark hoodie sitting behind multiple monitors in a dim room, blue light casting harsh shadows, cinematic 9:16 vertical]",
    "Scene 2: [pure visual description]",
    "Scene 3: [pure visual description]",
    "Scene 4: [pure visual description]",
    "Scene 5: [pure visual description]"
  ]
}`;

  return tryWithKeys('cerebras', async (key) => {
    const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        max_tokens: 1800,
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
        const rawScenes: string[] = Array.isArray(parsed.scenes) ? parsed.scenes : [];

        // Ensure we always have exactly 5 scenes
        const defaultScenes = [
          `${topic} — shadowy hacker figure at multiple monitors, dark dramatic lighting, cinematic vertical`,
          `${topic} — crashing red stock charts on screen, person looking shocked, dark office environment`,
          `${topic} — pile of Bitcoin and dollar bills vanishing, dramatic dark atmosphere, cinematic`,
          `${topic} — anonymous hooded figure in dimly lit room, suspicious activity, blue neon lighting`,
          `${topic} — glowing warning signs and digital lock icons, dark background, dramatic cinematic`,
        ];

        const scenes = rawScenes.length >= 5
          ? rawScenes.slice(0, 5)
          : [...rawScenes, ...defaultScenes.slice(rawScenes.length)];

        return {
          title: (parsed.title || topic).slice(0, 150),
          script: parsed.script || content,
          scenes,
        };
      }
    } catch { /* fall through */ }

    return {
      title: topic.slice(0, 150),
      script: content,
      scenes: [
        `${topic} crypto scam warning — shadowy figure at computer, dark dramatic atmosphere, cinematic 9:16`,
        `${topic} — victim looking at empty crypto wallet on screen, shocked expression, dark room`,
        `${topic} — anonymous hacker in hoodie with multiple screens, blue neon lighting, dramatic`,
        `${topic} — digital vault cracking open and disappearing, dark cinematic atmosphere`,
        `${topic} — person crying while looking at phone with financial loss, dramatic dark lighting`,
      ],
    };
  });
}

// ─── Voiceover ────────────────────────────────────────────────────────────────

async function generateVoiceover(script: string): Promise<Buffer> {
  // Clean script of markdown and limit length
  const cleanScript = script
    .replace(/[*_~`#\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);

  return tryWithKeys('unrealspeech', async (key) => {
    const resp = await fetch('https://api.v6.unrealspeech.com/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Text: cleanScript,
        VoiceId: 'Scarlett',
        Bitrate: '192k',
        Speed: '-0.1',       // Slightly slower for clarity and impact
        Pitch: '1.0',
        Codec: 'libmp3lame',
        Temperature: '0.3',  // Slightly more expressive
      }),
    });
    if (!resp.ok) throw new Error(`UnrealSpeech ${resp.status}: ${await resp.text()}`);

    const ct = resp.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const json = await resp.json() as any;
      if (!json.OutputUri) throw new Error(`UnrealSpeech: no OutputUri — ${JSON.stringify(json)}`);
      console.log(`     → Downloading audio from S3...`);
      const audioResp = await fetch(json.OutputUri);
      if (!audioResp.ok) throw new Error(`S3 audio download failed: ${audioResp.status}`);
      const buf = Buffer.from(await audioResp.arrayBuffer());
      if (buf.byteLength < 1000) throw new Error(`UnrealSpeech S3 audio empty (${buf.byteLength} bytes)`);
      return buf;
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength < 1000) throw new Error(`UnrealSpeech returned empty audio (${buf.byteLength} bytes)`);
    return buf;
  });
}

// ─── Image Generation ─────────────────────────────────────────────────────────

async function generateImage(sceneDesc: string, index: number): Promise<Buffer> {
  // Critical: multiple explicit "no text" instructions to prevent text overlay in images
  const prompt = [
    sceneDesc,
    'Vertical 9:16 format, cinematic, dark dramatic atmosphere, professional photography.',
    'CRITICAL: absolutely NO text, NO words, NO letters, NO numbers, NO captions, NO subtitles, NO watermarks, NO labels anywhere in the image.',
    'Pure photographic/cinematic visual only.',
  ].join(' ');

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

// ─── Background Music ─────────────────────────────────────────────────────────

async function downloadBackgroundMusic(tmpDir: string): Promise<string | null> {
  const trackUrl = BACKGROUND_MUSIC_TRACKS[Math.floor(Math.random() * BACKGROUND_MUSIC_TRACKS.length)];
  const musicPath = join(tmpDir, 'music.mp3');

  try {
    console.log(`     → Downloading background music...`);
    const resp = await fetch(trackUrl, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) {
      console.warn(`     ⚠ Music download failed (${resp.status}) — running without background music`);
      return null;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength < 10000) {
      console.warn(`     ⚠ Music file too small (${buf.byteLength} bytes) — skipping`);
      return null;
    }
    writeFileSync(musicPath, buf);
    console.log(`     → Music: ${(buf.byteLength / 1024).toFixed(0)} KB`);
    return musicPath;
  } catch (e: any) {
    console.warn(`     ⚠ Music download error: ${e.message} — running without background music`);
    return null;
  }
}

// ─── Remotion Video Assembly ───────────────────────────────────────────────────

async function assembleVideoWithRemotion(
  imagePaths: string[],
  audioPath: string,
  musicPath: string | null,
  outputPath: string,
  script: string,
  title: string,
): Promise<void> {
  const { bundle } = await import('@remotion/bundler') as any;
  const { renderMedia, selectComposition, ensureBrowser } = await import('@remotion/renderer') as any;

  console.log('  Converting assets to data URLs...');

  // Convert all scene images to base64 data URLs
  const scenes = imagePaths.map(p => {
    const data = readFileSync(p).toString('base64');
    return `data:image/jpeg;base64,${data}`;
  });

  console.log(`  → ${scenes.length} scene(s) loaded`);

  const audioBytes = readFileSync(audioPath).byteLength;
  const hasAudio = audioBytes > 1000;
  const audioSrc = hasAudio
    ? `data:audio/mpeg;base64,${readFileSync(audioPath).toString('base64')}`
    : '';
  if (!hasAudio) console.warn('  ⚠ Audio file empty — rendering without voiceover');

  // Convert background music to data URL
  let musicSrc = '';
  if (musicPath) {
    try {
      const musicData = readFileSync(musicPath).toString('base64');
      musicSrc = `data:audio/mpeg;base64,${musicData}`;
      console.log('  → Background music loaded');
    } catch { /* skip music if it fails */ }
  }

  // Estimate duration from MP3 file size at 192kbps; minimum 25s, maximum 75s
  const estimatedSeconds = hasAudio
    ? Math.min(Math.max((audioBytes * 8) / (192 * 1000), 25), 75)
    : 35;
  const durationInFrames = Math.ceil(estimatedSeconds * 30);
  console.log(`  Estimated duration: ${estimatedSeconds.toFixed(1)}s → ${durationInFrames} frames`);

  const inputProps = { scenes, audioSrc, musicSrc, script, title, durationInFrames };

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
    console.log('  1/8 Researching unique topic...');
    const topic = await pickUniqueTopic(niche);
    console.log(`     → "${topic}"`);

    try {
      await supabase.from('topic_history').upsert({
        niche,
        topic_title: topic,
        topic_hash: Buffer.from(topic.toLowerCase().replace(/\s+/g, '_')).toString('base64').slice(0, 64),
      });
    } catch { /* non-critical */ }

    if (postId) await supabase.from('posts').update({ topic, niche }).eq('id', postId);

    // 2. Script generation
    console.log('  2/8 Generating viral script with 5 scenes...');
    const { title, script, scenes } = await generateScript(topic, niche);
    console.log(`     → "${title}" | ${scenes.length} scenes`);
    if (postId) await supabase.from('posts').update({ title, script }).eq('id', postId);

    // 3. Voiceover
    console.log('  3/8 Generating voiceover (UnrealSpeech)...');
    const audioBuffer = await generateVoiceover(script);
    const audioPath = join(tmpDir, 'voice.mp3');
    writeFileSync(audioPath, audioBuffer);
    console.log(`     → ${(audioBuffer.byteLength / 1024).toFixed(0)} KB`);

    // 4. Background music (parallel-friendly, non-critical)
    console.log('  4/8 Downloading background music...');
    const musicPath = await downloadBackgroundMusic(tmpDir);

    // 5. Scene images — generate all 5 scenes
    console.log(`  5/8 Generating ${scenes.length} scene images (Cloudflare AI)...`);
    const imagePaths: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      try {
        const imgBuf = await generateImage(scenes[i], i);
        const imgPath = join(tmpDir, `scene_${i}.jpg`);
        writeFileSync(imgPath, imgBuf);
        imagePaths.push(imgPath);
        console.log(`     → Scene ${i + 1}/${scenes.length}: ${(imgBuf.byteLength / 1024).toFixed(0)} KB ✓`);
      } catch (e: any) {
        console.warn(`     ⚠ Scene ${i + 1} failed: ${e.message} — using dark fallback`);
        // Create a dark solid-color fallback image using ImageMagick or sharp
        const placeholderPath = join(tmpDir, `scene_${i}.jpg`);
        try {
          // Try ImageMagick
          execSync(`convert -size 1080x1920 "xc:#0d0d1a" "${placeholderPath}" 2>/dev/null || true`);
          const fs = await import('fs');
          if (fs.existsSync(placeholderPath) && fs.statSync(placeholderPath).size > 100) {
            imagePaths.push(placeholderPath);
          }
        } catch { /* skip this scene */ }
      }
    }

    if (imagePaths.length === 0) {
      throw new Error('All scene images failed to generate — cannot create video');
    }

    // Log how many scenes we actually got
    console.log(`     → ${imagePaths.length} of ${scenes.length} scenes ready`);

    // 6. Remotion video render
    console.log('  6/8 Rendering professional video with Remotion...');
    const videoPath = join(tmpDir, 'final.mp4');
    await assembleVideoWithRemotion(imagePaths, audioPath, musicPath, videoPath, script, title);
    const videoSize = readFileSync(videoPath).byteLength;
    console.log(`     → ${(videoSize / (1024 * 1024)).toFixed(1)} MB`);

    // 7. Upload to Supabase Storage
    console.log('  7/8 Uploading to Supabase Storage...');
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

    // 8. Publish to TikTok
    console.log('  8/8 Publishing to TikTok...');
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
