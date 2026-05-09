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
  /** Real word-level subtitle timings from UnrealSpeech timestamps API */
  subtitleTimings?: SubtitleTiming[];
  /** Total audio-only duration in frames (the rest is outro) */
  audioDurationFrames?: number;
}

function formatTitle(title: string): string {
  return title.length > 60 ? title.slice(0, 57) + '...' : title;
}

/** Heuristic fallback: one word per timing entry, spread evenly across audio */
function buildFallbackChunks(
  words: string[],
  audioDurationFrames: number,
): SubtitleTiming[] {
  if (words.length === 0) return [];
  const framesPerWord = audioDurationFrames / words.length;
  return words.map((word, i) => ({
    text: word.toUpperCase(),
    startFrame: Math.round(i * framesPerWord),
    endFrame: Math.min(Math.round((i + 1) * framesPerWord), audioDurationFrames),
  }));
}

// ── Outro Card ─────────────────────────────────────────────────────────────────
const OutroCard: React.FC<{ frame: number; fps: number; outroStart: number }> = ({
  frame,
  fps,
  outroStart,
}) => {
  const local = frame - outroStart;

  const bgOpacity = interpolate(local, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  // "BEEN SCAMMED?" — springs in first
  const titleSpring = spring({ frame: Math.max(0, local - 4), fps, config: { damping: 12, stiffness: 420, mass: 0.4 } });
  const titleScale = interpolate(titleSpring, [0, 1], [0.72, 1.0]);
  const titleOpacity = interpolate(local, [0, 14], [0, 1], { extrapolateRight: 'clamp' });

  // Sub-line appears second
  const subSpring = spring({ frame: Math.max(0, local - 18), fps, config: { damping: 14, stiffness: 360, mass: 0.5 } });
  const subScale = interpolate(subSpring, [0, 1], [0.78, 1.0]);
  const subOpacity = interpolate(local, [14, 30], [0, 1], { extrapolateRight: 'clamp' });

  // DM button springs in third
  const btnSpring = spring({ frame: Math.max(0, local - 32), fps, config: { damping: 11, stiffness: 300, mass: 0.6 } });
  const btnScale = interpolate(btnSpring, [0, 1], [0.68, 1.0]);
  const btnOpacity = interpolate(local, [28, 46], [0, 1], { extrapolateRight: 'clamp' });

  // Continuous gentle pulse on the button after entry
  const pulseCycle = Math.max(local - 55, 0) % 48;
  const pulse = interpolate(pulseCycle, [0, 24, 48], [1.0, 1.04, 1.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Arrow bounce
  const arrowOpacity = interpolate(local, [48, 62], [0, 1], { extrapolateRight: 'clamp' });
  const arrowBounce = interpolate(local % 38, [0, 19, 38], [0, 10, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Free text line
  const freeOpacity = interpolate(local, [60, 74], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      {/* Dark overlay */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(2,2,8,0.92) 0%, rgba(2,2,8,0.98) 100%)',
          opacity: bgOpacity,
        }}
      />

      {/* Red accent glow lines */}
      <AbsoluteFill style={{ opacity: bgOpacity * 0.6 }}>
        <div style={{ position: 'absolute', top: '18%', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #FE2C55, transparent)' }} />
        <div style={{ position: 'absolute', bottom: '18%', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, #FE2C55, transparent)' }} />
      </AbsoluteFill>

      {/* Content column */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          flexDirection: 'column',
          paddingBottom: '6%',
        }}
      >
        {/* BEEN SCAMMED? */}
        <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})`, textAlign: 'center', marginBottom: 16 }}>
          <p style={{
            fontSize: 96,
            fontWeight: 900,
            color: '#FE2C55',
            fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 3,
            lineHeight: 1.0,
            margin: 0,
            textShadow: '0 0 60px rgba(254,44,85,0.75), 0 0 20px rgba(254,44,85,0.5), 0 4px 28px rgba(0,0,0,1)',
          }}>
            BEEN SCAMMED?
          </p>
        </div>

        {/* Sub-line */}
        <div style={{ opacity: subOpacity, transform: `scale(${subScale})`, textAlign: 'center', marginBottom: 48, maxWidth: 840, paddingLeft: 40, paddingRight: 40 }}>
          <p style={{
            fontSize: 40,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.95)',
            fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 2,
            lineHeight: 1.3,
            margin: 0,
            textShadow: '0 2px 20px rgba(0,0,0,1)',
          }}>
            WE MAY BE ABLE TO HELP{'\n'}YOU RECOVER YOUR FUNDS
          </p>
        </div>

        {/* DM button with pulse */}
        <div style={{
          opacity: btnOpacity,
          transform: `scale(${btnScale * pulse})`,
          background: 'linear-gradient(135deg, #FE2C55 0%, #a01535 100%)',
          borderRadius: 120,
          padding: '26px 74px',
          boxShadow: '0 0 60px rgba(254,44,85,0.80), 0 8px 40px rgba(254,44,85,0.55), 0 2px 8px rgba(0,0,0,0.6)',
          border: '3px solid rgba(255,120,140,0.4)',
        }}>
          <p style={{
            fontSize: 44,
            fontWeight: 900,
            color: '#FFFFFF',
            fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 4,
            margin: 0,
            textShadow: '0 2px 12px rgba(0,0,0,0.6)',
          }}>
            DM US ON TIKTOK
          </p>
        </div>

        {/* Bouncing arrow */}
        <div style={{ opacity: arrowOpacity, marginTop: 30, transform: `translateY(${arrowBounce}px)` }}>
          <p style={{ fontSize: 72, margin: 0, lineHeight: 1 }}>👇</p>
        </div>

        {/* Free line */}
        <div style={{ opacity: freeOpacity, marginTop: 22 }}>
          <p style={{
            fontSize: 28,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.55)',
            fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: 3,
            margin: 0,
            textAlign: 'center',
          }}>
            CONSULTATION IS FREE
          </p>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
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

  // ── Timing ─────────────────────────────────────────────────────────────────
  const OUTRO_FRAMES = Math.round(5.0 * fps);
  const audioDurationFrames = audioDurationFramesProp
    ?? Math.max(durationInFrames - OUTRO_FRAMES, Math.round(durationInFrames * 0.88));

  const isOutro = frame >= audioDurationFrames;

  // ── Scene Management ───────────────────────────────────────────────────────
  const sceneCount = Math.max(scenes.length, 1);
  const framesPerScene = Math.ceil(audioDurationFrames / sceneCount);
  const currentScene = Math.min(Math.floor(frame / framesPerScene), sceneCount - 1);
  const sceneLocalFrame = frame - currentScene * framesPerScene;

  // Ken Burns: alternating zoom + drift
  const kenBurnsScale = interpolate(sceneLocalFrame, [0, framesPerScene], [1.0, 1.10], { extrapolateRight: 'clamp' });
  const kenBurnsX = currentScene % 2 === 0
    ? interpolate(sceneLocalFrame, [0, framesPerScene], [0, 1.6], { extrapolateRight: 'clamp' })
    : interpolate(sceneLocalFrame, [0, framesPerScene], [0, -1.6], { extrapolateRight: 'clamp' });

  // ── Subtitle Engine — one word at a time ───────────────────────────────────
  const words = script.trim().split(/\s+/).filter(Boolean);

  const resolvedTimings: SubtitleTiming[] =
    subtitleTimings && subtitleTimings.length > 0
      ? subtitleTimings
      : buildFallbackChunks(words, audioDurationFrames);

  const activeChunk = !isOutro
    ? (resolvedTimings.find(c => frame >= c.startFrame && frame < c.endFrame) ?? null)
    : null;

  const word = activeChunk?.text ?? '';
  const localWordFrame = activeChunk ? Math.max(0, frame - activeChunk.startFrame) : 0;
  const wordDuration = activeChunk ? Math.max(activeChunk.endFrame - activeChunk.startFrame, 1) : 1;

  // Hard spring pop-in (0 → 1 in ~5 frames)
  const popSpring = spring({
    frame: Math.min(localWordFrame, 8),
    fps,
    config: { damping: 10, stiffness: 800, mass: 0.22 },
  });
  const wordScale = interpolate(popSpring, [0, 1], [0.55, 1.0]);

  // Fade in first 2 frames, fade out last 3 frames
  const fadeIn = interpolate(localWordFrame, [0, 2], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOutStart = Math.max(wordDuration - 4, Math.floor(wordDuration * 0.80));
  const fadeOut = interpolate(localWordFrame, [fadeOutStart, wordDuration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordOpacity = Math.min(fadeIn, fadeOut);

  // Subtle upward drift as word exits
  const wordDrift = interpolate(localWordFrame, [0, wordDuration], [0, -6], { extrapolateRight: 'clamp' });

  // ── Global Fade ────────────────────────────────────────────────────────────
  const globalFadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const globalFadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames - 1], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const globalOpacity = Math.min(globalFadeIn, globalFadeOut);

  // ── Progress bar ───────────────────────────────────────────────────────────
  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ backgroundColor: '#030308', opacity: globalOpacity }}>

      {/* Voiceover */}
      {audioSrc && <Audio src={audioSrc} volume={1.0} />}

      {/* Background Music — slightly louder in outro for dramatic effect */}
      {musicSrc && <Audio src={musicSrc} volume={isOutro ? 0.20 : 0.10} loop />}

      {/* Scene Images */}
      {scenes.map((src, i) => {
        const from = i * framesPerScene;
        const dur = i < sceneCount - 1
          ? framesPerScene + 8
          : Math.max(durationInFrames - from, framesPerScene);

        const isActive = currentScene === i;
        const sceneFadeIn = i === 0
          ? 1
          : interpolate(frame - from, [0, 8], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });

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

      {/* Cinematic gradient overlay */}
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.0) 20%, rgba(0,0,0,0.0) 46%, rgba(0,0,0,0.88) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* SCAM ALERT badge */}
      {!isOutro && (
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '52px 44px 0' }}>
          <div style={{
            background: 'rgba(214,24,0,0.95)',
            borderRadius: 10,
            padding: '10px 22px',
            border: '2px solid rgba(255,80,0,0.80)',
            boxShadow: '0 2px 24px rgba(214,24,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>⚠️</span>
            <span style={{
              color: '#fff',
              fontSize: 24,
              fontWeight: 900,
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}>
              SCAM ALERT
            </span>
          </div>
        </AbsoluteFill>
      )}

      {/* Title */}
      {!isOutro && (
        <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '158px 44px 0' }}>
          <p style={{
            fontSize: 42,
            fontWeight: 900,
            color: '#fff',
            fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
            lineHeight: 1.2,
            margin: 0,
            textTransform: 'uppercase',
            textShadow: '0 2px 28px rgba(0,0,0,1), 0 0 50px rgba(0,0,0,0.9)',
            maxWidth: '92%',
          }}>
            {formatTitle(title).toUpperCase()}
          </p>
        </AbsoluteFill>
      )}

      {/* ── ONE-WORD VIRAL SUBTITLE — center screen ────────────────────────── */}
      {!isOutro && word.length > 0 && (
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              opacity: wordOpacity,
              transform: `scale(${wordScale}) translateY(${wordDrift}px)`,
              textAlign: 'center',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <p
              style={{
                fontSize: 108,
                fontWeight: 900,
                color: '#FFD700',
                textAlign: 'center',
                fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
                textTransform: 'uppercase',
                lineHeight: 1.05,
                margin: 0,
                letterSpacing: 4,
                textShadow: [
                  '-4px -4px 0 #000',
                  ' 4px -4px 0 #000',
                  '-4px  4px 0 #000',
                  ' 4px  4px 0 #000',
                  '-4px  0px 0 #000',
                  ' 4px  0px 0 #000',
                  ' 0px -4px 0 #000',
                  ' 0px  4px 0 #000',
                  '0 0 48px rgba(255,215,0,0.35)',
                  '0 0 80px rgba(255,215,0,0.18)',
                ].join(', '),
              }}
            >
              {word}
            </p>
          </div>
        </AbsoluteFill>
      )}

      {/* FOLLOW CTA button */}
      {!isOutro && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: '0 44px 110px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #fe2c55 0%, #b01e3c 100%)',
            borderRadius: 100,
            padding: '18px 52px',
            boxShadow: '0 6px 36px rgba(254,44,85,0.70)',
          }}>
            <span style={{
              color: '#fff',
              fontSize: 30,
              fontWeight: 900,
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}>
              FOLLOW FOR MORE ALERTS
            </span>
          </div>
        </AbsoluteFill>
      )}

      {/* Progress bar */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 84px' }}>
        <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{
            width: `${Math.min(progress * 100, 100)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #fe2c55, #ff8c00)',
            boxShadow: '0 0 16px rgba(254,44,85,0.95)',
          }} />
        </div>
      </AbsoluteFill>

      {/* OUTRO CARD */}
      {isOutro && (
        <OutroCard frame={frame} fps={fps} outroStart={audioDurationFrames} />
      )}

    </AbsoluteFill>
  );
};
