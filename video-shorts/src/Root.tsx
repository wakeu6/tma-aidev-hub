import React from 'react';
import { Composition } from 'remotion';
import { MyComp } from './MyComp';
import data from '../shared/data.json';

export const RemotionRoot: React.FC = () => {
  const durationInSeconds = data.duration || 35;
  const fps = 30;
  const durationInFrames = Math.ceil(durationInSeconds * fps);

  return (
    <>
      <Composition
        id="MyComp"
        component={MyComp}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1080}
        height={1920}
      />
    </>
  );
};
