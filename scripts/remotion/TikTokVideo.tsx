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
  /** Real word-level subtitle timings from UnrealSpeech timestamps API (preferred) */
  subtitleTimings?: SubtitleTiming[];
  /** Total audio-only duration in frames (the rest is outro) */
  audioDurationFrames?: number;
}

function formatTitle(title: string): string {
  return title.length > 60 ? title.slice(0, 57) + '...' : title;
}

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

// ── Outro overlay — shown after voiceover ends ──────────────────────────────
const OutroCard: React.FC<{ frame: number; fps: number; outroStart: number }> = ({
  frame,
  fps,
  outroStart,
}) => {
  const local = frame - outroStart;

  const bgOpacity = interpolate(local, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const titleScale = spring({
    frame: Math.max(0, local - 6),
    fps,
    config: { damping: 14, stiffness: 380, mass: 0.45 },
  });
  const titleTransform = interpolate(titleScale, [0, 1], [0.78, 1.0]);
  const titleOpacity = interpolate(local, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  const subScale = spring({
    frame: Math.max(0, local - 20),
    fps,
    config: { damping: 16, stiffness: 340, mass: 0.5 },
  });
  const subTransform = interpolate(subScale, [0, 1], [0.82, 1.0]);
  const subOpacity = interpolate(local, [16, 34], [0, 1], { extrapolateRight: 'clamp' });

  const btnScale = spring({
    frame: Math.max(0, local - 34),
    fps,
    config: { damping: 12, stiffness: 310, mass: 0.55 },
  });
  const btnTransform = interpolate(btnScale, [0, 1], [0.75, 1.0]);
  const btnOpacity = interpolate(local, [30, 50], [0, 1], { extrapolateRight: 'clamp' });

  // Gentle continuous pulse on the DM button
  const pulse = Math.max(local - 60, 0) % 50;
  const pulseFactor = interpolate(pulse, [0, 25, 50], [1.0, 1.035, 1.0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  const arrowOpacity = interpolate(local, [50, 68], [0, 1], { extrapolateRight: 'clamp' });
  const arrowBounce = interpolate((local % 40), [0, 20, 40], [0, 12, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

  return (
    <AbsoluteFill>
      {/* Dark tinted overlay */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(4,4,10,0.88) 0%, rgba(4,4,10,0.97) 100%)',
          opacity: bgOpacity,
        }}
      />

      {/* Centered content column */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          gap: 0,
          paddingBottom: '8%',
        }}
      >
        {/* "BEEN SCAMMED?" */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleTransform})`,
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          <p
            style={{
              fontSize: 88,
              fontWeight: 900,
              color: '#FE2C55',
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: 2,
              lineHeight: 1.0,
              margin: 0,
              textShadow: '0 0 48px rgba(254,44,85,0.65), 0 4px 24px rgba(0,0,0,0.9)',
            }}
          >
            BEEN SCAMMED?
          </p>
        </div>

        {/* Sub message */}
        <div
          style={{
            opacity: subOpacity,
            transform: `scale(${subTransform})`,
            textAlign: 'center',
            marginBottom: 44,
            maxWidth: 820,
            paddingLeft: 40,
            paddingRight: 40,
          }}
        >
          <p
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: 'rgba(255,255,255,0.92)',
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: 1,
              lineHeight: 1.35,
              margin: 0,
              textShadow: '0 2px 16px rgba(0,0,0,0.95)',
            }}
          >
            WE MAY HELP YOU RECOVER{'\n'}YOUR FUNDS
          </p>
        </div>

        {/* DM button */}
        <div
          style={{
            opacity: btnOpacity,
            transform: `scale(${btnTransform * pulseFactor})`,
            background: 'linear-gradient(135deg, #FE2C55 0%, #b02040 100%)',
            borderRadius: 100,
            padding: '24px 70px',
            boxShadow: '0 8px 48px rgba(254,44,85,0.72), 0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <p
            style={{
              fontSize: 40,
              fontWeight: 900,
              color: '#ffffff',
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: 3,
              margin: 0,
            }}
          >
            DM US ON TIKTOK
          </p>
        </div>

        {/* Bouncing arrow */}
        <div
          style={{
            opacity: arrowOpacity,
            marginTop: 28,
            transform: `translateY(${arrowBounce}px)`,
          }}
        >
          <p style={{ fontSize: 64, margin: 0, lineHeight: 1 }}>👇</p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  scenes,
  audioSrc,
  musicSrc,
  script,
  title,
  durationInFrames,
  subtitleTimings,
  audioDurationFrames: audioDurationFramesProp,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Timing boundaries ─────────────────────────────────────────────────────
  // audioDurationFrames passed from pipeline; fallback = 88% of total (leaves 12% for outro)
  const OUTRO_FRAMES = Math.round(5.0 * fps);
  const audioDurationFrames = audioDurationFramesProp
    ?? Math.max(durationInFrames - OUTRO_FRAMES, Math.round(durationInFrames * 0.88));

  const isOutro = frame >= audioDurationFrames;

  // ── Scene Management ──────────────────────────────────────────────────────
  const sceneCount = Math.max(scenes.length, 1);
  const framesPerScene = Math.ceil(audioDurationFrames / sceneCount);
  const currentScene = Math.min(Math.floor(frame / framesPerScene), sceneCount - 1);
  const sceneLocalFrame = frame - currentScene * framesPerScene;

  // Ken Burns: alternating zoom + drift per scene
  const kenBurnsScale = interpolate(
    sceneLocalFrame,
    [0, framesPerScene],
    [1.0, 1.09],
    { extrapolateRight: 'clamp' }
  );
  const kenBurnsX = currentScene % 2 === 0
    ? interpolate(sceneLocalFrame, [0, framesPerScene], [0, 1.8], { extrapolateRight: 'clamp' })
    : interpolate(sceneLocalFrame, [0, framesPerScene], [0, -1.8], { extrapolateRight: 'clamp' });

  // ── Subtitle Engine ────────────────────────────────────────────────────────
  const words = script.trim().split(/\s+/).filter(Boolean);
  const CHUNK = 3;

  const resolvedTimings: SubtitleTiming[] =
    subtitleTimings && subtitleTimings.length > 0
      ? subtitleTimings
      : buildFallbackChunks(words, audioDurationFrames, CHUNK);

  const activeChunk = (!isOutro)
    ? (resolvedTimings.find(c => frame >= c.startFrame && frame < c.endFrame) ?? null)
    : null;

  const subtitle = activeChunk?.text ?? '';
  const localChunkFrame = activeChunk ? Math.max(0, frame - activeChunk.startFrame) : 0;
  const chunkDuration = activeChunk ? Math.max(activeChunk.endFrame - activeChunk.startFrame, 1) : 1;

  // Punchy TikTok spring pop-in
  const bounceIn = spring({
    frame: Math.min(localChunkFrame, 10),
    fps,
    config: { damping: 13, stiffness: 650, mass: 0.28 },
  });
  const subtitleScale = interpolate(bounceIn, [0, 1], [0.70, 1.0]);

  // Fast fade-in, fade-out in last 15% of chunk
  const fadeInFrames = 3;
  const fadeOutStart = Math.max(chunkDuration - 5, Math.floor(chunkDuration * 0.84));
  const fadeIn = interpolate(localChunkFrame, [0, fadeInFrames], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localChunkFrame, [fadeOutStart, chunkDuration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subtitleOpacity = Math.min(fadeIn, fadeOut);

  // ── Global Fade-in / Fade-out ─────────────────────────────────────────────
  const globalFadeIn  = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const globalFadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const globalOpacity = Math.min(globalFadeIn, globalFadeOut);

  // ── Progress Bar ──────────────────────────────────────────────────────────
  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: '#050508', opacity: globalOpacity }}>

      {/* ── Voiceover ───────────────────────────────────────────────────── */}
      {audioSrc && <Audio src={audioSrc} volume={1.0} />}

      {/* ── Background Music ────────────────────────────────────────────── */}
      {musicSrc && <Audio src={musicSrc} volume={isOutro ? 0.18 : 0.10} loop />}

      {/* ── Scene Images (full video length — last scene holds through outro) */}
      {scenes.map((src, i) => {
        const from = i * framesPerScene;
        const dur = i < sceneCount - 1
          ? framesPerScene + 10
          : Math.max(durationInFrames - from, framesPerScene);

        const isActive = currentScene === i;
        const sceneFadeIn = i === 0
          ? 1
          : interpolate(frame - from, [0, 10], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });

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

      {/* ── Cinematic Gradient Overlay ───────────────────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.0) 22%, rgba(0,0,0,0.0) 48%, rgba(0,0,0,0.92) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── SCAM ALERT Badge (hidden during outro) ────────────────────── */}
      {!isOutro && (
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '52px 44px 0' }}>
          <div
            style={{
              background: 'rgba(220,30,0,0.94)',
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
      )}

      {/* ── Title (hidden during outro) ────────────────────────────────── */}
      {!isOutro && (
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
      )}

      {/* ── SUBTITLES — true center, transparent bg, BOLD CAPS ──────────── */}
      {!isOutro && subtitle.length > 0 && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              opacity: subtitleOpacity,
              transform: `scale(${subtitleScale})`,
              maxWidth: '86%',
              textAlign: 'center',
              background: 'transparent',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <p
              style={{
                fontSize: 78,
                fontWeight: 900,
                color: '#FFFFFF',
                textAlign: 'center',
                fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
                textTransform: 'uppercase',
                lineHeight: 1.1,
                margin: 0,
                letterSpacing: 2,
                textShadow: [
                  '-3px -3px 0 #000',
                  ' 3px -3px 0 #000',
                  '-3px  3px 0 #000',
                  ' 3px  3px 0 #000',
                  '-3px  0px 0 #000',
                  ' 3px  0px 0 #000',
                  ' 0px -3px 0 #000',
                  ' 0px  3px 0 #000',
                  '0 0 40px rgba(255,255,255,0.18)',
                ].join(', '),
              }}
            >
              {subtitle}
            </p>
          </div>
        </AbsoluteFill>
      )}

      {/* ── FOLLOW CTA button (hidden during outro) ──────────────────────── */}
      {!isOutro && (
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
      )}

      {/* ── Progress Bar ─────────────────────────────────────────────────── */}
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

      {/* ── OUTRO CARD — "Been Scammed? DM Us" ──────────────────────────── */}
      {isOutro && (
        <OutroCard frame={frame} fps={fps} outroStart={audioDurationFrames} />
      )}

    </AbsoluteFill>
  );
};
