import React from 'react';
import { useCurrentFrame } from 'remotion';
import { THEME } from '../styles/theme';

export const ProgressBar: React.FC<{ totalFrames?: number }> = ({ totalFrames = 420 }) => {
  const frame = useCurrentFrame();

  const progress = Math.min(1, Math.max(0, frame / totalFrames));

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        zIndex: 100,
        overflow: 'visible',
      }}
    >
      {/* Active progress fill */}
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          backgroundColor: THEME.neon,
          boxShadow: `0 0 25px ${THEME.neon}, 0 0 50px ${THEME.neon}`,
          position: 'relative',
        }}
      >
        {/* Glowing runner head */}
        <div
          style={{
            position: 'absolute',
            right: -6,
            top: -4,
            width: 14,
            height: 32,
            backgroundColor: '#FFFFFF',
            borderRadius: 4,
            boxShadow: `0 0 20px #FFFFFF, 0 0 35px ${THEME.neon}`,
          }}
        />
      </div>

      {/* Subtle frame ticks along the bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 25%',
          pointerEvents: 'none',
          opacity: 0.35,
        }}
      >
        <div style={{ width: 2, height: '100%', background: '#FFF' }} />
        <div style={{ width: 2, height: '100%', background: '#FFF' }} />
        <div style={{ width: 2, height: '100%', background: '#FFF' }} />
      </div>
    </div>
  );
};
