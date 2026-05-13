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
  // SoundHelix — public domain, no auth required, reliable CDN
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-17.mp3',
];

// ─── Key Rotation ─────────────────────────────────────────────────────────────

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
          const delay = attempt === 1 ? 15000 : 60000;
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

// ─── Cerebras Multi-Model Chat (rate-limit resilient) ─────────────────────────

const CEREBRAS_MODELS = [
  'qwen-3-235b-a22b-instruct-2507',
  'qwen-3-32b',
  'llama3.3-70b',
];

async function cerebrasChat(
  key: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Promise<string> {
  let lastErr: Error | null = null;
  for (const model of CEREBRAS_MODELS) {
    try {
      const resp = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        const err = new Error(`Cerebras (${model}) ${resp.status}: ${errText}`);
        if (resp.status === 429) { lastErr = err; await new Promise(r => setTimeout(r, 2000)); continue; }
        throw err;
      }
      const json = await resp.json() as any;
      return (json.choices?.[0]?.message?.content ?? '').trim();
    } catch (e: any) {
      if (/429|rate.?limit|too.?many|quota|exceeded/.test(e.message ?? '')) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error('All Cerebras models exhausted');
}

// ─── Topic & Script ───────────────────────────────────────────────────────────

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

  const prompt = `You are a TikTok investigative journalist covering crypto scam awareness.
Generate ONE specific, viral topic title for the niche: "${niche}".

STRICT RULES:
- Write as a dramatic NEWS HEADLINE or WARNING STATEMENT — NOT first-person
- BANNED: "I", "me", "my", "I joined", "I lost", "I discovered", "I was scammed"
- GOOD examples: "Fake Bitcoin ETF Wiped Out $2.3M in 48 Hours", "How Mirror Trading Scams Drain Wallets in Minutes", "The Fake Crypto Group Stealing Millions From Investors"
- BAD examples: "I Lost My Savings to a Crypto Scam", "My Experience With a Fake Crypto Group"
- Dramatic, specific, educational — warns viewers about a real scam technique
AVOID these already-used topics: ${used.slice(0, 40).join(' | ')}
Return ONLY the topic title — nothing else, no quotes, no extra text.`;

  return tryWithKeys('cerebras', async (key) => {
    const rawTopic = await cerebrasChat(key, [{ role: 'user', content: prompt }], 80);
    const topic = rawTopic.replace(/^["']|["']$/g, '');
    return topic || `${niche} Warning — ${new Date().toLocaleDateString()}`;
  });
}

async function generateScript(topic: string, niche: string): Promise<ScriptResult> {
  const prompt = `You are a professional TikTok investigative journalist creating viral crypto scam awareness content.

Topic: "${topic}"
Niche: ${niche}

Write a complete TikTok video package. Follow every rule exactly.

VOICEOVER RULES (the "script" field):
- Pure natural spoken words only — exactly what the narrator says out loud
- Start with a shocking hook — a dramatic fact, statistic, or urgent warning question
- 130-160 words total (50-60 seconds when spoken at a normal pace)
- Tone: professional, urgent, journalistic — like an investigative news reporter
- Speak TO the viewer using "you" and "your" — warning and educating them
- CRITICAL: NEVER use first-person narration — BANNED words: "I", "I've", "I was", "I lost", "I joined", "me", "my", "we joined", "our wallet"
- The narrator is a journalist REPORTING on scams, NOT a victim telling their story
- Be factual, specific, dramatic — name the scam type, explain how it works, warn the viewer
- IMPORTANT: End with EXACTLY these three sentences: "If you have been a victim of a crypto scam, send us a direct message on TikTok right now. We may be able to help you recover your funds. Follow for daily crypto scam warnings."
- FORBIDDEN in the script field: emojis, [brackets], (parenthetical stage directions), "Scene:", "Script:", "Narrator:", "Voiceover:", section labels, timestamps, asterisks, or any non-spoken text
- Write as ONE continuous paragraph of spoken words — no line breaks, no sections

SCENE RULES (the "scenes" array):
- Exactly 5 scenes — each scene MUST visually represent the SPECIFIC PART of the script being narrated at that moment
- Scene 1 (script opening / shocking hook): Ultra-wide dramatic establishing shot that conveys the scale and shock of the scam
- Scene 2 (explaining the scam mechanism): Extreme close-up showing the exact deception method — hands, devices, screens in action
- Scene 3 (victim impact / human cost): Emotional medium shot — a real person's devastation, grief, or shock at financial loss
- Scene 4 (the perpetrators / criminal side): Low-angle menacing shot — anonymous threatening figure, hidden identity, surveillance feel
- Scene 5 (warning / closing CTA): High-angle or stark frontal symbolic shot — danger signal, vulnerability, urgent alarm
- CRITICAL: Every scene MUST use a completely different visual composition, angle, and color palette — NO two scenes may look alike:
  * Scene 1: ultra-wide angle, cold blue-teal environment, vast dark atmosphere
  * Scene 2: extreme close-up macro, warm amber-orange glow on screens or hands
  * Scene 3: medium shot, desaturated muted tones, soft dramatic rim lighting
  * Scene 4: low angle, deep crimson-red accent light, high contrast threatening shadows
  * Scene 5: overhead or stark frontal, bold red-orange warning palette, geometric composition
- Each scene description must be highly specific: exact subject, action, lighting angle, atmosphere, and unique visual detail
- Pure VISUAL description only — NO text, NO words, NO letters, NO numbers in any scene description
- NO "Scene 1:" prefix or labels — just the visual description directly
- Portrait 9:16 cinematic aspect ratio, photorealistic

Return ONLY valid JSON with no markdown fences, no explanation, nothing else:
{
  "title": "Viral TikTok warning title, under 80 characters, no emojis, no first-person",
  "script": "Pure spoken voiceover paragraph — journalistic, no first-person, no labels",
  "scenes": [
    "Ultra-wide shot of a massive dark server room with thousands of blinking lights stretching to the horizon, one lone figure hunched at a glowing terminal in the distance, cold blue-teal atmosphere",
    "Extreme close-up of trembling fingers scrolling a phone screen showing a crypto wallet draining in real time, warm amber backlight, shallow depth of field, sweat on fingertip",
    "Medium shot of a middle-aged person sitting alone at a kitchen table at night, head in hands, soft desaturated light, crumpled papers and empty coffee mug visible, emotional despair",
    "Low-angle shot looking up at a silhouetted hooded figure standing against a bank of glowing red monitors, crimson light casting harsh shadows upward, menacing and anonymous",
    "Overhead aerial shot looking straight down at an empty leather wallet lying open on black marble, single golden coin beside it, stark red-orange rim light, geometric and symbolic"
  ]
}`;

  return tryWithKeys('cerebras', async (key) => {
    const content = await cerebrasChat(key, [{ role: 'user', content: prompt }], 2000);

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

// ─── Caption & Hashtag Generation ─────────────────────────────────────────────

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
- Exactly 5 hashtags — no more, no less
- Focus EXCLUSIVELY on crypto scam awareness and fraud prevention
- Always include #cryptoscam and #crypto
- The remaining 3 must come from: #cryptofraud #scamalert #cryptoawareness #blockchainscam #cryptosafety #web3security #cryptowarning #investmentscam #cryptoscams #scamwatch #cryptofraudAlert #blockchainfraud #cryptoprotection
- Choose the 3 most relevant to this specific scam type
- Format: space-separated on one line, no duplicates

Return ONLY valid JSON, no markdown, no explanation:
{
  "caption": "your caption here",
  "hashtags": "#cryptoscam #crypto #scamalert #cryptoawareness #cryptofraud"
}`;

  try {
    return await tryWithKeys('cerebras', async (key) => {
      const content = await cerebrasChat(key, [{ role: 'user', content: prompt }], 400);

      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          caption: (parsed.caption || `${title} - This crypto scam could steal everything from you. Share to protect others. Follow for daily crypto scam warnings.`).slice(0, 150),
          hashtags: parsed.hashtags || '#cryptoscam #crypto #scamalert #cryptofraud #cryptoawareness',
        };
      }
      throw new Error('No JSON in response');
    });
  } catch (e: any) {
    console.warn(`  ⚠ Caption generation failed: ${e.message} — using defaults`);
    return {
      caption: `${title.slice(0, 100)} - This crypto scam has already stolen millions. Share to warn others. Follow for daily crypto scam warnings.`,
      hashtags: '#crypto #blockchain #bitcoin #ethereum #cryptonews',
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
 * Generates voiceover and retrieves real word-level timestamps in a single call
 * via UnrealSpeech /synthesisTasks endpoint (async, polls until complete).
 *
 * API: POST /synthesisTasks → { SynthesisTask: { OutputUri, TimestampsUri, TaskId, TaskStatus } }
 * Timestamps JSON: [{ word, start, end, text_offset }, ...]
 *
 * Falls back to /speech only if synthesisTasks fails.
 */
async function generateVoiceoverWithTimestamps(script: string): Promise<VoiceoverResult> {
  const cleanScript = cleanVoiceoverScript(script);

  return tryWithKeys('unrealspeech', async (key) => {
    // ── Step 1: Submit synthesis task ──────────────────────────────────────
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

    // ── Step 2: Poll until completed (max 90s) ────────────────────────────
    let outputUri: string = task.OutputUri ?? '';
    let timestampsUri: string = task.TimestampsUri ?? '';
    let taskStatus: string = task.TaskStatus ?? 'scheduled';

    const MAX_POLLS = 60;
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

    // ── Step 3: Download audio ────────────────────────────────────────────
    console.log(`     → Downloading audio from S3...`);
    const audioResp = await fetch(outputUri, { signal: AbortSignal.timeout(30000) });
    if (!audioResp.ok) throw new Error(`S3 audio download failed: ${audioResp.status}`);
    const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
    if (audioBuffer.byteLength < 1000) throw new Error(`UnrealSpeech S3 audio empty (${audioBuffer.byteLength} bytes)`);

    // ── Step 4: Download and parse timestamps ─────────────────────────────
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
  maxFrame?: number,
): Array<{ text: string; startFrame: number; endFrame: number }> {
  const timings: Array<{ text: string; startFrame: number; endFrame: number }> = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const text = chunk.map(w => w.word).join(' ').toUpperCase();
    const startFrame = Math.round(chunk[0].start * fps);
    let endFrame = Math.round(chunk[chunk.length - 1].end * fps);
    // Clamp to maxFrame so subtitles never bleed into the outro zone
    if (maxFrame !== undefined) endFrame = Math.min(endFrame, maxFrame);
    if (endFrame > startFrame) {
      timings.push({ text, startFrame, endFrame });
    }
  }
  return timings;
}

// ─── Image Generation ──────────────────────────────────────────────────────────

// Per-scene cinematic style — each index gets a fundamentally different look
const SCENE_CINEMATIC_STYLES = [
  'ultra-wide angle lens, vast dark environment, cold blue-teal color grade, extreme depth of field, large scale and distance',
  'extreme close-up macro shot, warm amber-orange glow, very shallow depth of field, fine texture visible, intimate and intense',
  'medium shot, desaturated muted gray tones, soft dramatic rim lighting from one side, human emotional weight, documentary style',
  'low-angle looking upward, deep crimson-red accent light casting harsh upward shadows, menacing and threatening perspective',
  'overhead bird-eye or stark frontal view, bold red-orange warning color palette, geometric and symbolic composition, graphic impact',
];

// Unique atmospheric variations injected per video to ensure no two videos look the same
const ATMOSPHERIC_VARIATIONS = [
  'volumetric light rays piercing through dense atmosphere',
  'dust particles visible drifting through frame in foreground',
  'steam or vapor curling through the scene background',
  'reflections visible in rain-slicked surface below',
  'subtle lens flare streak from extreme edge of frame',
  'fog bank rolling in from background distance',
  'overexposed highlights creating stark dramatic silhouette',
  'atmospheric haze softening deep background elements',
  'backlit rim-lighting creating sharp edge glow around subjects',
  'smoke trails drifting upward through beams of light',
  'condensation or breath visible in cold environment',
  'shallow water surface reflections in extreme foreground',
];

function buildImagePrompt(sceneDesc: string, index: number = 0, videoVariant: number = 0): string {
  const cleanDesc = sceneDesc.replace(/[Ss]cene\s+\d+[:\-]?\s*/g, '').replace(/\[.*?\]/g, '').trim();
  const styleModifier = SCENE_CINEMATIC_STYLES[index % SCENE_CINEMATIC_STYLES.length];
  const atmosphericDetail = ATMOSPHERIC_VARIATIONS[(index + videoVariant) % ATMOSPHERIC_VARIATIONS.length];
  return [
    cleanDesc,
    styleModifier + '.',
    `Atmospheric detail: ${atmosphericDetail}.`,
    'Portrait orientation 9:16 vertical aspect ratio, full-frame single image, professional cinematic photography, photorealistic, ultra high quality.',
    'STRICT: absolutely NO text, NO words, NO letters, NO numbers, NO captions, NO subtitles, NO watermarks, NO labels, NO signs, NO titles anywhere in the image — pure visual only.',
    'Do NOT split into panels or multiple images. Single full-frame portrait scene only.',
    'Do NOT include any writing, typography, or overlaid text of any kind.',
  ].join(' ');
}

async function generateImageWithCloudflare(sceneDesc: string, index: number, videoVariant: number = 0): Promise<Buffer> {
  const prompt = buildImagePrompt(sceneDesc, index, videoVariant);

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
        body: JSON.stringify({ prompt, num_steps: 28 }),
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

async function generateImageWithPollinations(sceneDesc: string, index: number, simplify = false, videoVariant: number = 0): Promise<Buffer> {
  const baseDesc = simplify ? sceneDesc.slice(0, 200) : sceneDesc;
  const prompt = simplify
    ? `${baseDesc} ${SCENE_CINEMATIC_STYLES[index % SCENE_CINEMATIC_STYLES.length]} portrait 9:16 photorealistic no text no words`
    : buildImagePrompt(baseDesc, index, videoVariant);
  // Incorporate videoVariant into seed so the same scene desc produces different images across videos
  const seed = (Math.floor(Math.random() * 899999) + 100000) ^ (videoVariant * 7919);
  const encodedPrompt = encodeURIComponent(prompt.slice(0, 1500));
  const urlBase = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&model=flux&nologo=true&seed=${seed}`;

  const { data: polKeyRows } = await supabase
    .from('api_keys')
    .select('id, key_value, request_count, success_count, error_count, status')
    .eq('service', 'pollinations')
    .eq('is_active', true)
    .neq('status', 'failed')
    .order('request_count', { ascending: true });

  const hasKeys = (polKeyRows ?? []).length > 0;

  if (hasKeys) {
    return tryWithKeys('pollinations', async (key) => {
      console.log(`     → Pollinations AI (key-auth): scene ${index + 1}...`);
      const resp = await fetch(urlBase, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(120000),
      });
      if (resp.status === 429) throw new Error(`Pollinations rate limited (429) for scene ${index + 1}`);
      if (!resp.ok) throw new Error(`Pollinations (scene ${index + 1}) ${resp.status}: ${(await resp.text()).slice(0, 120)}`);
      const imgBuf = Buffer.from(await resp.arrayBuffer());
      if (imgBuf.byteLength < 5000) throw new Error(`Pollinations empty image (${imgBuf.byteLength} bytes)`);
      console.log(`     → Pollinations scene ${index + 1}: ${(imgBuf.byteLength / 1024).toFixed(0)} KB ✓`);
      return cropToPortrait(imgBuf);
    });
  }

  console.log(`     → Pollinations AI (anonymous): scene ${index + 1}...`);
  for (let attempt = 1; attempt <= 4; attempt++) {
    const resp = await fetch(urlBase, { signal: AbortSignal.timeout(120000) });
    if (resp.status === 429) {
      const delay = attempt * 8000;
      console.warn(`     ⚠ Pollinations rate limited (attempt ${attempt}) — waiting ${delay / 1000}s`);
      await new Promise(res => setTimeout(res, delay));
      continue;
    }
    if (!resp.ok) throw new Error(`Pollinations (scene ${index + 1}) ${resp.status}: ${(await resp.text()).slice(0, 120)}`);
    const imgBuf = Buffer.from(await resp.arrayBuffer());
    if (imgBuf.byteLength < 5000) {
      console.warn(`     ⚠ Pollinations empty image (attempt ${attempt}) — retrying`);
      await new Promise(res => setTimeout(res, 4000));
      continue;
    }
    console.log(`     → Pollinations scene ${index + 1}: ${(imgBuf.byteLength / 1024).toFixed(0)} KB ✓`);
    return cropToPortrait(imgBuf);
  }
  throw new Error(`Pollinations failed after all retries for scene ${index + 1}`);
}

async function generateFallbackImage(index: number): Promise<Buffer> {
  const gradients = [
    'gradient:#0d0d2b-#1a0030',
    'gradient:#0a1628-#1a2855',
    'gradient:#1a0000-#3d0010',
    'gradient:#001a1a-#00333a',
    'gradient:#1a1500-#3d3000',
  ];
  const gradient = gradients[index % gradients.length];
  const tmpOut = join(tmpdir(), `fallback_${Date.now()}_${index}.jpg`);
  try {
    execSync(`convert -size 1080x1920 "${gradient}" -quality 85 "${tmpOut}" 2>/dev/null`);
    if (existsSync(tmpOut) && statSync(tmpOut).size > 500) {
      const buf = readFileSync(tmpOut);
      try { execSync(`rm -f "${tmpOut}"`); } catch { /* ignore */ }
      return buf;
    }
  } catch { /* fall through */ }
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
    'base64'
  );
}

async function generateImage(sceneDesc: string, index: number, videoVariant: number = 0): Promise<Buffer> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const simplify = attempt > 1;

    try {
      return await generateImageWithCloudflare(sceneDesc, index, videoVariant);
    } catch (cfErr: any) {
      console.warn(`     ⚠ Cloudflare failed scene ${index + 1} (attempt ${attempt}): ${cfErr.message.slice(0, 80)}`);
    }

    try {
      return await generateImageWithPollinations(sceneDesc, index, simplify, videoVariant);
    } catch (polErr: any) {
      console.warn(`     ⚠ Pollinations failed scene ${index + 1} (attempt ${attempt}): ${polErr.message.slice(0, 80)}`);
      if (attempt < MAX_ATTEMPTS) {
        const delay = attempt * 6000;
        console.warn(`     → Retrying scene ${index + 1} in ${delay / 1000}s...`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  console.warn(`     ⚠ Scene ${index + 1}: all providers failed — using cinematic gradient fallback`);
  return generateFallbackImage(index);
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
  const musicPath = join(tmpDir, 'music.mp3');
  // Shuffle all tracks so we try them in a random order, falling back through each
  const shuffled = [...BACKGROUND_MUSIC_TRACKS].sort(() => Math.random() - 0.5);
  for (const trackUrl of shuffled) {
    try {
      console.log(`     → Downloading music: ${trackUrl.split('/').pop()}...`);
      const resp = await fetch(trackUrl, { signal: AbortSignal.timeout(35000) });
      if (!resp.ok) {
        console.warn(`     ⚠ Music track HTTP ${resp.status} — trying next`);
        continue;
      }
      const ct = resp.headers.get('content-type') ?? '';
      if (ct && !ct.includes('audio') && !ct.includes('octet-stream') && !ct.includes('mpeg')) {
        console.warn(`     ⚠ Music unexpected content-type "${ct}" — trying next`);
        continue;
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.byteLength < 10000) {
        console.warn(`     ⚠ Music file too small (${buf.byteLength}B) — trying next`);
        continue;
      }
      writeFileSync(musicPath, buf);
      console.log(`     → Music: ${(buf.byteLength / 1024).toFixed(0)} KB ✓`);
      return musicPath;
    } catch (e: any) {
      console.warn(`     ⚠ Music error: ${e.message?.slice(0, 60)} — trying next`);
    }
  }
  console.warn('     ⚠ All music tracks failed — video will have voiceover only');
  return null;
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
  const OUTRO_SEC = 8.0;
  const OUTRO_MIN_FRAMES = Math.ceil(OUTRO_SEC * FPS); // guaranteed minimum outro frames
  const AUDIO_BUFFER_SEC = 1.0;

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
      } else throw new Error('ffprobe returned invalid value');
    } catch {
      audioDurationSec = Math.max((audioBytes * 8) / (192 * 1000), 20);
      console.log(`  Audio duration (estimated): ${audioDurationSec.toFixed(2)}s`);
    }
  }

  // Use real word timestamps to correct audio duration — ffprobe can underestimate
  if (wordTimestamps && wordTimestamps.length > 0) {
    const lastWordEnd = wordTimestamps[wordTimestamps.length - 1].end;
    if (lastWordEnd > audioDurationSec) {
      audioDurationSec = lastWordEnd + 0.2; // slight padding after last word
      console.log(`  Audio duration (timestamp-corrected): ${audioDurationSec.toFixed(2)}s`);
    }
  }

  const totalSec = Math.min(audioDurationSec + AUDIO_BUFFER_SEC + OUTRO_SEC, 120);
  const durationInFrames = Math.ceil(totalSec * FPS);

  // CRITICAL: clamp audioDurationFrames so the outro always gets OUTRO_MIN_FRAMES
  const rawAudioFrames = Math.round(audioDurationSec * FPS);
  const audioDurationFrames = Math.min(rawAudioFrames, durationInFrames - OUTRO_MIN_FRAMES);
  console.log(`  Video: ${totalSec.toFixed(1)}s total → ${durationInFrames} frames | audio: ${audioDurationSec.toFixed(1)}s (${audioDurationFrames}f) | outro: ${((durationInFrames - audioDurationFrames) / FPS).toFixed(1)}s (${durationInFrames - audioDurationFrames}f)`);

  // ── Build subtitle timings ────────────────────────────────────────────────
  const SUBTITLE_CHUNK = 1;
  const cleanedScript = cleanVoiceoverScript(script);
  let subtitleTimings: Array<{ text: string; startFrame: number; endFrame: number }> = [];

  if (wordTimestamps && wordTimestamps.length > 0) {
    // Use real UnrealSpeech timestamps — pass audioDurationFrames to prevent subtitle bleed
    subtitleTimings = buildSubtitleTimingsFromWords(wordTimestamps, FPS, SUBTITLE_CHUNK, audioDurationFrames);
    console.log(`  Subtitle chunks: ${subtitleTimings.length} (real UnrealSpeech word timestamps ✓)`);
  } else {
    // Heuristic fallback: calibrated words-per-second for Will (male) voice
    const WORDS_PER_SEC = 2.8;
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
  const scenes = imagePaths.map(p => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`);
  const audioSrc = hasAudio ? `data:audio/mpeg;base64,${readFileSync(audioPath).toString('base64')}` : '';
  let musicSrc = '';
  if (musicPath) {
    try { musicSrc = `data:audio/mpeg;base64,${readFileSync(musicPath).toString('base64')}`; } catch { /* skip */ }
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

  const composition = await selectComposition({ serveUrl: bundleLocation, id: 'TikTokVideo', inputProps });

  console.log(`  Rendering ${durationInFrames} frames at 1080×1920...`);
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 18 * 60 * 1000,
    concurrency: 1,
    chromiumOptions: { disableWebSecurity: true, gl: 'swiftshader' },
    onProgress: ({ renderedFrames }: any) => {
      if (renderedFrames % 150 === 0 || renderedFrames === durationInFrames) {
        console.log(`    ↳ ${renderedFrames}/${durationInFrames} frames (${((renderedFrames / durationInFrames) * 100).toFixed(0)}%)`);
      }
    },
  });
}

// ─── Storage Upload ────────────────────────────────────────────────────────────

async function uploadFile(localPath: string, bucketPath: string, mime: string): Promise<string> {
  const fileData = readFileSync(localPath);
  const { error } = await supabase.storage
    .from('videos')
    .upload(bucketPath, fileData, { contentType: mime, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from('videos').getPublicUrl(bucketPath);
  return data.publicUrl;
}

// ─── Notification Delivery ─────────────────────────────────────────────────────

async function sendNotification(userId: string, title: string, message: string, type: 'success' | 'error' | 'info', postId?: string): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      read: false,
      post_id: postId ?? null,
    });
    console.log(`  ✉ In-app notification inserted`);
  } catch (e: any) {
    console.warn(`  ⚠ Failed to insert notification: ${e.message}`);
  }

  try {
    const funcUrl = `${SUPABASE_URL}/functions/v1/send-push`;
    const resp = await fetch(funcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        userId,
        title,
        body: message,
        url: '/AutoViral/manual',
        postId,
        tag: 'autoviral-video-ready',
      }),
    });
    const result = await resp.json() as any;
    if (result.sent > 0) {
      console.log(`  📲 Push notification sent to ${result.sent} device(s)`);
    }
  } catch (e: any) {
    console.warn(`  ⚠ Failed to send push notification: ${e.message}`);
  }
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────────

async function runManualPipeline(job: any): Promise<void> {
  const startTime = Date.now();
  const tmpDir = join(tmpdir(), `autoviral_manual_${job.id.slice(0, 8)}_${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const niche = job.niche === 'AUTO'
    ? NICHES[Math.floor(Math.random() * NICHES.length)]
    : job.niche;

  console.log(`\n▶ Manual Job ${job.id.slice(0, 8)} | niche: ${niche}`);

  await supabase.from('manual_jobs').update({
    status: 'running',
    last_run_at: new Date().toISOString(),
  }).eq('id', job.id);

  const { data: postRow } = await supabase.from('posts').insert({
    user_id: job.user_id,
    manual_job_id: job.id,
    niche,
    status: 'processing',
  }).select().single();

  const postId: string | null = postRow?.id ?? null;

  const failJob = async (msg: string) => {
    const elapsed = Date.now() - startTime;
    console.error(`  ❌ ${msg}`);
    if (postId) {
      await supabase.from('posts').update({ status: 'failed', publish_result: msg }).eq('id', postId);
    }
    await supabase.from('manual_jobs').update({
      status: 'failed',
      last_error: msg.slice(0, 500),
      execution_time_ms: elapsed,
    }).eq('id', job.id);
    await sendNotification(
      job.user_id,
      'Video Generation Failed',
      `Your video generation failed: ${msg.slice(0, 120)}`,
      'error',
      postId ?? undefined,
    );
  };

  try {
    // 1. Pick unique topic
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

    // 2. Generate script
    console.log('  2/8 Generating viral script with 5 scenes...');
    const { title, script, scenes } = await generateScript(topic, niche);
    console.log(`     → "${title}" | ${scenes.length} scenes`);
    if (postId) await supabase.from('posts').update({ title, script }).eq('id', postId);

    // 3. Generate caption & hashtags
    console.log('  3/8 Generating viral caption and hashtags...');
    const { caption, hashtags } = await generateCaptionAndHashtags(topic, niche, title, script);
    console.log(`     → Caption: "${caption.slice(0, 60)}..."`);
    console.log(`     → Hashtags: ${hashtags.split(' ').length} tags`);
    if (postId) await supabase.from('posts').update({ caption, hashtags }).eq('id', postId);

    // 4. Voiceover + real word timestamps via UnrealSpeech /synthesisTasks
    console.log('  4/8 Generating voiceover + real timestamps (UnrealSpeech)...');
    const { audioBuffer, wordTimestamps } = await generateVoiceoverWithTimestamps(script);
    const audioPath = join(tmpDir, 'voice.mp3');
    writeFileSync(audioPath, audioBuffer);
    console.log(`     → ${(audioBuffer.byteLength / 1024).toFixed(0)} KB audio`);

    // 5. Background music
    console.log('  5/8 Downloading background music...');
    const musicPath = await downloadBackgroundMusic(tmpDir);

    // 6. Scene images — fully parallel for maximum speed
    console.log(`  6/8 Generating ${scenes.length} scene images in parallel (Cloudflare AI → Pollinations → gradient fallback)...`);
    // videoVariant ensures each video gets unique atmospheric details even if topic/scenes repeat
    const videoVariant = Math.floor((Date.now() / 1000) % 10000);
    const imageSlots: Array<string | null> = new Array(scenes.length).fill(null);
    await Promise.all(scenes.map(async (scene, i) => {
      try {
        const imgBuf = await generateImage(scene, i, videoVariant);
        const imgPath = join(tmpDir, `scene_${i}.jpg`);
        writeFileSync(imgPath, imgBuf);
        imageSlots[i] = imgPath;
        console.log(`     → Scene ${i + 1}/${scenes.length}: ${(imgBuf.byteLength / 1024).toFixed(0)} KB ✓`);
      } catch (e: any) {
        console.warn(`     ⚠ Scene ${i + 1} unexpected error: ${e.message?.slice(0, 80)} — using inline gradient`);
        const pp = join(tmpDir, `scene_${i}.jpg`);
        try {
          const gradients = ['gradient:#0d0d2b-#1a0030', 'gradient:#0a1628-#1a2855', 'gradient:#1a0000-#3d0010', 'gradient:#001a1a-#00333a', 'gradient:#1a1500-#3d3000'];
          execSync(`convert -size 1080x1920 "${gradients[i % gradients.length]}" -quality 85 "${pp}" 2>/dev/null`);
          if (existsSync(pp) && statSync(pp).size > 500) imageSlots[i] = pp;
        } catch { /* skip this scene */ }
      }
    }));
    const imagePaths = imageSlots.filter((p): p is string => p !== null);
    if (imagePaths.length === 0) {
      throw new Error('All scene images failed to generate — cannot create video');
    }
    console.log(`     → ${imagePaths.length} of ${scenes.length} scenes ready`);

    // 7. Remotion render
    console.log('  7/8 Rendering video with Remotion...');
    const videoPath = join(tmpDir, 'final.mp4');
    await assembleVideoWithRemotion(imagePaths, audioPath, musicPath, videoPath, script, title, wordTimestamps);
    let _rawSize = readFileSync(videoPath).byteLength;
    console.log(`     → Raw: ${(_rawSize / 1024 / 1024).toFixed(1)} MB — compressing...`);
    try {
      const _cPath = videoPath.replace('.mp4', '_opt.mp4');
      execSync(`ffmpeg -i "${videoPath}" -c:v copy -c:a aac -b:a 128k -movflags +faststart -y "${_cPath}" 2>&1`, { timeout: 300000 });
      const _cSize = readFileSync(_cPath).byteLength;
      console.log(`     → Optimized: ${(_cSize/1024/1024).toFixed(1)} MB (${Math.round((1-_cSize/_rawSize)*100)}% smaller)`);
      execSync(`mv "${_cPath}" "${videoPath}"`);
    } catch (_ce: any) { console.warn(`     ⚠ Compression skipped: ${_ce.message?.slice(0,60)}`); }

    // 8. Upload to Supabase Storage
    console.log('  8/8 Uploading to Supabase Storage...');
    const timestamp = Date.now();
    const userId = job.user_id;
    const videoUrl = await uploadFile(videoPath, `manual/${userId}/${timestamp}.mp4`, 'video/mp4');
    const thumbUrl = await uploadFile(imagePaths[0], `manual-thumbnails/${userId}/${timestamp}.jpg`, 'image/jpeg');
    console.log(`     → ${videoUrl}`);

    const elapsed = Date.now() - startTime;

    if (postId) {
      await supabase.from('posts').update({
        video_url: videoUrl,
        thumbnail_url: thumbUrl,
        status: 'rendered',
        published_at: null,
      }).eq('id', postId);
    }

    await supabase.from('manual_jobs').update({
      status: 'success',
      last_run_at: new Date().toISOString(),
      last_topic: topic,
      last_error: null,
      execution_time_ms: elapsed,
    }).eq('id', job.id);

    console.log(`  ✅ Done in ${(elapsed / 1000).toFixed(1)}s — stored: ${videoUrl}`);

    await sendNotification(
      userId,
      'Video Ready',
      `"${title}" has been generated successfully. Caption and hashtags are ready to copy.`,
      'success',
      postId ?? undefined,
    );

  } catch (err: any) {
    await failJob(err.message ?? String(err));
  } finally {
    try { execSync(`rm -rf "${tmpDir}"`); } catch { /* ignore */ }
  }
}

// ─── Entry Point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🎬 AutoViral Manual Generation Pipeline — ' + new Date().toISOString());

  const jobIdArg = (() => {
    const i = process.argv.indexOf('--job-id');
    return i !== -1 ? process.argv[i + 1] : null;
  })();

  const { data: activeKeys } = await supabase
    .from('api_keys')
    .select('service')
    .eq('is_active', true)
    .neq('status', 'failed');

  const servicesPresent = new Set((activeKeys ?? []).map((k: any) => k.service));
  const required = ['cerebras', 'unrealspeech'];
  const missing = required.filter(s => !servicesPresent.has(s));

  if (missing.length > 0) {
    console.error(`❌ Missing API keys in Supabase: ${missing.join(', ')}`);
    console.error('   → Add them via the Settings page in the AutoViral dashboard.');
    process.exit(1);
  }

  const hasCF = servicesPresent.has('cloudflare') && servicesPresent.has('cloudflare_id');
  if (!hasCF) {
    console.warn('⚠ No Cloudflare AI keys — image generation will use Pollinations AI (free fallback)');
  }

  let jobs: any[] | null = null;
  let fetchError: any = null;

  // Stale running threshold: jobs stuck in 'running' for over 45 minutes are re-attempted
  // (happens when GitHub Actions runner times out mid-run)
  const staleThreshold = new Date(Date.now() - 45 * 60 * 1000).toISOString();

  if (jobIdArg) {
    console.log(`🎯 Instant dispatch — running specific job: ${jobIdArg}`);
    const res = await supabase
      .from('manual_jobs')
      .select('*')
      .eq('id', jobIdArg)
      .in('status', ['pending', 'running'])
      .limit(1);
    jobs = res.data;
    fetchError = res.error;
  } else {
    const [pendingRes, staleRes] = await Promise.all([
      supabase.from('manual_jobs').select('*').eq('status', 'pending').lte('scheduled_time', new Date().toISOString()),
      supabase.from('manual_jobs').select('*').eq('status', 'running').lte('last_run_at', staleThreshold),
    ]);
    fetchError = pendingRes.error;
    const staleJobs = staleRes.data ?? [];
    if (staleJobs.length > 0) {
      console.log(`Found ${staleJobs.length} stale running job(s) — resetting and re-running`);
      for (const j of staleJobs) {
        await supabase.from('manual_jobs').update({ status: 'pending' }).eq('id', j.id);
      }
    }
    jobs = [...(pendingRes.data ?? []), ...staleJobs];
  }

  if (fetchError) {
    console.error('Failed to fetch manual jobs:', fetchError.message);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log('✓ No pending manual jobs due right now.');
    return;
  }

  console.log(`Found ${jobs.length} manual job(s) to run.`);
  for (const job of jobs) {
    await runManualPipeline(job);
  }

  console.log('\n✅ All manual pipelines complete!');
}
main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
