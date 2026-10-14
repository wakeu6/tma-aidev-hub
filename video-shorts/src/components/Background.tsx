import React from 'react';
import { useCurrentFrame } from 'remotion';
import { THEME } from '../styles/theme';

export const Background: React.FC = () => {
  const frame = useCurrentFrame();

  // Gentle pulsing ambient light
  const pulse1 = Math.sin(frame * 0.05) * 0.15 + 0.85;
  const pulse2 = Math.cos(frame * 0.04) * 0.2 + 0.8;
  const gridOffsetY = (frame * 1.5) % 80;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: THEME.bg,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Subtle radial neon gradients for depth */}
      <div
        style={{
          position: 'absolute',
          top: -200,
          right: -200,
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(204, 255, 0, 0.12) 0%, rgba(10, 10, 12, 0) 70%)`,
          transform: `scale(${pulse1})`,
          filter: 'blur(60px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          left: -200,
          width: 750,
          height: 750,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(204, 255, 0, 0.08) 0%, rgba(10, 10, 12, 0) 70%)`,
          transform: `scale(${pulse2})`,
          filter: 'blur(70px)',
        }}
      />

      {/* Cyberpunk / Shorts subtle perspective grid */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.18,
        }}
      >
        <defs>
          <pattern
            id="techGrid"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(0, ${gridOffsetY})`}
          >
            <path
              d="M 80 0 L 0 0 0 80"
              fill="none"
              stroke="#CCFF00"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle cx="80" cy="0" r="1.5" fill="#CCFF00" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#techGrid)" />
      </svg>

      {/* Futuristic corner frame markings */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.4,
        }}
      >
        {/* Top-left corner */}
        <path
          d="M 60 120 L 60 70 L 120 70"
          fill="none"
          stroke={THEME.neon}
          strokeWidth="3"
        />
        {/* Top-right corner */}
        <path
          d="M 960 70 L 1020 70 L 1020 120"
          fill="none"
          stroke={THEME.neon}
          strokeWidth="3"
        />
        {/* Bottom-left corner */}
        <path
          d="M 60 1800 L 60 1850 L 120 1850"
          fill="none"
          stroke={THEME.neon}
          strokeWidth="3"
        />
        {/* Bottom-right corner */}
        <path
          d="M 960 1850 L 1020 1850 L 1020 1800"
          fill="none"
          stroke={THEME.neon}
          strokeWidth="3"
        />
      </svg>

      {/* Vignette edge shading */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(10, 10, 12, 0.85) 100%)',
        }}
      />
    </div>
  );
};
