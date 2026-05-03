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
  script,
  title,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneCount = Math.max(scenes.length, 1);
  const framesPerScene = Math.ceil(durationInFrames / sceneCount);

  const currentScene = Math.min(Math.floor(frame / framesPerScene), sceneCount - 1);
  const sceneLocalFrame = frame - currentScene * framesPerScene;

  const kenBurnsScale = interpolate(
    sceneLocalFrame,
    [0, framesPerScene],
    [1.0, 1.12],
    { extrapolateRight: 'clamp' }
  );

  const kenBurnsX = currentScene % 2 === 0
    ? interpolate(sceneLocalFrame, [0, framesPerScene], [0, 2], { extrapolateRight: 'clamp' })
    : interpolate(sceneLocalFrame, [0, framesPerScene], [0, -2], { extrapolateRight: 'clamp' });

  const words = script.trim().split(/\s+/);
  const totalWords = words.length;
  const wordsPerFrame = totalWords / durationInFrames;
  const currentWordIdx = Math.min(Math.floor(frame * wordsPerFrame), totalWords - 1);
  const CHUNK = 5;
  const chunkStart = Math.floor(currentWordIdx / CHUNK) * CHUNK;
  const subtitle = words.slice(chunkStart, Math.min(chunkStart + CHUNK, totalWords)).join(' ');

  const subtitleEnter = spring({ frame: (chunkStart / totalWords) * durationInFrames > frame ? 0 : frame - Math.floor(chunkStart / wordsPerFrame), fps, config: { damping: 20, stiffness: 300 } });
  const subtitleScale = interpolate(subtitleEnter, [0, 1], [0.92, 1]);

  const globalFadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  const progress = frame / durationInFrames;

  const warningPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.7, 1.0]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f', opacity: globalFadeIn }}>
      {audioSrc && <Audio src={audioSrc} />}

      {scenes.map((src, i) => {
        const from = i * framesPerScene;
        const dur = i < sceneCount - 1 ? framesPerScene + 10 : durationInFrames - from + 60;
        const isActive = currentScene === i;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <AbsoluteFill>
              <Img
                src={src}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: isActive
                    ? `scale(${kenBurnsScale}) translateX(${kenBurnsX}%)`
                    : 'scale(1)',
                  transformOrigin: 'center center',
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.0) 28%, rgba(0,0,0,0.0) 52%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '52px 44px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: 'linear-gradient(135deg, #fe2c55 0%, #ff0050 100%)',
            borderRadius: 100,
            padding: '12px 28px',
            boxShadow: '0 4px 24px rgba(254,44,85,0.6)',
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
              fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif',
              letterSpacing: 4,
              textTransform: 'uppercase',
            }}
          >
            AUTOVIRAL
          </span>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '148px 44px 0' }}>
        <div
          style={{
            background: 'rgba(255,60,0,0.9)',
            borderRadius: 10,
            padding: '10px 22px',
            border: '2px solid rgba(255,120,0,0.9)',
            boxShadow: '0 2px 16px rgba(255,60,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 30, lineHeight: 1 }}>⚠️</span>
          <span
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: 900,
              fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif',
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            SCAM ALERT
          </span>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'flex-start', padding: '256px 44px 0' }}>
        <p
          style={{
            fontSize: 46,
            fontWeight: 900,
            color: '#fff',
            fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif',
            lineHeight: 1.2,
            margin: 0,
            textShadow: '0 2px 20px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.8)',
            maxWidth: '95%',
          }}
        >
          {formatTitle(title).toUpperCase()}
        </p>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: 'flex-end',
          alignItems: 'center',
          padding: '0 36px 230px',
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.82)',
            borderRadius: 20,
            padding: '18px 32px',
            maxWidth: '92%',
            backdropFilter: 'blur(8px)',
            border: '2px solid rgba(254,44,85,0.3)',
            transform: `scale(${subtitleScale})`,
            boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
          }}
        >
          <p
            style={{
              fontSize: 54,
              fontWeight: 900,
              color: '#fff',
              textAlign: 'center',
              fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif',
              lineHeight: 1.25,
              margin: 0,
              textShadow:
                '0 0 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000',
            }}
          >
            {subtitle}
          </p>
        </div>
      </AbsoluteFill>

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
            boxShadow: '0 6px 28px rgba(254,44,85,0.55)',
          }}
        >
          <span
            style={{
              color: '#fff',
              fontSize: 34,
              fontWeight: 900,
              fontFamily: 'DejaVu Sans, Liberation Sans, Arial, sans-serif',
              letterSpacing: 1,
            }}
          >
            FOLLOW FOR MORE ALERTS
          </span>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: '0 0 90px' }}>
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
              boxShadow: '0 0 14px rgba(254,44,85,0.9)',
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
