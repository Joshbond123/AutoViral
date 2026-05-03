import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

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

// ─── API Key Helpers ──────────────────────────────────────────────────────────

async function getKey(service: string): Promise<string | null> {
  const { data } = await supabase
    .from('api_keys')
    .select('key_value, id')
    .eq('service', service)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  return data?.key_value ?? null;
}

async function incrementKeyUsage(service: string, success: boolean): Promise<void> {
  const { data } = await supabase
    .from('api_keys')
    .select('id, request_count, success_count, error_count')
    .eq('service', service)
    .eq('is_active', true)
    .limit(1)
    .single();
  if (!data) return;
  await supabase.from('api_keys').update({
    request_count: data.request_count + 1,
    success_count: success ? data.success_count + 1 : data.success_count,
    error_count: success ? data.error_count : data.error_count + 1,
    last_used_at: new Date().toISOString(),
  }).eq('id', data.id);
}

// ─── TopicShield™ ─────────────────────────────────────────────────────────────

async function pickUniqueTopic(niche: string, cerebrasKey: string): Promise<string> {
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

  const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cerebrasKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-4-scout-17b-16e-instruct',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  await incrementKeyUsage('cerebras', resp.ok);
  if (!resp.ok) throw new Error(`Cerebras topic error: ${resp.status} ${await resp.text()}`);
  const json = await resp.json() as any;
  const topic = (json.choices?.[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
  return topic || `${niche} - ${new Date().toLocaleDateString()}`;
}

// ─── Script Generation ────────────────────────────────────────────────────────

interface ScriptResult {
  title: string;
  script: string;
  scenes: string[];
}

async function generateScript(topic: string, niche: string, cerebrasKey: string): Promise<ScriptResult> {
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
  "title": "Eye-catching TikTok title under 90 chars",
  "script": "Full voiceover script as single paragraph, natural speech",
  "scenes": [
    "Scene 1 image prompt: detailed visual description for AI image gen",
    "Scene 2 image prompt: ...",
    "Scene 3 image prompt: ...",
    "Scene 4 image prompt: ...",
    "Scene 5 image prompt: ..."
  ]
}`;

  const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cerebrasKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-4-scout-17b-16e-instruct',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  await incrementKeyUsage('cerebras', resp.ok);
  if (!resp.ok) throw new Error(`Cerebras script error: ${resp.status} ${await resp.text()}`);
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
          : [`${topic} crypto scam dramatic warning visual, dark background, news graphic style, 9:16 vertical`],
      };
    }
  } catch { /* fall through */ }

  return {
    title: topic.slice(0, 150),
    script: content,
    scenes: [`${topic} crypto scam warning, dramatic dark visuals, red warning colors, 9:16 vertical format`],
  };
}

// ─── Voiceover ────────────────────────────────────────────────────────────────

async function generateVoiceover(script: string, unrealKey: string): Promise<Buffer> {
  const cleanScript = script.replace(/[*_~`#\[\]]/g, '').slice(0, 3000);
  const resp = await fetch('https://api.v6.unrealspeech.com/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${unrealKey}`, 'Content-Type': 'application/json' },
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

  await incrementKeyUsage('unrealspeech', resp.ok);
  if (!resp.ok) throw new Error(`UnrealSpeech error: ${resp.status} ${await resp.text()}`);
  const buf = await resp.arrayBuffer();
  return Buffer.from(buf);
}

// ─── Image Generation ─────────────────────────────────────────────────────────

async function generateImage(sceneDesc: string, cfAccountId: string, cfToken: string, index: number): Promise<Buffer> {
  const model = '@cf/black-forest-labs/flux-1-schnell';
  const prompt = `${sceneDesc}. Vertical 9:16 format, cinematic, dark dramatic atmosphere, professional news-style graphic, no text overlays, high quality.`;

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, num_steps: 4 }),
    }
  );

  await incrementKeyUsage('cloudflare', resp.ok);
  if (!resp.ok) throw new Error(`Cloudflare image error (scene ${index + 1}): ${resp.status} ${await resp.text()}`);

  const contentType = resp.headers.get('content-type') ?? '';
  if (contentType.includes('image/')) {
    return Buffer.from(await resp.arrayBuffer());
  }

  const json = await resp.json() as any;
  if (json?.result?.image) {
    return Buffer.from(json.result.image, 'base64');
  }

  throw new Error(`Unexpected Cloudflare response format for scene ${index + 1}`);
}

// ─── Video Assembly ───────────────────────────────────────────────────────────

function assembleVideo(imagePaths: string[], audioPath: string, outputPath: string, script: string): void {
  const audioDuration = (() => {
    try {
      const out = execSync(
        `ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv=p=0`,
        { encoding: 'utf8' }
      ).trim();
      return Math.max(parseFloat(out) || 45, 10);
    } catch { return 45; }
  })();

  console.log(`  Audio duration: ${audioDuration.toFixed(1)}s`);
  const segDuration = audioDuration / imagePaths.length;

  // Concat file for images
  const concatContent = imagePaths
    .map((p, i) => `file '${p}'\nduration ${i < imagePaths.length - 1 ? segDuration : segDuration + 0.1}`)
    .join('\n') + `\nfile '${imagePaths[imagePaths.length - 1]}'`;
  const concatPath = join(tmpdir(), 'av_concat.txt');
  writeFileSync(concatPath, concatContent);

  // SRT subtitles — split script into chunks
  const words = script.replace(/\s+/g, ' ').trim().split(' ');
  const numChunks = Math.min(Math.floor(audioDuration / 4), 20);
  const chunkSize = Math.ceil(words.length / Math.max(numChunks, 1));
  const srtLines: string[] = [];
  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  for (let i = 0; i < numChunks; i++) {
    const chunk = words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ');
    if (!chunk) break;
    const tStart = (audioDuration / numChunks) * i;
    const tEnd = (audioDuration / numChunks) * (i + 1);
    srtLines.push(`${i + 1}\n${fmtTime(tStart)} --> ${fmtTime(tEnd)}\n${chunk}`);
  }
  const srtPath = join(tmpdir(), 'av_subtitles.srt');
  writeFileSync(srtPath, srtLines.join('\n\n'));

  // FFmpeg command — 9:16 video with subtitles
  const fontFile = existsSync('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf')
    ? '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
    : 'LiberationSans-Bold';

  const filterComplex = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,`,
    `crop=1080:1920,setsar=1,fps=30[vscaled];`,
    `[vscaled]subtitles=${srtPath}:force_style=`,
    `'FontName=${fontFile},FontSize=48,Bold=1,`,
    `PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,`,
    `BackColour=&H80000000,Outline=2,Shadow=1,`,
    `Alignment=2,MarginV=120,WrapStyle=0'[vout]`,
  ].join('');

  const cmd = [
    'ffmpeg -y -loglevel warning',
    `-f concat -safe 0 -i "${concatPath}"`,
    `-i "${audioPath}"`,
    `-filter_complex "${filterComplex}"`,
    `-map "[vout]" -map 1:a`,
    `-c:v libx264 -preset fast -crf 23 -profile:v high`,
    `-c:a aac -b:a 192k`,
    `-shortest -movflags +faststart`,
    `-t ${audioDuration + 0.5}`,
    `"${outputPath}"`,
  ].join(' ');

  console.log('  Running FFmpeg...');
  execSync(cmd, { stdio: 'inherit' });
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

async function runPipeline(schedule: any, keys: { cerebras: string; cloudflare: string; cloudflare_id: string; unrealspeech: string }): Promise<void> {
  const startTime = Date.now();
  const tmpDir = join(tmpdir(), `autoviral_${schedule.id.slice(0, 8)}`);
  mkdirSync(tmpDir, { recursive: true });

  console.log(`\n▶ Schedule ${schedule.id.slice(0, 8)} | niche: ${schedule.niche}`);

  await supabase.from('schedules').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
  }).eq('id', schedule.id);

  const { data: postRow } = await supabase.from('posts').insert({
    user_id: schedule.user_id,
    schedule_id: schedule.id,
    niche: schedule.niche === 'AUTO'
      ? NICHES[Math.floor(Math.random() * NICHES.length)]
      : schedule.niche,
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
      scheduled_time: new Date(new Date(schedule.scheduled_time).getTime() + 86400000).toISOString(),
    }).eq('id', schedule.id);
  };

  try {
    const niche = schedule.niche === 'AUTO'
      ? NICHES[Math.floor(Math.random() * NICHES.length)]
      : schedule.niche;

    // 1. Topic research (TopicShield)
    console.log('  1/7 Researching unique topic...');
    const topic = await pickUniqueTopic(niche, keys.cerebras);
    console.log(`     → "${topic}"`);

    await supabase.from('topic_history').upsert({
      niche,
      topic_title: topic,
      topic_hash: Buffer.from(topic.toLowerCase().replace(/\s+/g, '_')).toString('base64').slice(0, 64),
    }).then(() => {}).catch(() => {});

    if (postId) await supabase.from('posts').update({ topic, niche }).eq('id', postId);

    // 2. Script generation
    console.log('  2/7 Generating viral script...');
    const { title, script, scenes } = await generateScript(topic, niche, keys.cerebras);
    console.log(`     → "${title}"`);

    if (postId) await supabase.from('posts').update({ title, script }).eq('id', postId);

    // 3. Voiceover
    console.log('  3/7 Generating voiceover...');
    const audioBuffer = await generateVoiceover(script, keys.unrealspeech);
    const audioPath = join(tmpDir, 'voice.mp3');
    writeFileSync(audioPath, audioBuffer);
    console.log(`     → ${(audioBuffer.byteLength / 1024).toFixed(0)} KB`);

    // 4. Scene images
    console.log('  4/7 Generating scene images...');
    const imagePaths: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      try {
        const imgBuf = await generateImage(scenes[i], keys.cloudflare_id, keys.cloudflare, i);
        const imgPath = join(tmpDir, `scene_${i}.jpg`);
        writeFileSync(imgPath, imgBuf);
        imagePaths.push(imgPath);
        console.log(`     → Scene ${i + 1}: ${(imgBuf.byteLength / 1024).toFixed(0)} KB`);
      } catch (e: any) {
        console.warn(`     ⚠ Scene ${i + 1} failed: ${e.message} — using placeholder`);
        // Create a fallback solid color placeholder using ImageMagick if available
        try {
          const placeholderPath = join(tmpDir, `scene_${i}.jpg`);
          execSync(`convert -size 1080x1920 xc:#1a1a2e "${placeholderPath}" 2>/dev/null || ffmpeg -y -f lavfi -i color=c=0x1a1a2e:size=1080x1920:rate=1 -frames:v 1 "${placeholderPath}"`);
          imagePaths.push(placeholderPath);
        } catch { /* ignore */ }
      }
    }

    if (imagePaths.length === 0) throw new Error('All scene images failed to generate');

    // 5. Assemble video
    console.log('  5/7 Assembling video with FFmpeg...');
    const videoPath = join(tmpDir, 'final.mp4');
    assembleVideo(imagePaths, audioPath, videoPath, script);
    const videoStat = readFileSync(videoPath);
    console.log(`     → ${(videoStat.byteLength / (1024 * 1024)).toFixed(1)} MB`);

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
      publishError = 'No TikTok access token — video saved to storage';
      console.log(`     ⚠ No access token, video stored at: ${videoUrl}`);
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
      // Advance to same time tomorrow
      scheduled_time: new Date(new Date(schedule.scheduled_time).getTime() + 86400000).toISOString(),
    }).eq('id', schedule.id);

    console.log(`  ✅ Done in ${(elapsed / 1000).toFixed(1)}s — status: ${publishId ? 'published' : 'rendered'}`);

  } catch (err: any) {
    await failSchedule(err.message ?? String(err));
  } finally {
    try { execSync(`rm -rf "${tmpDir}"`); } catch { /* ignore */ }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🚀 AutoViral Pipeline — ' + new Date().toISOString());

  const [cerebras, cloudflare, cloudflare_id, unrealspeech] = await Promise.all([
    getKey('cerebras'),
    getKey('cloudflare'),
    getKey('cloudflare_id'),
    getKey('unrealspeech'),
  ]);

  const missing: string[] = [];
  if (!cerebras) missing.push('cerebras');
  if (!cloudflare) missing.push('cloudflare (API token)');
  if (!cloudflare_id) missing.push('cloudflare_id (Account ID)');
  if (!unrealspeech) missing.push('unrealspeech');

  if (missing.length > 0) {
    console.error(`❌ Missing API keys in Supabase: ${missing.join(', ')}`);
    console.error('   → Add them via the Settings page in the AutoViral dashboard.');
    process.exit(1);
  }

  const keys = { cerebras: cerebras!, cloudflare: cloudflare!, cloudflare_id: cloudflare_id!, unrealspeech: unrealspeech! };

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
    await runPipeline(schedule, keys);
  }

  console.log('\n✅ All pipelines complete!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
