import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync } from 'fs';
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

const BACKGROUND_MUSIC_TRACKS = [
  // Dark / thriller — high impact
  'https://assets.mixkit.co/music/preview/mixkit-dramatic-mystery-trailer-599.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-dark-suspense-tension-583.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-cinematic-tension-pulsing-521.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-news-big-moment-574.mp3',
  // Epic / cinematic
  'https://assets.mixkit.co/music/preview/mixkit-epic-orchestra-736.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-inspiring-cinematic-documentary-120.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-adventure-awaits-471.mp3',
  // Urban / modern
  'https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-hip-hop-02-738.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
  // Emotional / documentary
  'https://assets.mixkit.co/music/preview/mixkit-piano-reflections-22.mp3',
  'https://assets.mixkit.co/music/preview/mixkit-life-is-a-dream-837.mp3',
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
        const isRateLimit = /429|rate.?limit|too.?many|quota|exceeded|high.?traffic|neurons|daily.*alloc/i.test(e.message ?? '');
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

// ─── TopicShield ──────────────────────────────────────────────────────────────

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
  const prompt = `You are a viral TikTok content creator for crypto scam awareness.

Topic: "${topic}"
Niche: ${niche}

Write a complete TikTok video package. Follow every rule exactly.

VOICEOVER RULES (the "script" field):
- Pure natural spoken words only — exactly what the narrator says out loud to the camera
- Start with a shocking hook (alarming question or fact) in the very first sentence
- 130-160 words total (50-60 seconds when spoken at a normal pace)
- Direct, personal — use "you", "your", speak to the viewer
- IMPORTANT: End with EXACTLY these two sentences: "If you have been a victim of a crypto scam, send us a direct message on TikTok right now. We may be able to help you recover your funds. Follow for daily crypto scam warnings."
- FORBIDDEN in the script field: emojis, [brackets], (parenthetical stage directions), "Scene:", "Script:", "Narrator:", "Voiceover:", section labels, timestamps, asterisks, or any non-spoken text
- Write as ONE continuous paragraph of spoken words — no line breaks, no sections

SCENE RULES (the "scenes" array):
- Exactly 5 scenes
- Each is a pure VISUAL description for an AI image generator — describe only what is SEEN
- NO text, NO words, NO letters, NO numbers anywhere in any scene description
- NO "Scene 1:" prefix or any labels — just the visual description directly
- Portrait 9:16 cinematic style, dark dramatic atmosphere

Return ONLY valid JSON with no markdown fences, no explanation, nothing else:
{
  "title": "Viral TikTok title, under 80 characters, no emojis",
  "script": "Pure spoken voiceover paragraph — no labels or directions",
  "scenes": [
    "A hooded figure hunched over glowing monitors in a dark room, blue neon light, cinematic portrait",
    "A close-up of a person's devastated face illuminated by a phone screen, dramatic dark lighting",
    "Golden coins dissolving into shadow, slow motion, dark cinematic atmosphere, vertical portrait",
    "Two silhouetted figures exchanging something in a dimly lit alley, suspicious, cinematic",
    "An empty wallet and a cracked phone screen lying on a dark table, dramatic low lighting"
  ]
}`;

  return tryWithKeys('cerebras', async (key) => {
    const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-3-235b-a22b-instruct-2507',
        max_tokens: 2000,
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
        const defaultScenes = [
          `${topic} — shadowy hacker figure at multiple monitors, dark dramatic lighting, cinematic vertical`,
          `${topic} — crashing red stock charts on screen, person looking shocked, dark office environment`,
          `${topic} — pile of Bitcoin and dollar bills vanishing, dramatic dark atmosphere, cinematic`,
          `${topic} — anonymous hooded figure in dimly lit room, suspicious activity, blue neon lighting`,
          `${topic} — glowing warning signs and digital lock icons, dark background, dramatic cinematic`,
        ];
        const scenes = rawScenes.length >= 5 ? rawScenes.slice(0, 5) : [...rawScenes, ...defaultScenes.slice(rawScenes.length)];
        let _scriptText = '';
        if (
          typeof parsed.script === 'string' &&
          parsed.script.trim().length >= 60 &&
          !parsed.script.includes('{') &&
          !parsed.script.includes('"scenes"') &&
          !/^(Scene|Voiceover|Script|Title|Narrator)\s*\d*\s*:/im.test(parsed.script)
        ) {
          _scriptText = parsed.script.trim();
        } else {
          const _candidates = content.split(/\n+/).map((l: string) => l.trim()).filter((l: string) =>
            l.length > 60 && !l.startsWith('"') && !l.includes('://') &&
            !l.includes('{') && !/{\s*"/.test(l) && !/^(Scene|Title|Narrator)\s*[:\d]/i.test(l)
          );
          _scriptText = _candidates.sort((a: string, b: string) => b.length - a.length)[0]
            || `This crypto scam has already stolen millions. Stay alert and never trust unverified investment promises. If you have been a victim of a crypto scam, send us a direct message on TikTok right now. We may be able to help you recover your funds. Follow for daily crypto scam warnings.`;
        }
        return { title: (parsed.title || topic).slice(0, 150), script: _scriptText, scenes };
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

// ─── Caption Generation ───────────────────────────────────────────────────────

interface CaptionResult {
  caption: string;
  hashtags: string;
}

async function generateCaptionAndHashtags(topic: string, niche: string, title: string, script: string): Promise<CaptionResult> {
  const scriptPreview = script.slice(0, 250);
  const prompt = `You are a viral TikTok content strategist specializing in crypto scam awareness content.

Create a viral TikTok caption and hashtag set for this video:
Title: "${title}"
Topic: "${topic}"
Niche: "${niche}"
Script preview: "${scriptPreview}..."

CAPTION RULES:
- Maximum 150 characters
- Start with a powerful hook (shocking stat, question, or statement)
- Include urgency and emotional pull
- End with a strong CTA ("Follow for more", "Share to warn others", "Save this")
- No emojis
- Pure text, highly engaging

HASHTAG RULES:
- Exactly 12 hashtags
- Mix of: high-volume TikTok tags, niche-specific tags, and trending crypto/scam awareness tags
- Include: #cryptoscam #cryptowarning #scamalert and relevant niche tags
- Format: space-separated on one line

Return ONLY valid JSON, no markdown, no explanation:
{
  "caption": "your caption here",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5 #tag6 #tag7 #tag8 #tag9 #tag10 #tag11 #tag12"
}`;

  try {
    return await tryWithKeys('cerebras', async (key) => {
      const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen-3-235b-a22b-instruct-2507',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!resp.ok) throw new Error(`Cerebras caption ${resp.status}: ${await resp.text()}`);
      const json = await resp.json() as any;
      const content = (json.choices?.[0]?.message?.content ?? '').trim();
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          caption: (parsed.caption || `${title} - This crypto scam could steal everything from you. Share to protect others. Follow for daily crypto scam warnings.`).slice(0, 150),
          hashtags: parsed.hashtags || '#cryptoscam #cryptowarning #scamalert #cryptoeducation #cryptosafety #bitcoinscam #cryptofraud #scamexposed #cryptonews #digitalcrime #onlinescam #protectyourself',
        };
      }
      throw new Error('No JSON in response');
    });
  } catch (e: any) {
    console.warn(`  ⚠ Caption generation failed: ${e.message} — using defaults`);
    return {
      caption: `${title.slice(0, 100)} - This crypto scam has already stolen millions. Share to warn others. Follow for daily crypto scam warnings.`,
      hashtags: '#cryptoscam #cryptowarning #scamalert #cryptoeducation #cryptosafety #bitcoinscam #cryptofraud #scamexposed #cryptonews #digitalcrime #onlinescam #protectyourself',
    };
  }
}

// ─── Script Cleaner ───────────────────────────────────────────────────────────

function cleanVoiceoverScript(raw: string): string {
  const IMAGE_KW = /\b(cinematic|portrait|photorealistic|9:16|aspect ratio|vertical orientation|dramatic atmosphere|neon lighting|hyperrealistic|full-frame|dark background|cinematography)\b/i;

  let text = raw
    .replace(/```[\s\S]*?```/gm, '')
    .replace(/^\s*"(?:title|script|scenes|niche|topic|hook|cta|outro)"\s*:.*/gim, '')
    .replace(/^\s*[\[\]{}]\s*$/gm, '')
    .replace(/\[[^\]]{0,300}\]/g, '')
    .replace(/\((?![a-zA-Z]'[a-zA-Z])[^)]{0,200}\)/gi, '')
    .replace(/^(scene|script|voiceover|narrator|note|hook|cta|body|intro|outro|title|image\s*prompt|visual|description|caption)\s*[\d:.\-]*.*/gim, '')
    .replace(/^scene\s*\d+[:.\-].*/gim, '')
    .replace(/[*_~`#@]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 40);
  const speech = paragraphs.filter(p =>
    p.split(/\s+/).length >= 12 &&
    !/^[A-Z][a-zA-Z ]+:/.test(p) &&
    !IMAGE_KW.test(p) &&
    !/[{}"\[\]]/.test(p)
  );

  if (speech.length > 0) {
    return speech.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 3000);
  }
  return text.slice(0, 3000) || 'This crypto scam is destroying lives. Stay informed. If you have been a victim of a crypto scam, send us a direct message on TikTok right now. We may be able to help you recover your funds. Follow for daily crypto scam warnings.';
}

// ─── Voiceover + Real Timestamps (UnrealSpeech /synthesisTasks) ──────────────

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface VoiceoverResult {
  audioBuffer: Buffer;
  wordTimestamps: WordTimestamp[] | null;
}

/**
 * Generates voiceover and retrieves real word-level timestamps in one call
 * via UnrealSpeech /synthesisTasks (async, polls until complete).
 * API: POST /synthesisTasks → { SynthesisTask: { OutputUri, TimestampsUri, TaskId, TaskStatus } }
 * Timestamps JSON: [{ word, start, end, text_offset }, ...]
 */
async function generateVoiceoverWithTimestamps(script: string): Promise<VoiceoverResult> {
  const cleanScript = cleanVoiceoverScript(script);

  return tryWithKeys('unrealspeech', async (key) => {
    const initResp = await fetch('https://api.v6.unrealspeech.com/synthesisTasks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Text: cleanScript,
        VoiceId: 'Will',
        Bitrate: '192k',
        TimestampType: 'word',
      }),
    });
    if (!initResp.ok) throw new Error(`UnrealSpeech synthesisTasks ${initResp.status}: ${await initResp.text()}`);
    const initJson = await initResp.json() as any;
    const task = initJson.SynthesisTask ?? initJson;
    const taskId = task.TaskId;
    if (!taskId) throw new Error(`UnrealSpeech: no TaskId in response — ${JSON.stringify(initJson).slice(0, 200)}`);

    let outputUri: string = task.OutputUri ?? '';
    let timestampsUri: string = task.TimestampsUri ?? '';
    let taskStatus: string = task.TaskStatus ?? 'scheduled';

    const MAX_POLLS = 30;
    for (let i = 0; i < MAX_POLLS && taskStatus !== 'completed'; i++) {
      await new Promise(res => setTimeout(res, 3000));
      const pollResp = await fetch(`https://api.v6.unrealspeech.com/synthesisTasks/${taskId}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!pollResp.ok) continue;
      const pollJson = await pollResp.json() as any;
      const pollTask = pollJson.SynthesisTask ?? pollJson;
      taskStatus = pollTask.TaskStatus ?? taskStatus;
      if (pollTask.OutputUri) outputUri = pollTask.OutputUri;
      if (pollTask.TimestampsUri) timestampsUri = pollTask.TimestampsUri;
    }

    if (!outputUri) throw new Error(`UnrealSpeech: synthesis task never completed (TaskId: ${taskId})`);

    console.log(`     → Downloading audio from S3...`);
    const audioResp = await fetch(outputUri, { signal: AbortSignal.timeout(30000) });
    if (!audioResp.ok) throw new Error(`S3 audio download failed: ${audioResp.status}`);
    const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
    if (audioBuffer.byteLength < 1000) throw new Error(`UnrealSpeech S3 audio empty (${audioBuffer.byteLength} bytes)`);

    let wordTimestamps: WordTimestamp[] | null = null;
    if (timestampsUri) {
      try {
        const tsResp = await fetch(timestampsUri, { signal: AbortSignal.timeout(15000) });
        if (tsResp.ok) {
          const tsData = await tsResp.json() as any;
          const raw: Array<any> = Array.isArray(tsData) ? tsData : (tsData.words ?? []);
          const parsed = raw.map((w: any) => ({
            word: String(w.word || w.text || '').replace(/[.,!?;:]/g, '').trim(),
            start: Number(w.start ?? 0),
            end: Number(w.end ?? 0),
          })).filter((w: WordTimestamp) => w.word.length > 0 && w.end > w.start);
          if (parsed.length > 0) {
            wordTimestamps = parsed;
            console.log(`     → Real timestamps: ${parsed.length} words ✓ (first: "${parsed[0].word}" @ ${parsed[0].start.toFixed(2)}s)`);
          }
        }
      } catch (tsErr: any) {
        console.warn(`     ⚠ Timestamp download failed: ${tsErr.message.slice(0, 60)} — using heuristic`);
      }
    }

    return { audioBuffer, wordTimestamps };
  });
}

// ─── Build Subtitle Timings From Word Timestamps ──────────────────────────────

function buildSubtitleTimingsFromWords(
  words: WordTimestamp[],
  fps: number,
  chunkSize: number = 1,
): Array<{ text: string; startFrame: number; endFrame: number }> {
  const timings: Array<{ text: string; startFrame: number; endFrame: number }> = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const text = chunk.map(w => w.word).join(' ').toUpperCase();
    const startFrame = Math.round(chunk[0].start * fps);
    const endFrame = Math.round(chunk[chunk.length - 1].end * fps);
    if (endFrame > startFrame) {
      timings.push({ text, startFrame, endFrame });
    }
  }
  return timings;
}

// ─── Image Generation ──────────────────────────────────────────────────────────

async function generateImage(sceneDesc: string, index: number): Promise<Buffer> {
  const cleanDesc = sceneDesc.replace(/[Ss]cene\s+\d+[:\-]?\s*/g, '').replace(/\[.*?\]/g, '').trim();
  const prompt = [
    cleanDesc,
    'Portrait orientation 9:16 vertical aspect ratio, full-frame single image, cinematic dark dramatic atmosphere, professional photography, photorealistic.',
    'STRICT: absolutely NO text, NO words, NO letters, NO numbers, NO captions, NO subtitles, NO watermarks, NO labels, NO signs, NO titles anywhere in the image — pure visual only.',
    'Do NOT split into panels or multiple images. Single full-frame portrait scene only.',
    'Do NOT include any writing, typography, or overlaid text of any kind.',
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
        body: JSON.stringify({ prompt, num_steps: 16 }),
      }
    );
    if (!resp.ok) throw new Error(`Cloudflare image (scene ${index + 1}) ${resp.status}: ${await resp.text()}`);

    const ct = resp.headers.get('content-type') ?? '';
    if (ct.includes('image/')) {
      return cropToPortrait(Buffer.from(await resp.arrayBuffer()));
    }
    const json = await resp.json() as any;
    if (json?.result?.image) {
      return cropToPortrait(Buffer.from(json.result.image, 'base64'));
    }
    throw new Error(`Unexpected Cloudflare response for scene ${index + 1}`);
  });
}

async function cropToPortrait(imgBuf: Buffer): Promise<Buffer> {
  try {
    const tmpIn = join(tmpdir(), `img_in_${Date.now()}.jpg`);
    const tmpOut = join(tmpdir(), `img_out_${Date.now()}.jpg`);
    writeFileSync(tmpIn, imgBuf);
    execSync(`convert "${tmpIn}" -resize 1080x1920^ -gravity Center -extent 1080x1920 "${tmpOut}"`, { timeout: 15000 });
    const out = readFileSync(tmpOut);
    try { execSync(`rm -f "${tmpIn}" "${tmpOut}"`); } catch { /* ignore */ }
    return out;
  } catch {
    return imgBuf;
  }
}

// ─── Background Music ──────────────────────────────────────────────────────────

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
      console.warn(`     ⚠ Music file too small — skipping`);
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
  wordTimestamps: WordTimestamp[] | null,
): Promise<void> {
  const { bundle } = await import('@remotion/bundler') as any;
  const { renderMedia, selectComposition, ensureBrowser } = await import('@remotion/renderer') as any;

  const FPS = 30;
  const OUTRO_SEC = 5.0;

  const audioBytes = readFileSync(audioPath).byteLength;
  const hasAudio = audioBytes > 1000;
  let audioDurationSec = 40;

  if (hasAudio) {
    try {
      const ffOut = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`,
        { timeout: 12000 }
      ).toString().trim();
      const probed = parseFloat(ffOut);
      if (isFinite(probed) && probed > 3) {
        audioDurationSec = probed;
        console.log(`  Audio duration (ffprobe): ${audioDurationSec.toFixed(2)}s`);
      } else {
        throw new Error('ffprobe returned invalid value');
      }
    } catch {
      audioDurationSec = Math.max((audioBytes * 8) / (192 * 1000), 20);
      console.log(`  Audio duration (estimated): ${audioDurationSec.toFixed(2)}s`);
    }
  }

  const totalSec = Math.min(audioDurationSec + OUTRO_SEC, 90);
  const durationInFrames = Math.ceil(totalSec * FPS);
  const audioDurationFrames = Math.round(audioDurationSec * FPS);
  console.log(`  Video: ${totalSec.toFixed(1)}s total → ${durationInFrames} frames (audio: ${audioDurationSec.toFixed(1)}s + ${OUTRO_SEC}s outro)`);

  // ── Build subtitle timings ────────────────────────────────────────────────
  const SUBTITLE_CHUNK = 1;
  const cleanedScript = cleanVoiceoverScript(script);
  let subtitleTimings: Array<{ text: string; startFrame: number; endFrame: number }> = [];

  if (wordTimestamps && wordTimestamps.length > 0) {
    subtitleTimings = buildSubtitleTimingsFromWords(wordTimestamps, FPS, SUBTITLE_CHUNK);
    console.log(`  Subtitle chunks: ${subtitleTimings.length} (real UnrealSpeech word timestamps ✓)`);
  } else {
    const WORDS_PER_SEC = 2.8;
    // 1-word-at-a-time heuristic for Will (male) voice
    const scriptWords = cleanedScript.split(/\s+/).filter(Boolean);
    for (let i = 0; i < scriptWords.length; i++) {
      const startSec = i / WORDS_PER_SEC;
      const endSec = (i + 1) / WORDS_PER_SEC;
      if (startSec >= audioDurationSec) break;
      subtitleTimings.push({
        text: scriptWords[i].toUpperCase(),
        startFrame: Math.round(startSec * FPS),
        endFrame: Math.min(Math.round(endSec * FPS), audioDurationFrames),
      });
    }
    const lastT = subtitleTimings[subtitleTimings.length - 1];
    if (lastT && lastT.endFrame > audioDurationFrames) {
      const scale = audioDurationFrames / lastT.endFrame;
      for (const t of subtitleTimings) {
        t.startFrame = Math.round(t.startFrame * scale);
        t.endFrame   = Math.round(t.endFrame   * scale);
      }
    }
    console.log(`  Subtitle chunks: ${subtitleTimings.length} (heuristic 1-word fallback — timestamps unavailable)`);
  }

  console.log('  Converting assets to data URLs...');

  const scenes = imagePaths.map(p => {
    const data = readFileSync(p).toString('base64');
    return `data:image/jpeg;base64,${data}`;
  });
  console.log(`  → ${scenes.length} scene(s) loaded`);

  const audioSrc = hasAudio
    ? `data:audio/mpeg;base64,${readFileSync(audioPath).toString('base64')}`
    : '';
  if (!hasAudio) console.warn('  ⚠ Audio file empty — rendering without voiceover');

  let musicSrc = '';
  if (musicPath) {
    try {
      const musicData = readFileSync(musicPath).toString('base64');
      musicSrc = `data:audio/mpeg;base64,${musicData}`;
      console.log('  → Background music loaded');
    } catch { /* skip music if it fails */ }
  }

  const inputProps = {
    scenes,
    audioSrc,
    musicSrc,
    script: cleanedScript,
    title,
    durationInFrames,
    subtitleTimings,
    audioDurationFrames,
  };

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
    timeoutInMilliseconds: 18 * 60 * 1000,
    chromiumOptions: { disableWebSecurity: true },
    onProgress: ({ renderedFrames }: any) => {
      if (renderedFrames % 150 === 0 || renderedFrames === durationInFrames) {
        const pct = ((renderedFrames / durationInFrames) * 100).toFixed(0);
        console.log(`    ↳ ${renderedFrames}/${durationInFrames} frames (${pct}%)`);
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

    // 3. Voiceover + real word timestamps via UnrealSpeech /synthesisTasks
    console.log('  3/8 Generating voiceover + real timestamps (UnrealSpeech)...');
    const { audioBuffer, wordTimestamps } = await generateVoiceoverWithTimestamps(script);
    const audioPath = join(tmpDir, 'voice.mp3');
    writeFileSync(audioPath, audioBuffer);
    console.log(`     → ${(audioBuffer.byteLength / 1024).toFixed(0)} KB audio`);

    // 4. Background music
    console.log('  4/8 Downloading background music...');
    const musicPath = await downloadBackgroundMusic(tmpDir);

    // 5. Caption & hashtags
    console.log('  5/8 Generating viral caption and hashtags...');
    const { caption, hashtags } = await generateCaptionAndHashtags(topic, niche, title, script);
    console.log(`     → Caption: "${caption.slice(0, 60)}..."`);
    console.log(`     → Hashtags: ${hashtags.split(' ').length} tags`);
    if (postId) await supabase.from('posts').update({ caption, hashtags }).eq('id', postId);

    // 6. Scene images — all 5 in parallel
    console.log(`  6/8 Generating ${scenes.length} scene images (Cloudflare AI)...`);
    const _imgResults = await Promise.allSettled(
      scenes.map((scene, i) => generateImage(scene, i))
    );
    const imagePaths: string[] = [];
    for (let i = 0; i < _imgResults.length; i++) {
      const res = _imgResults[i];
      if (res.status === 'fulfilled') {
        const imgPath = join(tmpDir, `scene_${i}.jpg`);
        writeFileSync(imgPath, res.value);
        imagePaths.push(imgPath);
        console.log(`     → Scene ${i + 1}/${scenes.length}: ${(res.value.byteLength / 1024).toFixed(0)} KB ✓`);
      } else {
        console.warn(`     ⚠ Scene ${i + 1} failed — using dark fallback`);
        const pp = join(tmpDir, `scene_${i}.jpg`);
        try {
          execSync(`convert -size 1080x1920 "xc:#0d0d1a" "${pp}" 2>/dev/null || true`);
          if (existsSync(pp) && statSync(pp).size > 100) imagePaths.push(pp);
        } catch { /* skip */ }
      }
    }
    if (imagePaths.length === 0) {
      throw new Error('All scene images failed to generate — cannot create video');
    }
    console.log(`     → ${imagePaths.length} of ${scenes.length} scenes ready`);

    // 7. Remotion video render
    console.log('  7/8 Rendering professional video with Remotion...');
    const videoPath = join(tmpDir, 'final.mp4');
    await assembleVideoWithRemotion(imagePaths, audioPath, musicPath, videoPath, script, title, wordTimestamps);
    let _rawSize = readFileSync(videoPath).byteLength;
    console.log(`     → Raw: ${(_rawSize / 1024 / 1024).toFixed(1)} MB — compressing...`);
    try {
      const _cPath = videoPath.replace('.mp4', '_opt.mp4');
      execSync(`ffmpeg -i "${videoPath}" -c:v libx264 -crf 26 -preset medium -c:a aac -b:a 128k -movflags +faststart -y "${_cPath}" 2>/dev/null`, { timeout: 300000 });
      const _cSize = readFileSync(_cPath).byteLength;
      console.log(`     → Optimized: ${(_cSize/1024/1024).toFixed(1)} MB (${Math.round((1-_cSize/_rawSize)*100)}% smaller)`);
      execSync(`mv "${_cPath}" "${videoPath}"`);
    } catch (_ce: any) { console.warn(`     ⚠ Compression skipped: ${_ce.message?.slice(0,60)}`); }
    const videoSize = readFileSync(videoPath).byteLength;
    console.log(`     → Final: ${(videoSize/1024/1024).toFixed(1)} MB`);

    // 8. Upload to Supabase Storage
    console.log('  8/8 Uploading to Supabase Storage...');
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

    // 9. Publish to TikTok
    console.log('  Publishing to TikTok...');
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
