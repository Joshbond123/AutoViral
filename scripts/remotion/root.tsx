import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { TikTokVideo, TikTokVideoProps } from './TikTokVideo';

const defaultProps: TikTokVideoProps = {
  scenes: [],
  audioSrc: '',
  musicSrc: '',
  script: '',
  title: '',
  durationInFrames: 1500,
};

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="TikTokVideo"
      component={TikTokVideo}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={1500}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: (props as TikTokVideoProps).durationInFrames ?? 1500,
      })}
    />
  );
};

registerRoot(RemotionRoot);
