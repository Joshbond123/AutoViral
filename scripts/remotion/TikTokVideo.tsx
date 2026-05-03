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

export interface TikTokVideoProps {
  scenes: string[];
  audioSrc: string;
  musicSrc?: string;
  script: string;
  title: string;
  durationInFrames: number;
}

function formatTitle(title: string): string {
  return title.length > 60 ? title.slice(0, 57) + '...' : title;
}

export const TikTokVideo: React.FC<TikTokVideoProps> = ({
  scenes,
  audioSrc,
  musicSrc,
  script,
  title,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Scene Management ──────────────────────────────────────────────────────
  const sceneCount = Math.max(scenes.length, 1);
  const framesPerScene = Math.ceil(durationInFrames / sceneCount);

  const currentScene = Math.min(Math.floor(frame / framesPerScene), sceneCount - 1);
  const sceneLocalFrame = frame - currentScene * framesPerScene;

  // Ken Burns — zoom + drift direction alternates per scene
  const kenBurnsScale = interpolate(
    sceneLocalFrame,
    [0, framesPerScene],
    [1.0, 1.10],
    { extrapolateRight: 'clamp' }
  );
  const kenBurnsX = currentScene % 2 === 0
    ? interpolate(sceneLocalFrame, [0, framesPerScene], [0, 2], { extrapolateRight: 'clamp' })
    : interpolate(sceneLocalFrame, [0, framesPerScene], [0, -2], { extrapolateRight: 'clamp' });

  // ── Subtitle Engine ───────────────────────────────────────────────────────
  const words = script.trim().split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  const CHUNK = 4; // words per caption card

  // Which word is currently being spoken (linear mapping)
  const currentWordIdx = Math.min(Math.floor((frame / durationInFrames) * totalWords), totalWords - 1);
  const chunkStart = Math.floor(currentWordIdx / CHUNK) * CHUNK;
  const chunkWords = words.slice(chunkStart, Math.min(chunkStart + CHUNK, totalWords));
  const subtitle = chunkWords.join(' ').toUpperCase();

  // Frame at which this chunk started showing
  const chunkStartFrame = Math.round((chunkStart / totalWords) * durationInFrames);
  const localChunkFrame = frame - chunkStartFrame;

  // Bounce-in animation — fires on each new chunk
  const bounceIn = spring({
    frame: Math.max(0, Math.min(localChunkFrame, 15)),
    fps,
    config: { damping: 10, stiffness: 500, mass: 0.4 },
  });
  const subtitleScale = interpolate(bounceIn, [0, 1], [0.78, 1.0]);
  const subtitleOpacity = interpolate(bounceIn, [0, 1], [0.0, 1.0]);

  // ── Global Fade-in ────────────────────────────────────────────────────────
  const globalFadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });

  // ── Progress Bar ──────────────────────────────────────────────────────────
  const progress = frame / durationInFrames;

  // ── Warning Badge Pulse ───────────────────────────────────────────────────
  const warningPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.5, 1.0]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f', opacity: globalFadeIn }}>

      {/* ── Voiceover ─────────────────────────────────────────────────── */}
      {audioSrc && <Audio src={audioSrc} volume={1.0} />}

      {/* ── Background Music (low volume) ─────────────────────────────── */}
      {musicSrc && <Audio src={musicSrc} volume={0.12} loop />}

      {/* ── Scene Images with Ken Burns ───────────────────────────────── */}
      {scenes.map((src, i) => {
        const from = i * framesPerScene;
        // Last scene extends to end; others get a small cross-fade overlap (+8 frames)
        const dur = i < sceneCount - 1
          ? framesPerScene + 8
          : Math.max(durationInFrames - from, framesPerScene);
        const isActive = currentScene === i;

        // Cross-fade opacity between scenes
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

      {/* ── Cinematic Gradient Overlay ─────────────────────────────────── */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.0) 22%, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.80) 100%)',
        }}
      />

      {/* ── AUTOVIRAL Badge (top-left) ─────────────────────────────────── */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '52px 44px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'linear-gradient(135deg, #fe2c55 0%, #ff0050 100%)',
            borderRadius: 100,
            padding: '12px 28px',
            boxShadow: '0 4px 24px rgba(254,44,85,0.65)',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 0 12px #fff, 0 0 4px #fff',
              opacity: warningPulse,
            }}
          />
          <span
            style={{
              color: '#fff',
              fontSize: 24,
              fontWeight: 800,
              fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            AUTOVIRAL
          </span>
        </div>
      </AbsoluteFill>

      {/* ── SCAM ALERT Badge ──────────────────────────────────────────── */}
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '148px 44px 0' }}>
        <div
          style={{
            background: 'rgba(255,40,0,0.92)',
            borderRadius: 10,
            padding: '10px 22px',
            border: '2px solid rgba(255,120,0,0.9)',
            boxShadow: '0 2px 20px rgba(255,40,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>⚠️</span>
          <span
            style={{
              color: '#fff',
              fontSize: 26,
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
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '256px 44px 0' }}>
        <p
          style={{
            fontSize: 46,
            fontWeight: 900,
            color: '#fff',
            fontFamily: 'Impact, DejaVu Sans, Liberation Sans, Arial Black, sans-serif',
            lineHeight: 1.2,
            margin: 0,
            textTransform: 'uppercase',
            textShadow: '0 2px 24px rgba(0,0,0,1), 0 0 50px rgba(0,0,0,0.9)',
            maxWidth: '95%',
          }}
        >
          {formatTitle(title).toUpperCase()}
        </p>
      </AbsoluteFill>

      {/* ── CENTER SUBTITLES — Viral TikTok Style ────────────────────── */}
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 28px',
        }}
      >
        <div
          style={{
            opacity: subtitleOpacity,
            transform: `scale(${subtitleScale})`,
            maxWidth: '96%',
            textAlign: 'center',
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
              lineHeight: 1.15,
              margin: 0,
              letterSpacing: 1,
              // Thick black stroke for viral caption look
              textShadow: [
                '-4px -4px 0 #000',
                '4px -4px 0 #000',
                '-4px  4px 0 #000',
                ' 4px  4px 0 #000',
                '-4px  0   0 #000',
                ' 4px  0   0 #000',
                ' 0   -4px 0 #000',
                ' 0    4px 0 #000',
                '0 6px 30px rgba(0,0,0,0.9)',
              ].join(', '),
            }}
          >
            {subtitle}
          </p>
        </div>
      </AbsoluteFill>

      {/* ── FOLLOW CTA (bottom) ───────────────────────────────────────── */}
      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 44px 110px',
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
              fontSize: 32,
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

      {/* ── Progress Bar (bottom) ─────────────────────────────────────── */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 80px' }}>
        <div
          style={{
            width: '100%',
            height: 6,
            background: 'rgba(255,255,255,0.12)',
          }}
        >
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
