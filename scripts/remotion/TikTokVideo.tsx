import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';

export interface SubtitleTiming {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface TikTokVideoProps {
  scenes: string[];
  audioSrc: string;
  musicSrc?: string;
  script: string;
  title: string;
  durationInFrames: number;
  /** Pre-calculated word-level subtitle timings from the pipeline (preferred over heuristic) */
  subtitleTimings?: SubtitleTiming[];
}

function formatTitle(title: string): string {
  return title.length > 60 ? title.slice(0, 57) + '...' : title;
}

/**
 * Character-count-based fallback subtitle timing.
 * Only used when subtitleTimings are not provided from the pipeline.
 */
function buildFallbackChunks(
  words: string[],
  audioDurationFrames: number,
  chunkSize: number,
): SubtitleTiming[] {
  if (words.length === 0) return [];
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const chunks: SubtitleTiming[] = [];
  let charsSoFar = 0;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const chunkChars = chunk.reduce((s, w) => s + w.length, 0);
    const startFrame = Math.round((charsSoFar / totalChars) * audioDurationFrames);
    charsSoFar += chunkChars;
    const endFrame = Math.round((charsSoFar / totalChars) * audioDurationFrames);
    chunks.push({ text: chunk.join(' ').toUpperCase(), startFrame, endFrame });
  }
  return chunks;
}

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  scenes,
  audioSrc,
  musicSrc,
  script,
  title,
  durationInFrames,
  subtitleTimings,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Scene Management ──────────────────────────────────────────────────────
  const sceneCount = Math.max(scenes.length, 1);
  const framesPerScene = Math.ceil(durationInFrames / sceneCount);
  const currentScene = Math.min(Math.floor(frame / framesPerScene), sceneCount - 1);
  const sceneLocalFrame = frame - currentScene * framesPerScene;

  // Ken Burns — zoom + drift alternates per scene
  const kenBurnsScale = interpolate(
    sceneLocalFrame,
    [0, framesPerScene],
    [1.0, 1.08],
    { extrapolateRight: 'clamp' }
  );
  const kenBurnsX = currentScene % 2 === 0
    ? interpolate(sceneLocalFrame, [0, framesPerScene], [0, 1.5], { extrapolateRight: 'clamp' })
    : interpolate(sceneLocalFrame, [0, framesPerScene], [0, -1.5], { extrapolateRight: 'clamp' });

  // ── Subtitle Engine ────────────────────────────────────────────────────────
  const OUTRO_FRAMES = Math.round(2.0 * fps);
  const audioDurationFrames = durationInFrames - OUTRO_FRAMES;

  const words = script.trim().split(/\s+/).filter(Boolean);
  const CHUNK = 3;

  const resolvedTimings: SubtitleTiming[] =
    subtitleTimings && subtitleTimings.length > 0
      ? subtitleTimings
      : buildFallbackChunks(words, audioDurationFrames, CHUNK);

  const activeChunk = resolvedTimings.find(
    c => frame >= c.startFrame && frame < c.endFrame
  ) ?? null;

  const subtitle = activeChunk?.text ?? '';
  const localChunkFrame = activeChunk ? Math.max(0, frame - activeChunk.startFrame) : 0;
  const chunkDuration = activeChunk ? activeChunk.endFrame - activeChunk.startFrame : 1;

  // Pop-in spring animation — punchy TikTok style
  const bounceIn = spring({
    frame: Math.min(localChunkFrame, 8),
    fps,
    config: { damping: 18, stiffness: 700, mass: 0.25 },
  });
  const subtitleScale = interpolate(bounceIn, [0, 1], [0.78, 1.0]);

  // Fade in fast, fade out in last 20% of chunk duration
  const fadeInFrames = 4;
  const fadeOutStart = Math.max(chunkDuration - 6, Math.floor(chunkDuration * 0.8));
  const fadeIn = interpolate(localChunkFrame, [0, fadeInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localChunkFrame, [fadeOutStart, chunkDuration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subtitleOpacity = Math.min(fadeIn, fadeOut);

  // ── Global Fade-in / Fade-out ─────────────────────────────────────────────
  const globalFadeIn  = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const globalFadeOut = interpolate(frame, [durationInFrames - 18, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const globalOpacity = Math.min(globalFadeIn, globalFadeOut);

  // ── Progress Bar ──────────────────────────────────────────────────────────
  const progress = frame / durationInFrames;

  // ── Outro CTA boost ───────────────────────────────────────────────────────
  const isOutro = frame >= audioDurationFrames;
  const ctaScale = isOutro
    ? interpolate(frame, [audioDurationFrames, audioDurationFrames + fps * 0.4], [1, 1.05], { extrapolateRight: 'clamp' })
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050508', opacity: globalOpacity }}>

      {/* ── Voiceover ─────────────────────────────────────────────────── */}
      {audioSrc && <Audio src={audioSrc} volume={1.0} />}

      {/* ── Background Music (low volume, looped) ─────────────────────── */}
      {musicSrc && <Audio src={musicSrc} volume={0.10} loop />}

      {/* ── Scene Images with Ken Burns ───────────────────────────────── */}
      {scenes.map((src, i) => {
        const from = i * framesPerScene;
        const dur = i < sceneCount - 1
          ? framesPerScene + 10
          : Math.max(durationInFrames - from, framesPerScene);
        const isActive = currentScene === i;

        const sceneFadeIn = i === 0
          ? 1
          : interpolate(frame - from, [0, 10], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <AbsoluteFill style={{ opacity: sceneFadeIn }}>
              <Img
                src={src}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: isActive
                    ? `scale(${kenBurnsScale}) translateX(${kenBurnsX}%)`
                    : 'scale(1.0)',
                  transformOrigin: 'center center',
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* ── Cinematic Gradient Overlay ─────────────────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.0) 20%, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.90) 100%)',
        }}
      />

      {/* ── SCAM ALERT Badge (top-left) ────────────────────────────────── */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '52px 44px 0' }}>
        <div
          style={{
            background: 'rgba(220,30,0,0.93)',
            borderRadius: 10,
            padding: '10px 22px',
            border: '2px solid rgba(255,100,0,0.85)',
            boxShadow: '0 2px 20px rgba(220,30,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>⚠️</span>
          <span
            style={{
              color: '#fff',
              fontSize: 24,
              fontWeight: 900,
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            SCAM ALERT
          </span>
        </div>
      </AbsoluteFill>

      {/* ── Title (upper area) ────────────────────────────────────────── */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '164px 44px 0' }}>
        <p
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: '#fff',
            fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
            lineHeight: 1.2,
            margin: 0,
            textTransform: 'uppercase',
            textShadow: '0 2px 24px rgba(0,0,0,1), 0 0 50px rgba(0,0,0,0.9)',
            maxWidth: '92%',
          }}
        >
          {formatTitle(title).toUpperCase()}
        </p>
      </AbsoluteFill>

      {/* ── SUBTITLES — Modern viral TikTok style, transparent bg ─────── */}
      {subtitle.length > 0 && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            paddingTop: '30%',
          }}
        >
          <div
            style={{
              opacity: subtitleOpacity,
              transform: `scale(${subtitleScale})`,
              maxWidth: '88%',
              textAlign: 'center',
              background: 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <p
              style={{
                fontSize: 72,
                fontWeight: 900,
                color: '#FFFFFF',
                textAlign: 'center',
                fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
                textTransform: 'uppercase',
                lineHeight: 1.1,
                margin: 0,
                letterSpacing: 3,
                textShadow: [
                  '-3px -3px 0 #000',
                  ' 3px -3px 0 #000',
                  '-3px  3px 0 #000',
                  ' 3px  3px 0 #000',
                  '-3px  0px 0 #000',
                  ' 3px  0px 0 #000',
                  ' 0px -3px 0 #000',
                  ' 0px  3px 0 #000',
                  '0 0 30px rgba(255,255,255,0.15)',
                ].join(', '),
              }}
            >
              {subtitle}
            </p>
          </div>
        </AbsoluteFill>
      )}

      {/* ── FOLLOW CTA (bottom) ───────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 44px 120px',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #fe2c55 0%, #c0392b 100%)',
            borderRadius: 100,
            padding: '18px 52px',
            boxShadow: '0 6px 32px rgba(254,44,85,0.65)',
            transform: `scale(${ctaScale})`,
          }}
        >
          <span
            style={{
              color: '#fff',
              fontSize: 30,
              fontWeight: 900,
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            FOLLOW FOR MORE ALERTS
          </span>
        </div>
      </AbsoluteFill>

      {/* ── Progress Bar ──────────────────────────────────────────────── */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 90px' }}>
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.10)' }}>
          <div
            style={{
              width: `${Math.min(progress * 100, 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #fe2c55, #ff6b35)',
              boxShadow: '0 0 18px rgba(254,44,85,0.9)',
            }}
          />
        </div>
      </AbsoluteFill>

    </AbsoluteFill>
  );
};
