import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'fs';
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
        // Model-not-found (404) or empty-content errors mean a config/capacity issue — NOT a bad API key
        const isNonKeyError = /model.*not.*exist|model.*not.*found|model_not_found|does not exist or you do not have access|increase max_tokens|empty content|No JSON in response/i.test(e.message ?? '');
        if (isRateLimit && attempt < maxAttempts) {
          const delay = attempt === 1 ? 15000 : 60000;
          console.warn(`  ⚠ Key [${key.id.slice(0, 8)}] rate limited — retrying in ${delay / 1000}s (attempt ${attempt}/${maxAttempts})`);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        const newStatus = isRateLimit ? 'rate_limited' : (isNonKeyError ? 'active' : 'failed');
        await supabase.from('api_keys').update({
          error_count: key.error_count + 1,
          request_count: key.request_count + 1,
          status: newStatus,
          last_used_at: new Date().toISOString(),
        }).eq('id', key.id);
        console.warn(`  ⚠ Key [${key.id.slice(0, 8)}] [${service}]: ${newStatus} — ${e.message.slice(0, 120)}`);
        lastError = e;
        break;
      }
    }
  }

  throw lastError ?? new Error(`All keys for ${service} exhausted`);
}

// ─── Cerebras Multi-Model Chat (rate-limit resilient) ─────────────────────────

// FIX: Updated to current Cerebras-available models (verified via /v1/models endpoint 2026-06-06)
// Removed: qwen-3-32b, llama3.3-70b, llama3.1-70b, llama3.1-8b (all return 404 model_not_found)
const CEREBRAS_MODELS = [
  'gpt-oss-120b',
  'zai-glm-4.7',
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
        lastErr = err;
        if (resp.status === 429) await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      const json = await resp.json() as any;
      const msg = json.choices?.[0]?.message;
      // FIX: For reasoning models (gpt-oss-120b, zai-glm-4.7), ONLY use content — never reasoning.
      // The reasoning field is the internal chain-of-thought and often reflects the prompt back;
      // it is never the final answer. If content is empty, max_tokens was too low — throw a
      // retryable error (NOT a key failure — the key itself is fine).
      const text = (msg?.content ?? '').trim();
      if (!text) throw new Error(`Cerebras (${model}) returned empty content — increase max_tokens`);
      return text;
    } catch (e: any) {
      lastErr = e as Error;
      if (/429|rate.?limit|too.?many|quota|exceeded/.test(e.message ?? '')) {
        await new Promise(r => setTimeout(r, 2000));
      }
      continue;
    }
  }
  throw lastErr ?? new Error('All Cerebras models exhausted');
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

  const prompt = `You are an investigative journalist covering crypto scam awareness.
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
    // FIX: increased from 80 to 500 — reasoning models need budget for both reasoning AND content output
    const rawTopic = await cerebrasChat(key, [{ role: 'user', content: prompt }], 500);
    const topic = rawTopic.replace(/^["']|["']$/g, '');
    return topic || `${niche} Warning — ${new Date().toLocaleDateString()}`;
  });
}

// ─── Script Generation ────────────────────────────────────────────────────────

async function generateScript(topic: string, niche: string): Promise<ScriptResult> {
  const prompt = `You are a professional investigative journalist creating viral crypto scam awareness content for social media.

Topic: "${topic}"
Niche: ${niche}

Write a complete social media video package. Follow every rule exactly.

VOICEOVER RULES (the "script" field):
- Pure natural spoken words only — exactly what the narrator says out loud
- Start with a shocking hook — a dramatic fact, statistic, or urgent warning question
- 130-160 words total (50-60 seconds when spoken at a normal pace)
- Tone: professional, urgent, journalistic — like an investigative news reporter
- Speak TO the viewer using "you" and "your" — warning and educating them
- CRITICAL: NEVER use first-person narration — BANNED words: "I", "I've", "I was", "I lost", "I joined", "me", "my", "we joined", "our wallet"
- The narrator is a journalist REPORTING on scams, NOT a victim telling their story
- Be factual, specific, dramatic — name the scam type, explain how it works, warn the viewer
- IMPORTANT: End with EXACTLY these three sentences: "If you have been a victim of a crypto scam, visit the link in our bio or check the first comment below for immediate help. Recover your lost crypto through a free confidential case review. Follow for daily crypto scam warnings."
- FORBIDDEN in the script field: emojis, [brackets], (parenthetical stage directions), "Scene:", "Script:", "Narrator:", "Voiceover:", section labels, timestamps, asterisks, or any non-spoken text
- Write as ONE continuous paragraph of spoken words — no line breaks, no sections

SCENE RULES (the "scenes" array):
- Exactly 5 scenes — each scene is the VISUAL TRANSLATION of the specific moment in the voiceover being narrated
- CRITICAL ALIGNMENT: read the voiceover first, divide it mentally into 5 roughly equal segments, then write a scene that SHOWS what each segment is DESCRIBING:
  * Scene 1 = the HOOK segment: a visual that embodies the shocking statistic or dramatic opening fact
  * Scene 2 = the MECHANISM segment: a visual that depicts HOW the specific scam type actually operates
  * Scene 3 = the VICTIM segment: a visual of the human cost — the emotional aftermath of being deceived
  * Scene 4 = the PERPETRATOR segment: a visual representing the criminal actor or deceptive infrastructure
  * Scene 5 = the WARNING/CTA segment: a visual conveying danger, urgency, and the call to protect yourself
- TOPIC LOCK: every scene description MUST visually reflect the EXACT scam type and topic — generic imagery is forbidden:
  * Bad: "shadowy figure at a computer" (generic, works for any topic)
  * Good: "a victim's phone screen showing a fake AI deepfake video call of a celebrity endorsing a crypto scheme, amber light reflecting on their horrified face" (specific to this topic)
- COMPOSITION DIVERSITY: no two scenes may share the same camera angle, distance, or dominant color palette:
  * Scene 1: ultra-wide or aerial — establishes massive scale of the scam
  * Scene 2: extreme macro close-up — reveals the deceptive detail up close
  * Scene 3: intimate medium shot — human emotional weight, desaturated palette
  * Scene 4: low-angle menacing — threatening presence, high-contrast dark lighting
  * Scene 5: overhead or stark frontal — symbolic, geometric, warning-palette composition
- VISUAL SPECIFICITY REQUIREMENTS per scene:
  * Name the exact subjects (specific device types, specific human reactions, specific environments)
  * Name the exact lighting source and direction (single side-key light, top-down overhead, warm backlight)
  * Name the exact color temperature (cold blue-teal, warm amber, desaturated gray, deep crimson, red-orange)
  * Include one unique environmental micro-detail that makes this scene unmistakably about THIS topic
- Pure VISUAL description only — NO text, NO words, NO letters, NO numbers in any scene description
- NO "Scene 1:" prefix or labels — just the raw visual description
- Portrait 9:16 cinematic aspect ratio, photorealistic, single frame

Return ONLY valid JSON with no markdown fences, no explanation, nothing else:
{
  "title": "Viral warning title, under 80 characters, no emojis, no first-person",
  "script": "Pure spoken voiceover paragraph — journalistic, no first-person, no labels",
  "scenes": [
    "[SCENE 1 — HOOK: Replace with ultra-wide establishing image that SHOWS the shocking scale or nature of the specific scam described in the opening voiceover sentence. Include exact subject, dominant cold color, and environment.]",
    "[SCENE 2 — MECHANISM: Replace with extreme macro close-up that SHOWS the actual deception mechanism of this specific scam — the exact fake interface, document, or action being described in the voiceover at this point. Include warm amber light on the subject.]",
    "[SCENE 3 — VICTIM IMPACT: Replace with intimate medium shot that SHOWS a real human experiencing the emotional aftermath of this specific scam type. Must be desaturated, soft, and emotionally resonant with the voiceover's victim narrative moment.]",
    "[SCENE 4 — PERPETRATORS: Replace with low-angle menacing shot that SHOWS the anonymous criminal actor or technical infrastructure behind THIS specific scam. Must use deep crimson-red accent light and a threatening, surveillance-camera perspective.]",
    "[SCENE 5 — WARNING CTA: Replace with overhead or stark frontal symbolic shot that SHOWS a danger/loss symbol specific to this scam type. Must use red-orange warning palette and convey urgency matching the CTA moment of the voiceover.]"
  ]
}`;

  return tryWithKeys('cerebras', async (key) => {
    // FIX: max_tokens raised 2000 → 16000 — reasoning models (gpt-oss-120b, zai-glm-4.7)
      // consume most tokens internally; with 2000 the JSON gets truncated → parse fails →
      // 47-word emergency fallback → ~19s audio → ~25s video. 16000 gives the model full room.
      const content = await cerebrasChat(key, [{ role: 'user', content: prompt }], 16000);

    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const rawScenes: string[] = Array.isArray(parsed.scenes) ? parsed.scenes : [];
        // Fallback scenes are dynamically derived from the topic so they are at least topic-specific.
        // Each has a distinct composition/angle/color to avoid visual repetition.
        const defaultScenes = [
          `Ultra-wide establishing shot — a vast dark digital landscape representing the scale of ${topic}: dozens of phantom transaction lines flowing across an infinite dark grid, cold blue-teal glow, depth-of-field blur in the deep background`,
          `Extreme macro close-up — trembling hands hovering over a glowing screen displaying a fake ${topic} interface in real time, warm amber backlight, shallow depth of field, sweat visible on fingertip pressing the screen`,
          `Intimate medium shot — a middle-aged person alone at a dark kitchen table, head buried in hands, soft desaturated gray light, scattered documents visible, embodying the human cost of the ${topic} scheme`,
          `Low-angle menacing shot — a silhouetted figure in a hoodie standing before glowing red server racks that represent the infrastructure behind ${topic}, deep crimson accent light casting harsh upward shadows, anonymous and threatening`,
          `Overhead aerial symbolic shot — an empty open wallet lying flat on cold dark marble, a single gold coin beside it casting a long shadow, stark red-orange warning rim light, geometric and sparse, representing ${topic} victims`,
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
          // Visual/cinematic language guard — prevents scene/image descriptions from leaking into voiceover script
          const VISUAL_LANG_KW = /\b(close.?up|wide.?angle|overhead|low.?angle|silhouett|backlit|rim.?light|depth.?of.?field|bokeh|macro.?shot|tracking|dolly|aerial|bird.?eye|color.?grade|amber.?backlight|server.?room|glowing|blinking|cinematic|photorealistic|portrait.?orientation|9:16|aspect.?ratio|dramatic.?atmosphere|neon.?lighting|dark.?background|full.?frame|establishing.?shot|lens.?flare|warm.?amber|crimson.?light|marble|leather.?wallet|golden.?coin|medium.?shot|extreme.?close|ultra.?wide|volumetric|atmospheric.?haze|shallow.?depth|backlight|sidelight|specular|ambient|glowing.?terminal|blinking.?lights|hooded.?figure|silhouetted|sweat.?on|trembling|hunched)\b/i;
          const _candidates = content.split(/\n+/).map((l: string) => l.trim()).filter((l: string) =>
            l.length > 60 && l.length < 600 && !l.startsWith('"') && !l.includes('://') &&
            !l.includes('{') && !/{\s*"/.test(l) && !/^(Scene|Title|Narrator)\s*[:\d]/i.test(l) &&
            !VISUAL_LANG_KW.test(l) &&
            /\b(crypto|scam|fraud|victim|warning|alert|millions|thousands|stolen|protect|follow|send|invest|wallet|you|your|this|these|how|what|why|when|people|today|now|already|never|always|beware)\b/i.test(l)
          );
          _scriptText = _candidates.sort((a: string, b: string) => b.length - a.length)[0]
            || `This crypto scam has already stolen millions. Stay alert and never trust unverified investment promises. If you have been a victim of a crypto scam, visit the link in our bio or check the first comment below for help. Recover your lost crypto through a free confidential case review. Follow for daily crypto scam warnings.`;
        }
        // GUARD: minimum 80 words (~30s audio). If script is shorter, JSON parsing partially failed.
          const _scriptWordCount = _scriptText.split(/\s+/).filter(Boolean).length;
          if (_scriptWordCount < 80) {
            console.warn(`  ⚠ Script only ${_scriptWordCount} words (need 80+ for full-length video) — using extended fallback`);
            _scriptText = `WARNING: A sophisticated crypto fraud operation is targeting investors globally right now, and it could cost you everything you have worked for. The scheme has already stolen millions from thousands of victims using fake platforms, deepfake celebrity endorsements, and AI-powered chatbots designed to sound exactly like real financial advisors. Scammers build trust carefully over weeks or months before vanishing overnight with your entire investment. The victims are not careless people — they are intelligent, educated individuals who were systematically deceived by increasingly professional fraud operations. Warning signs are always present if you know what to look for: guaranteed returns with no risk, pressure to invest larger amounts, and requests to recruit your friends and family into the scheme. Authorities are warning the public to independently verify every investment platform before sending a single dollar. If you recognize any of these patterns, stop immediately and seek help. If you have been a victim of a crypto scam, visit the link in our bio or check the first comment below for a free confidential case review. Follow for daily crypto scam warnings.`;
          }
          return { title: (parsed.title || topic).slice(0, 150), script: _scriptText, scenes };
      }
    } catch { /* fall through */ }

    // Emergency fallback — still topic-specific with diverse compositions
    return {
      title: topic.slice(0, 150),
      script: `WARNING: A sophisticated crypto fraud operation is targeting investors across the globe right now, and it could cost you everything. This scheme has already stolen millions from thousands of unsuspecting victims using fake platforms, deepfake celebrity endorsements, and AI-powered chatbots designed to sound like legitimate financial advisors. Scammers build trust carefully over weeks or months before vanishing overnight with your funds. The victims are not naive — they are intelligent people who were deceived by increasingly professional fraud. Warning signs are always present: guaranteed returns, pressure to invest more, requests to recruit friends and family. Authorities are warning everyone to independently verify any investment platform before sending a single dollar. If you recognize any of these patterns in an investment you are currently involved in, stop immediately and seek help. If you have been a victim of a crypto scam, visit the link in our bio or check the first comment below for a free confidential case review. Follow for daily crypto scam warnings.`,
      scenes: [
        `Ultra-wide cold blue-teal shot — a dark sprawling digital network map representing the ${topic} operation, thousands of phantom connection lines spreading across an infinite dark grid, ominous scale`,
        `Extreme macro close-up — a finger hovering over a glowing touchscreen showing a fraudulent ${topic} interface, warm amber backlight, shallow depth of field, sweat on fingertip, intense and immediate`,
        `Intimate desaturated medium shot — an isolated person alone at a dimly lit table, head down, hands covering face, crumpled papers scattered around, embodying the despair of ${topic} victims`,
        `Low-angle menacing shot looking upward — a dark hooded anonymous figure standing over a glowing red keyboard, crimson light raking upward across their concealed face, surveillance cameras visible in background`,
        `Overhead stark frontal shot — an empty open wallet lying flat on cold black marble, single coin casting a dramatic shadow, bold red-orange warning rim light, geometric isolation representing ${topic} losses`,
      ],
    };
  });
}

// ─── Caption Generation ───────────────────────────────────────────────────────

interface CaptionResult {
  caption: string;
  hashtags: string;
}

const FIXED_HASHTAGS = '#Crypto #Bitcoin #Ethereum #CryptoNews #Altcoins';

async function generateCaptionAndHashtags(topic: string, niche: string, title: string, script: string): Promise<CaptionResult> {
  const scriptPreview = script.slice(0, 250);
  const prompt = `You are a viral social media content strategist specializing in crypto scam awareness content.

Create a viral social media caption for this video:
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

Return ONLY valid JSON, no markdown, no explanation:
{
  "caption": "your caption here"
}`;

  try {
    return await tryWithKeys('cerebras', async (key) => {
      // FIX: increased from 400 to 1200 — reasoning models need token budget for reasoning + JSON content output
      const content = await cerebrasChat(key, [{ role: 'user', content: prompt }], 1200);
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return {
          caption: (parsed.caption || `${title} - This crypto scam could steal everything from you. Share to protect others. Follow for daily crypto scam warnings.`).slice(0, 150),
          hashtags: FIXED_HASHTAGS,
        };
      }
      throw new Error('No JSON in response');
    });
  } catch (e: any) {
    console.warn(`  ⚠ Caption generation failed: ${e.message} — using defaults`);
    return {
      caption: `${title.slice(0, 100)} - This crypto scam has already stolen millions. Share to warn others. Follow for daily crypto scam warnings.`,
      hashtags: FIXED_HASHTAGS,
    };
  }
}

// ─── Script Cleaner ───────────────────────────────────────────────────────────

function cleanVoiceoverScript(raw: string): string {
  // Comprehensive visual/cinematic language detector — prevents scene descriptions leaking into voiceover
  const IMAGE_KW = /\b(cinematic|portrait|photorealistic|9:16|aspect.?ratio|vertical.?orientation|dramatic.?atmosphere|neon.?lighting|hyperrealistic|full.?frame|dark.?background|cinematography|depth.?of.?field|shallow.?depth|shallow.?focus|bokeh|close.?up|wide.?angle|overhead.?shot|low.?angle|silhouett|backlit|rim.?light|color.?grade|warm.?amber|cold.?blue|teal|crimson.?light|server.?room|blinking.?lights|glowing.?terminal|aerial.?shot|macro.?shot|ultra.?wide|bird.?eye|tracking.?shot|dolly.?shot|establishing.?shot|lens.?flare|vignette|rack.?focus|focal.?length|parallax|ambient.?light|specular|diffuse|hdri|vfx|cgi|render|shader|texture|3d.?model|ray.?trac|unreal.?engine|blender|hue.?saturation|exposure|aperture|bokeh|tilt.?shift|pan.?shot|crane.?shot|b.?roll|color.?pallett|grading|black.?marble|leather.?wallet|golden.?coin|atmospheric.?haze|volumetric.?light|dust.?particle|steam.?curl|condensation|puddle.?reflect|lens.?distort|anamorphic|fisheye|portrait.?orientation|extreme.?close|medium.?shot|long.?shot|establishing|reaction.?shot|cut.?away|backlight|sidelight|keylight|fill.?light|catch.?light|practical.?light|motivated.?light|sweat.?on|trembling.?finger|hunched.?at|silhouetted.?figure|hooded.?figure|glowing.?red|glowing.?blue|glowing.?screen|monitor.?glow|blinking.?cursor|dark.?server|dark.?room.?lit|soft.?desaturated|muted.?gray|desaturated.?tone|rim.?lighting|harsh.?shadow|upward.?shadow|wipe.?tear|head.?in.?hand|crumpled.?paper|empty.?wallet|single.?coin|stark.?frontal|geometric.?and.?symbolic|ultra-wide.?shot|ultra.?wide.?shot|extreme.?close-up|extreme.?closeup|low-angle.?shot|overhead.?aerial|bird.?s.?eye)\b/i;

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
  // Secondary narration check — text must contain spoken-word markers to pass
  const NARRATION_KW = /\b(crypto|scam|fraud|victim|warning|alert|danger|millions|thousands|stolen|protect|follow|TikTok|direct|message|send|invest|wallet|transfer|account|platform|promise|trust|verify|news|watch|beware|never|always|you|your|this|these|how|what|why|when|people|person|someone|today|right.?now|already|because|before|after|reported|discovered|exposed|revealed|targeted|billions|hundreds|lost|recovery|funds|scammer|hacker|criminal|fraudster|scheme|operation|network)\b/i;
  const speech = paragraphs.filter(p =>
    p.split(/\s+/).length >= 12 &&
    !/^[A-Z][a-zA-Z ]+:/.test(p) &&
    !IMAGE_KW.test(p) &&
    !/[{}"\[\]]/.test(p) &&
    NARRATION_KW.test(p)
  );

  if (speech.length > 0) {
    return speech.join(' ').replace(/\s{2,}/g, ' ').trim().slice(0, 3000);
  }
  return text.slice(0, 3000) || 'This crypto scam is destroying lives. Stay informed. If you have been a victim of a crypto scam, visit the link in our bio right now. Recover your lost crypto from scammers. Follow for daily crypto scam warnings.';
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

    // Poll up to 90s (30 polls × 3s) — synthesis tasks typically complete in 15-30s
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
      if (taskStatus === 'completed') break;
      if (taskStatus === 'failed') throw new Error(`UnrealSpeech synthesis task failed (TaskId: ${taskId})`);
    }

    if (!outputUri) throw new Error(`UnrealSpeech: synthesis task never completed (TaskId: ${taskId})`);

    console.log(`     → Downloading audio from S3...`);
    const audioResp = await fetch(outputUri, { signal: AbortSignal.timeout(45000) });
    if (!audioResp.ok) throw new Error(`S3 audio download failed: ${audioResp.status}`);
    const audioBuffer = Buffer.from(await audioResp.arrayBuffer());
    if (audioBuffer.byteLength < 1000) throw new Error(`UnrealSpeech S3 audio empty (${audioBuffer.byteLength} bytes)`);

    let wordTimestamps: WordTimestamp[] | null = null;
    if (timestampsUri) {
      try {
        const tsResp = await fetch(timestampsUri, { signal: AbortSignal.timeout(20000) });
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
    if (maxFrame !== undefined) endFrame = Math.min(endFrame, maxFrame);
    if (endFrame > startFrame) {
      timings.push({ text, startFrame, endFrame });
    }
  }
  return timings;
}

// ─── Image Generation ──────────────────────────────────────────────────────────

// ATMOSPHERIC_VARIATIONS: additive cinematic detail layered on top of the LLM-generated scene description.
// NOTE: SCENE_CINEMATIC_STYLES was removed — it was the root cause of repetitive/generic visuals.
// The LLM's generateScript prompt now produces rich, topic-specific scene descriptions that already
// embed the correct cinematic style per scene. buildImagePrompt no longer overrides those styles;
// it only adds the universal technical requirements + a unique atmospheric micro-detail.
const ATMOSPHERIC_VARIATIONS = [
  'volumetric light rays piercing through dense smoke-filled atmosphere',
  'micro dust particles drifting slowly through the foreground in sharp focus',
  'steam or breath vapor curling through a cold environment in the background',
  'wet surface reflections shimmering in rain-slicked ground at the very bottom of frame',
  'subtle anamorphic lens flare streak cutting diagonally across the extreme edge of frame',
  'thick rolling fog bank creeping in from the deep background, obscuring distant shapes',
  'harsh overexposed highlights creating a stark blown-out silhouette against the background',
  'deep atmospheric haze blending and softening distant background layers into abstraction',
  'sharp backlit rim-lighting carving a precise glowing edge around the primary subject',
  'thin smoke trails rising slowly from an unseen source through shafts of directional light',
  'visible cold breath condensation hanging frozen in frigid dim air around the subject',
  'shallow puddle surface reflections distorting the scene geometry in extreme foreground',
  'heat shimmer distortion rising from a hot surface in the deep background',
  'single shaft of hard directional light cutting through absolute darkness at a steep angle',
  'translucent lens flare prism splitting light into spectral colours across the upper frame',
  'heavy chromatic aberration fringing the high-contrast edges, adding digital tension',
];

// buildImagePrompt — trusts the LLM-generated scene description as the primary visual directive.
// It no longer replaces or overrides the scene's cinematic style; it only appends:
//   1. A unique atmospheric micro-detail (varies by scene index × video variant for cross-video diversity)
//   2. Universal technical requirements (portrait ratio, no text, photorealistic, single frame)
// This ensures every image is directly derived from its specific voiceover moment.
function buildImagePrompt(sceneDesc: string, index: number = 0, videoVariant: number = 0): string {
  // Strip scene-number prefixes and bracketed stage directions but keep the full visual description
  const cleanDesc = sceneDesc.replace(/[Ss]cene\s+\d+[:\-]?\s*/g, '').replace(/\[.*?\]/g, '').trim();
  // Use a multiply-and-offset formula so each (scene, video) pair picks a DIFFERENT atmospheric detail
  // even when index alone or videoVariant alone would collide.
  const atmIdx = ((index * 5) + videoVariant + Math.floor(videoVariant / ATMOSPHERIC_VARIATIONS.length)) % ATMOSPHERIC_VARIATIONS.length;
  const atmosphericDetail = ATMOSPHERIC_VARIATIONS[atmIdx];
  return [
    cleanDesc,
    `Atmospheric cinematic detail: ${atmosphericDetail}.`,
    'Portrait orientation 9:16 vertical aspect ratio, full-frame single image, professional cinematic photography, photorealistic, ultra high quality.',
    'STRICT: absolutely NO text, NO words, NO letters, NO numbers, NO captions, NO subtitles, NO watermarks, NO labels, NO signs, NO titles anywhere in the image — pure visual only.',
    'Do NOT split into panels or multiple images. Single full-frame portrait scene only.',
    'Do NOT include any writing, typography, or overlaid text of any kind.',
  ].join(' ');
}

// FIX: num_steps corrected from 28 → 4 (Flux-1-Schnell is a 1-4 step model; 28 steps causes quota waste and failures)
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
        // FIX: 4 steps is optimal for Flux-1-Schnell (designed for 1-4 steps, not 28)
        body: JSON.stringify({ prompt, num_steps: 4 }),
      }
    );
    if (!resp.ok) throw new Error(`Cloudflare image (scene ${index + 1}) ${resp.status}: ${await resp.text()}`);

    const ct = resp.headers.get('content-type') ?? '';
    if (ct.includes('image/')) {
      return cropAndCompressToPortrait(Buffer.from(await resp.arrayBuffer()));
    }
    const json = await resp.json() as any;
    if (json?.result?.image) {
      return cropAndCompressToPortrait(Buffer.from(json.result.image, 'base64'));
    }
    throw new Error(`Unexpected Cloudflare response for scene ${index + 1}`);
  });
}

async function generateImageWithPollinations(sceneDesc: string, index: number, simplify = false, videoVariant: number = 0): Promise<Buffer> {
  const baseDesc = simplify ? sceneDesc.slice(0, 200) : sceneDesc;
  // When simplify=true (retry fallback) we still build from the LLM scene description.
  // We just trim it and strip heavy cinematic language to avoid prompt-length errors.
  const prompt = simplify
    ? buildImagePrompt(baseDesc.slice(0, 220), index, videoVariant)
    : buildImagePrompt(baseDesc, index, videoVariant);
  const seed = (Math.floor(Math.random() * 899999) + 100000) ^ (videoVariant * 7919);
  const encodedPrompt = encodeURIComponent(prompt.slice(0, 1500));
  // FIX: Use flux-realism model for better portrait cinematic quality
  const urlBase = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&model=flux-realism&nologo=true&seed=${seed}`;

  const { data: polKeyRows } = await supabase
    .from('api_keys')
    .select('id, key_value, request_count, success_count, error_count, status')
    .eq('service', 'pollinations')
    .eq('is_active', true)
    .neq('status', 'failed')
    .order('request_count', { ascending: true });

  const hasKeys = (polKeyRows ?? []).length > 0;

  if (hasKeys) {
    try {
      return await tryWithKeys('pollinations', async (key) => {
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
        return cropAndCompressToPortrait(imgBuf);
      });
    } catch (paidErr: any) {
      // FIX: paid key failed (e.g. 500 queue full/legacy endpoint) — fall through to anonymous
      console.warn(`     ⚠ Pollinations paid key failed scene ${index + 1} — trying anonymous: ${paidErr.message?.slice(0, 80)}`);
    }
  }
  console.log(`     → Pollinations AI (anonymous): scene ${index + 1}...`);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const resp = await fetch(urlBase, { signal: AbortSignal.timeout(120000) });
      if (resp.status === 429) {
        const delay = Math.min(attempt * 8000, 40000);
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
      return cropAndCompressToPortrait(imgBuf);
    } catch (e: any) {
      if (attempt === 5) throw e;
      await new Promise(res => setTimeout(res, attempt * 4000));
    }
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
    execSync(`convert -size 1080x1920 "${gradient}" -quality 75 "${tmpOut}" 2>/dev/null`);
    if (existsSync(tmpOut) && statSync(tmpOut).size > 500) {
      const buf = readFileSync(tmpOut);
      try { unlinkSync(tmpOut); } catch { /* ignore */ }
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

// FIX: Combined crop + compress to reduce base64 props size (keeps images under 250KB)
async function cropAndCompressToPortrait(imgBuf: Buffer): Promise<Buffer> {
  const tmpIn = join(tmpdir(), `img_in_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  const tmpOut = join(tmpdir(), `img_out_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  try {
    writeFileSync(tmpIn, imgBuf);
    // Resize to 1080x1920, center-crop, compress to 75% quality to keep base64 props manageable
    execSync(
      `convert "${tmpIn}" -resize 1080x1920^ -gravity Center -extent 1080x1920 -quality 75 -strip "${tmpOut}"`,
      { timeout: 20000 }
    );
    if (existsSync(tmpOut) && statSync(tmpOut).size > 500) {
      const out = readFileSync(tmpOut);
      try { unlinkSync(tmpIn); unlinkSync(tmpOut); } catch { /* ignore */ }
      return out;
    }
  } catch (e: any) {
    console.warn(`     ⚠ Image crop/compress failed: ${e.message?.slice(0, 60)} — using original`);
    try { if (existsSync(tmpIn)) unlinkSync(tmpIn); if (existsSync(tmpOut)) unlinkSync(tmpOut); } catch { /* ignore */ }
  }
  return imgBuf;
}

// ─── Background Music ──────────────────────────────────────────────────────────

async function downloadBackgroundMusic(tmpDir: string): Promise<string | null> {
  const musicPath = join(tmpDir, 'music.mp3');
  const shuffled = [...BACKGROUND_MUSIC_TRACKS].sort(() => Math.random() - 0.5);
  for (const trackUrl of shuffled) {
    try {
      console.log(`     → Downloading music: ${trackUrl.split('/').pop()}...`);
      const resp = await fetch(trackUrl, { signal: AbortSignal.timeout(45000) });
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
  const OUTRO_SEC = 5.0;
  const OUTRO_MIN_FRAMES = Math.ceil(OUTRO_SEC * FPS);
  const AUDIO_BUFFER_SEC = 1.0;

  const audioBytes = readFileSync(audioPath).byteLength;
  const hasAudio = audioBytes > 1000;
  let audioDurationSec = 40;

  if (hasAudio) {
    try {
      const ffOut = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`,
        { timeout: 15000 }
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

  if (wordTimestamps && wordTimestamps.length > 0) {
    const lastWordEnd = wordTimestamps[wordTimestamps.length - 1].end;
    if (lastWordEnd > audioDurationSec) {
      audioDurationSec = lastWordEnd + 0.2;
      console.log(`  Audio duration (timestamp-corrected): ${audioDurationSec.toFixed(2)}s`);
    }
  }

  // GUARD: if audio is suspiciously short (< 25s), the script generation likely used the
    // emergency fallback. Fail fast so the schedule can be retried with a full-length script.
    if (audioDurationSec < 25) {
      throw new Error(`Audio too short (${audioDurationSec.toFixed(1)}s < 25s minimum) — script generation produced a fallback. Will retry automatically.`);
    }

    const totalSec = Math.min(audioDurationSec + AUDIO_BUFFER_SEC + OUTRO_SEC, 120);
  const durationInFrames = Math.ceil(totalSec * FPS);

  const rawAudioFrames = Math.round(audioDurationSec * FPS);
  const audioDurationFrames = Math.min(rawAudioFrames, durationInFrames - OUTRO_MIN_FRAMES);
  console.log(`  Video: ${totalSec.toFixed(1)}s total → ${durationInFrames} frames | audio: ${audioDurationSec.toFixed(1)}s (${audioDurationFrames}f) | outro: ${((durationInFrames - audioDurationFrames) / FPS).toFixed(1)}s`);

  // ── Build subtitle timings ────────────────────────────────────────────────
  const SUBTITLE_CHUNK = 1;
  const cleanedScript = cleanVoiceoverScript(script);
  let subtitleTimings: Array<{ text: string; startFrame: number; endFrame: number }> = [];

  if (wordTimestamps && wordTimestamps.length > 0) {
    subtitleTimings = buildSubtitleTimingsFromWords(wordTimestamps, FPS, SUBTITLE_CHUNK, audioDurationFrames);
    console.log(`  Subtitle chunks: ${subtitleTimings.length} (real UnrealSpeech word timestamps ✓)`);
  } else {
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
    console.log(`  Subtitle chunks: ${subtitleTimings.length} (heuristic 1-word fallback)`);
  }

  console.log('  Converting assets to data URLs...');
  const scenes = imagePaths.map(p => {
    const data = readFileSync(p).toString('base64');
    return `data:image/jpeg;base64,${data}`;
  });
  console.log(`  → ${scenes.length} scene(s) loaded (avg ${Math.round(scenes.reduce((s, sc) => s + sc.length, 0) / scenes.length / 1024)}KB each)`);

  const audioSrc = hasAudio
    ? `data:audio/mpeg;base64,${readFileSync(audioPath).toString('base64')}`
    : '';
  if (!hasAudio) console.warn('  ⚠ Audio file empty — rendering without voiceover');

  let musicSrc = '';
  if (musicPath) {
    try {
      musicSrc = `data:audio/mpeg;base64,${readFileSync(musicPath).toString('base64')}`;
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

  // FIX: concurrency raised from 1 → 2 for ~50% faster rendering on 2-core GitHub Actions runners
  console.log(`  Rendering ${durationInFrames} frames at 1080×1920 (concurrency: 2)...`);
  await renderMedia({
      // FIX: explicitly spread composition with computed durationInFrames override.
      // calculateMetadata should already set this correctly, but spreading ensures the
      // renderer uses the dynamically computed value regardless of Remotion version behavior.
      composition: { ...composition, durationInFrames },
      serveUrl: bundleLocation,
      codec: 'h264',
      // HIGH-QUALITY ENCODING for Facebook: CRF 18 = visually near-lossless.
      // Note: Remotion does not allow crf + videoBitrate simultaneously — crf alone is used.
      // audioBitrate 192k ensures high-quality AAC audio for Facebook re-encoding.
      crf: 18,
      audioBitrate: '192k',
      outputLocation: outputPath,
      inputProps,
      timeoutInMilliseconds: 20 * 60 * 1000,
      concurrency: 2,
    chromiumOptions: {
      disableWebSecurity: true,
      gl: 'swiftshader',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    },
    onProgress: ({ renderedFrames }: any) => {
      if (renderedFrames % 100 === 0 || renderedFrames === durationInFrames) {
        const pct = ((renderedFrames / durationInFrames) * 100).toFixed(0);
        process.stdout.write(`    ↳ ${renderedFrames}/${durationInFrames} frames (${pct}%)\r`);
        if (renderedFrames === durationInFrames) process.stdout.write('\n');
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

// ─── Facebook Comment Generation ──────────────────────────────────────────────

async function generateFacebookComment(topic: string, title: string): Promise<string> {
    const WEBSITE_LINK = 'https://onchain-detectives.free.nf';
    const prompt = `You are an investigative journalist managing a crypto scam awareness Facebook page. Write a professional Facebook comment to pin under a newly published video.

  Video Title: "${title}"
  Scam Type: "${topic}"
  Website for victims: ${WEBSITE_LINK}

  COMMENT STRUCTURE (follow this exact order):
  1. One sentence directly naming the specific scam mechanism shown in the video — make it specific, not generic
  2. One clear warning sentence identifying the key red flag that victims should recognise
  3. One empathetic call-to-action sentence inviting affected viewers to report their case through the website link — frame it as confidential, professional, and free

  QUALITY RULES:
  - Total length: 300–450 characters including the link
  - Tone: professional, empathetic, and authoritative — like a qualified investigator, not a salesperson
  - The link must appear naturally in the CTA sentence, not bolted on at the end
  - Do NOT ask generic engagement questions — be direct and purposeful
  - Do NOT use emojis, hashtags, ALL-CAPS words, or bullet points
  - Do NOT start with "Great video", "Thanks", "Important:", or "Warning:"
  - The comment must comply with Facebook community standards — no misleading claims, no guaranteed recovery promises
  - Return ONLY the comment text with no quotes, labels, or explanation`;

    try {
      return await tryWithKeys('cerebras', async (key) => {
        // max_tokens 2000 — reasoning models need budget for chain-of-thought plus the output text
        const text = await cerebrasChat(key, [{ role: 'user', content: prompt }], 2000);
        const clean = text.replace(/^["']|["']$/g, '').trim();
        return clean.includes(WEBSITE_LINK)
          ? clean.slice(0, 600)
          : `${clean.slice(0, 380)} ${WEBSITE_LINK}`.trim();
      });
    } catch {
      return `This type of operation follows a well-documented pattern — the warning signs are identifiable but easy to miss without prior knowledge. If you or someone you know has been affected by a scam like this, a confidential case review is available at ${WEBSITE_LINK} — free of charge and handled by investigators.`;
    }
  }
  
// Resolve the feed post ID from a video ID (video upload returns video_id, not post_id)
async function getVideoFeedPostId(token: string, videoId: string): Promise<string> {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v20.0/${videoId}?fields=id,posts&access_token=${encodeURIComponent(token)}`
    );
    if (resp.ok) {
      const json: any = await resp.json();
      const postId = json?.posts?.data?.[0]?.id;
      if (postId) {
        console.log(`  🔗 Resolved feed post ID for comment: ${postId}`);
        return postId;
      }
    }
  } catch {}
  // Fallback to video ID if query fails
  console.log(`  🔗 Using video ID directly for comment: ${videoId}`);
  return videoId;
}

async function postFacebookCommentWithRetry(token: string, postId: string, commentText: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(
        `https://graph.facebook.com/v20.0/${postId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: token, message: commentText }),
        }
      );
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Facebook comment API ${resp.status}: ${err.slice(0, 300)}`);
      }
      const json: any = await resp.json();
      console.log(`  💬 Auto-comment posted successfully: ${json.id}`);
      return;
    } catch (e: any) {
      console.warn(`  ⚠ Comment attempt ${attempt}/${maxRetries} failed: ${e.message?.slice(0, 200)}`);
      if (attempt < maxRetries) {
        const waitMs = 5000 * attempt;
        console.log(`  ⏳ Retrying comment in ${waitMs / 1000}s...`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw e;
      }
    }
  }
}

// ─── Facebook Page Publishing ──────────────────────────────────────────────────

async function publishToFacebook(
  videoUrl: string,
  title: string,
  caption: string,
  hashtags: string,
  userId: string,
  postId: string | null,
  topic: string = ''
): Promise<boolean> {
  const { data: fbSettings } = await supabase
    .from('facebook_settings')
    .select('id, page_access_token, page_id, page_name')
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('status', 'failed')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fbSettings?.page_access_token) {
    console.warn('  ⚠ Facebook not configured — skipping publish (add a Page Access Token in Settings)');
    return false;
  }

  const token = fbSettings.page_access_token;
  const pageId = fbSettings.page_id || 'me';
  const description = [caption, hashtags].filter(Boolean).join('\n');

  try {
    // FIX: published:true and privacy.value='EVERYONE' are required for publicly-visible posts;
    // without them Facebook defaults to unpublished/restricted (visible only to page admin).
    const resp = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/videos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: token,
          file_url: videoUrl,
          description: description || undefined,
          title: title || undefined,
          published: true,
          privacy: { value: 'EVERYONE' },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `Facebook API ${resp.status}`;
      try { const ej = JSON.parse(errText); errMsg = ej?.error?.message ?? errMsg; } catch { errMsg = errText.slice(0, 200) || errMsg; }
      throw new Error(errMsg);
    }

    const json: any = await resp.json();
    const fbPostId = json?.id ?? '';
    console.log(`  ✅ Published to Facebook${fbSettings.page_name ? ` (${fbSettings.page_name})` : ''}: post ${fbPostId}`);

    await supabase.from('facebook_settings').update({
      status: 'active',
      last_published_at: new Date().toISOString(),
    }).eq('id', fbSettings.id);

    // Auto-generate and post an engaging comment with the website link
    try {
      console.log('  💬 Generating auto-comment...');
      // Wait for Facebook to finish processing the video before commenting
      await new Promise(r => setTimeout(r, 8000));
      // Resolve feed post ID — video upload returns video_id, comments need the feed post_id
      const commentPostId = await getVideoFeedPostId(token, fbPostId);
      const commentText = await generateFacebookComment(topic || title, title);
      await postFacebookCommentWithRetry(token, commentPostId, commentText);
    } catch (ce: any) {
      console.warn(`  ⚠ Auto-comment failed (non-critical): ${ce.message?.slice(0, 200)}`);
    }

    return true;
  } catch (e: any) {
    console.warn(`  ⚠ Facebook publish failed: ${e.message?.slice(0, 120)}`);
    await supabase.from('facebook_settings').update({ status: 'failed' }).eq('id', fbSettings.id);
    return false;
  }
}

// ─── Proteus Cleanup Engine — Post-Render Storage Pruning ─────────────────────

async function proteusPostRenderCleanup(userId: string, currentVideoPath: string, currentThumbPath: string): Promise<void> {
  try {
    console.log('  🧹 Proteus Cleanup Engine — pruning orphaned storage objects...');

    // List all objects in videos/{userId}/ and thumbnails/{userId}/
    const [videoList, thumbList] = await Promise.all([
      supabase.storage.from('videos').list(`videos/${userId}`, { limit: 200 }),
      supabase.storage.from('videos').list(`thumbnails/${userId}`, { limit: 200 }),
    ]);

    // Get all valid video URLs from the DB for this user
    const { data: validPosts } = await supabase
      .from('posts')
      .select('video_url, thumbnail_url')
      .eq('user_id', userId)
      .in('status', ['published', 'rendered'])
      .not('video_url', 'is', null);

    const validVideoNames = new Set<string>();
    const validThumbNames = new Set<string>();
    for (const p of (validPosts ?? [])) {
      if (p.video_url) {
        const name = p.video_url.split('/').pop();
        if (name) validVideoNames.add(name);
      }
      if (p.thumbnail_url) {
        const name = p.thumbnail_url.split('/').pop();
        if (name) validThumbNames.add(name);
      }
    }

    // Also protect the just-uploaded files
    validVideoNames.add(currentVideoPath.split('/').pop() ?? '');
    validThumbNames.add(currentThumbPath.split('/').pop() ?? '');

    // Delete orphaned video objects (no matching DB record, older than 1 hour)
    const staleVideos = (videoList.data ?? []).filter(f => {
      if (validVideoNames.has(f.name)) return false;
      const age = Date.now() - new Date(f.updated_at ?? f.created_at ?? 0).getTime();
      return age > 60 * 60 * 1000; // older than 1 hour
    });

    const staleVideoKeys = staleVideos.map(f => `videos/${userId}/${f.name}`);
    if (staleVideoKeys.length > 0) {
      const { error } = await supabase.storage.from('videos').remove(staleVideoKeys);
      if (!error) console.log(`     → Deleted ${staleVideoKeys.length} orphaned video object(s)`);
    }

    // Delete orphaned thumbnail objects
    const staleThumbs = (thumbList.data ?? []).filter(f => {
      if (validThumbNames.has(f.name)) return false;
      const age = Date.now() - new Date(f.updated_at ?? f.created_at ?? 0).getTime();
      return age > 60 * 60 * 1000;
    });

    const staleThumbKeys = staleThumbs.map(f => `thumbnails/${userId}/${f.name}`);
    if (staleThumbKeys.length > 0) {
      const { error } = await supabase.storage.from('videos').remove(staleThumbKeys);
      if (!error) console.log(`     → Deleted ${staleThumbKeys.length} orphaned thumbnail object(s)`);
    }

    if (staleVideoKeys.length === 0 && staleThumbKeys.length === 0) {
      console.log('     → Storage is clean — no orphaned objects found');
    }

    // Log cleanup event
    try {
      await supabase.from('cleanup_logs').insert({
        triggered_by: 'post_render',
        user_id: userId,
        videos_deleted: staleVideoKeys.length,
        thumbs_deleted: staleThumbKeys.length,
        notes: `Post-render cleanup for schedule pipeline`,
      });
    } catch { /* cleanup log table may not exist yet — non-critical */ }

  } catch (e: any) {
    console.warn(`  ⚠ Proteus cleanup warning: ${e.message?.slice(0, 120)}`);
  }
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
      status: 'pending',
      last_run_status: 'failed',
      last_error: msg.slice(0, 500),
      execution_time_ms: elapsed,
      error_message: msg.slice(0, 500),
      scheduled_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
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

    // 3. Voiceover + caption/hashtags — run in parallel for speed
    console.log('  3/8 Generating voiceover + timestamps + caption (parallel)...');
    const [voiceoverResult, captionResult] = await Promise.all([
      generateVoiceoverWithTimestamps(script),
      generateCaptionAndHashtags(topic, niche, title, script),
    ]);

    const { audioBuffer, wordTimestamps } = voiceoverResult;
    const { caption, hashtags } = captionResult;
    const audioPath = join(tmpDir, 'voice.mp3');
    writeFileSync(audioPath, audioBuffer);
    console.log(`     → Audio: ${(audioBuffer.byteLength / 1024).toFixed(0)} KB`);
    console.log(`     → Caption ready | Hashtags: ${hashtags.split(' ').length} tags`);
    if (postId) await supabase.from('posts').update({ caption, hashtags }).eq('id', postId);

    // FIX: Sequential image generation — parallel calls hit Cloudflare rate limit simultaneously.
    // Music downloads concurrently while images are generated one at a time.
    console.log('  4/8 Generating 5 scene images (sequential) + downloading music (parallel)...');
    const videoVariant = Math.floor((Date.now() / 1000) % 10000);
    const imageSlots: Array<string | null> = new Array(scenes.length).fill(null);

    const [musicPath] = await Promise.all([
      downloadBackgroundMusic(tmpDir),
      (async () => {
        for (let i = 0; i < scenes.length; i++) {
          try {
            const imgBuf = await generateImage(scenes[i], i, videoVariant);
            const imgPath = join(tmpDir, `scene_${i}.jpg`);
            writeFileSync(imgPath, imgBuf);
            imageSlots[i] = imgPath;
            console.log(`     → Scene ${i + 1}/${scenes.length}: ${(imgBuf.byteLength / 1024).toFixed(0)} KB ✓`);
          } catch (e: any) {
            console.warn(`     ⚠ Scene ${i + 1} failed: ${e.message?.slice(0, 80)} — using gradient`);
            const pp = join(tmpDir, `scene_${i}.jpg`);
            try {
              const gradients = ['gradient:#0d0d2b-#1a0030', 'gradient:#0a1628-#1a2855', 'gradient:#1a0000-#3d0010', 'gradient:#001a1a-#00333a', 'gradient:#1a1500-#3d3000'];
              execSync(`convert -size 1080x1920 "${gradients[i % gradients.length]}" -quality 75 "${pp}" 2>/dev/null`);
              if (existsSync(pp) && statSync(pp).size > 500) imageSlots[i] = pp;
            } catch { /* skip this scene */ }
          }
        }
      })(),
    ]);
    const imagePaths = imageSlots.filter((p): p is string => p !== null && typeof p === 'string');
    if (imagePaths.length === 0) {
      throw new Error('All scene images failed to generate — cannot create video');
    }
    console.log(`     → ${imagePaths.length}/${scenes.length} scenes ready | Music: ${musicPath ? '✓' : '✗ (voiceover only)'}`);

    // 5. Caption already done above — skip old step numbering
    console.log(`  5/8 Caption: "${caption.slice(0, 60)}..."`);

    // 6. Remotion render
    console.log('  6/8 Rendering professional video with Remotion...');
    const videoPath = join(tmpDir, 'final.mp4');
    await assembleVideoWithRemotion(imagePaths, audioPath, musicPath, videoPath, script, title, wordTimestamps);
    let _rawSize = readFileSync(videoPath).byteLength;
    console.log(`     → Raw: ${(_rawSize / 1024 / 1024).toFixed(1)} MB — optimizing...`);

    // Post-process: re-mux for web delivery (faststart + audio normalisation)
    try {
      const _cPath = videoPath.replace('.mp4', '_opt.mp4');
      execSync(
        `ffmpeg -i "${videoPath}" -c:v libx264 -crf 23 -preset fast -profile:v high -c:a aac -b:a 128k -movflags +faststart -y "${_cPath}" 2>&1`,
        { timeout: 300000 }
      );
      if (existsSync(_cPath) && statSync(_cPath).size > 100000) {
        const _cSize = statSync(_cPath).size;
        console.log(`     → Optimized: ${(_cSize/1024/1024).toFixed(1)} MB (${Math.round((1-_cSize/_rawSize)*100)}% smaller)`);
        execSync(`mv "${_cPath}" "${videoPath}"`);
      }
    } catch (_ce: any) {
      console.warn(`     ⚠ Post-processing skipped: ${_ce.message?.slice(0, 60)}`);
    }

    const videoSize = readFileSync(videoPath).byteLength;
    console.log(`     → Final: ${(videoSize/1024/1024).toFixed(1)} MB`);

    // 7. Upload to Supabase Storage
    console.log('  7/8 Uploading to Supabase Storage...');
    const timestamp = Date.now();
    const userId = schedule.user_id;
    const storagePath = `videos/${userId}/${timestamp}.mp4`;
    const thumbPath = `thumbnails/${userId}/${timestamp}.jpg`;
    const videoUrl = await uploadFile(videoPath, storagePath, 'video/mp4');
    const thumbUrl = await uploadFile(imagePaths[0], thumbPath, 'image/jpeg');
    console.log(`     → ${videoUrl}`);

    if (postId) {
      await supabase.from('posts').update({
        video_url: videoUrl,
        thumbnail_url: thumbUrl,
        status: 'rendered',
      }).eq('id', postId);
    }

    // 8. Publish to Facebook Page
    console.log('  8/8 Publishing to Facebook Page...');
    const facebookOk = await publishToFacebook(videoUrl, title, caption, hashtags, userId, postId, topic);

    const elapsed = Date.now() - startTime;

    if (postId) {
      await supabase.from('posts').update({
        status: facebookOk ? 'published' : 'rendered',
        publish_result: facebookOk ? `facebook:published` : 'no_facebook_config',
        published_at: facebookOk ? new Date().toISOString() : null,
      }).eq('id', postId);
    }

    await supabase.from('schedules').update({
      status: 'pending',
      last_run_at: new Date().toISOString(),
      last_run_status: 'success',
      last_topic: topic,
      last_error: null,
      execution_time_ms: elapsed,
      scheduled_time: new Date(Date.now() + 86400000).toISOString(),
    }).eq('id', schedule.id);

    console.log(`  ✅ Done in ${(elapsed / 1000).toFixed(1)}s — ${facebookOk ? 'published to Facebook' : 'stored: ' + videoUrl}`);

    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title: facebookOk ? 'Published to Facebook' : 'Video Generated',
        message: facebookOk
          ? `"${title}" has been published to your Facebook Page.`
          : `"${title}" has been generated. Configure Facebook in Settings to auto-publish.`,
        type: 'success',
        post_id: postId ?? null,
      });
    } catch { /* non-critical */ }

    // Run Proteus Cleanup Engine after successful render
    await proteusPostRenderCleanup(userId, storagePath, thumbPath);

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
  const required = ['cerebras', 'unrealspeech'];
  const missing = required.filter(s => !servicesPresent.has(s));

  if (missing.length > 0) {
    console.warn(`⚠ API keys not yet configured for: ${missing.join(', ')} — skipping this run.`);
    console.warn('   → Add your API keys via the Settings page in the AutoViral dashboard.');
    process.exit(0); // Graceful exit: no API keys configured yet
  }

  const hasCF = servicesPresent.has('cloudflare') && servicesPresent.has('cloudflare_id');
  if (!hasCF) {
    console.warn('⚠ No Cloudflare AI keys — image generation will use Pollinations AI (free fallback)');
  }

  const now = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - 45 * 60 * 1000).toISOString();

  const [pendingRes, staleRes] = await Promise.all([
    supabase.from('schedules').select('*').eq('status', 'pending').lte('scheduled_time', now),
    supabase.from('schedules').select('*').eq('status', 'running').lte('last_run_at', staleThreshold),
  ]);

  if (pendingRes.error) {
    console.error('Failed to fetch pending schedules:', pendingRes.error.message);
    process.exit(1);
  }

  const staleSchedules = (staleRes.data ?? []).map((s: any) => ({ ...s, _stale: true }));
  if (staleSchedules.length > 0) {
    console.log(`Found ${staleSchedules.length} stale running schedule(s) — resetting and re-running`);
    for (const s of staleSchedules) {
      await supabase.from('schedules').update({ status: 'pending' }).eq('id', s.id);
    }
  }

  const schedules = [...(pendingRes.data ?? []), ...staleSchedules];

  if (schedules.length === 0) {
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
