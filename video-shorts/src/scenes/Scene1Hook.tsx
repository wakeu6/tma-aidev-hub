import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../styles/theme';

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for main headline
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.6, stiffness: 180 },
  });

  const badgeSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 14, mass: 0.5 },
  });

  // Exit transition towards frame 90
  const exitOpacity = interpolate(frame, [82, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitScale = interpolate(frame, [82, 90], [1, 1.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Countdown timer 3..2..1 calculation
  // 3: frames 10 - 36
  // 2: frames 36 - 62
  // 1: frames 62 - 88
  let currentNum: number | null = null;
  let numSubFrame = 0;

  if (frame >= 10 && frame < 36) {
    currentNum = 3;
    numSubFrame = frame - 10;
  } else if (frame >= 36 && frame < 62) {
    currentNum = 2;
    numSubFrame = frame - 36;
  } else if (frame >= 62 && frame < 90) {
    currentNum = 1;
    numSubFrame = frame - 62;
  }

  const numScale = currentNum
    ? spring({
        frame: numSubFrame,
        fps,
        config: { damping: 9, mass: 0.4, stiffness: 220 },
      })
    : 0;

  const shockwaveScale = interpolate(numSubFrame, [0, 22], [1, 2.4], {
    extrapolateRight: 'clamp',
  });
  const shockwaveOpacity = interpolate(numSubFrame, [0, 6, 22], [0, 0.9, 0], {
    extrapolateRight: 'clamp',
  });

  // Circular timer progress rotation
  const timerCircleProgress = interpolate(frame, [10, 88], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - timerCircleProgress);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: THEME.fontFamily,
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
      }}
    >
      {/* Top alert badge */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          transform: `scale(${Math.max(0, badgeSpring)})`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 32px',
          borderRadius: 999,
          background: 'rgba(204, 255, 0, 0.1)',
          border: `2px solid ${THEME.neon}`,
          boxShadow: THEME.neonGlow,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill={THEME.neon}>
          <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 10h2v4h-2zm0 6h2v2h-2z" />
        </svg>
        <span
          style={{
            color: THEME.neon,
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Психологический тест
        </span>
      </div>

      {/* Main Hook headline */}
      <div
        style={{
          position: 'absolute',
          top: 380,
          textAlign: 'center',
          transform: `scale(${Math.max(0, titleSpring)})`,
          width: '90%',
        }}
      >
        <div
          style={{
            fontSize: 90,
            fontWeight: 900,
            color: THEME.white,
            lineHeight: 1.1,
            letterSpacing: -1,
            textShadow: '0 4px 20px rgba(0,0,0,0.8)',
          }}
        >
          НЕ ДУМАЙ
        </div>
        <div
          style={{
            fontSize: 115,
            fontWeight: 900,
            color: THEME.neon,
            lineHeight: 1.1,
            letterSpacing: -2,
            textShadow: `0 0 35px rgba(204, 255, 0, 0.6), 0 0 70px rgba(204, 255, 0, 0.3)`,
          }}
        >
          ОБ ЭТОМ!
        </div>
      </div>

      {/* Springing 3..2..1 Countdown HUD Ring */}
      <div
        style={{
          position: 'relative',
          width: 360,
          height: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 260,
        }}
      >
        {/* SVG Circular HUD */}
        <svg
          width="360"
          height="360"
          viewBox="0 0 360 360"
          style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
        >
          {/* Base track */}
          <circle
            cx="180"
            cy="180"
            r="140"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="16"
          />
          {/* Neon animated arc */}
          <circle
            cx="180"
            cy="180"
            r="140"
            fill="none"
            stroke={THEME.neon}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: `drop-shadow(0 0 16px ${THEME.neon})`,
            }}
          />
        </svg>

        {/* Shockwave ripple when number pops */}
        {currentNum && (
          <div
            style={{
              position: 'absolute',
              width: 280,
              height: 280,
              borderRadius: '50%',
              border: `4px solid ${THEME.neon}`,
              transform: `scale(${shockwaveScale})`,
              opacity: shockwaveOpacity,
              boxShadow: `0 0 30px ${THEME.neon}`,
            }}
          />
        )}

        {/* Central bouncy number */}
        {currentNum ? (
          <div
            key={currentNum}
            style={{
              fontSize: 180,
              fontWeight: 900,
              color: THEME.white,
              transform: `scale(${numScale})`,
              lineHeight: 1,
              textShadow: `0 0 30px ${THEME.neon}, 0 0 60px rgba(204, 255, 0, 0.4)`,
              userSelect: 'none',
            }}
          >
            {currentNum}
          </div>
        ) : (
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: THEME.muted,
              letterSpacing: 2,
            }}
          >
            СТАРТ
          </div>
        )}
      </div>

      {/* Sub-instruction label */}
      <div
        style={{
          position: 'absolute',
          bottom: 220,
          color: THEME.muted,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: 'uppercase',
          opacity: interpolate(frame, [15, 30], [0, 1], {
            extrapolateLeft: 'clamp',
          }),
        }}
      >
        Приготовься отвечать быстро
      </div>
    </div>
  );
};
