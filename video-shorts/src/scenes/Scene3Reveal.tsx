import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../styles/theme';

export const Scene3Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Screen Flash at frames 0..18
  const flashOpacity = interpolate(frame, [0, 2, 14], [0, 0.95, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Screen shake on flash impact
  const shakeX =
    frame < 12 ? Math.sin(frame * 2.5) * (12 - frame) * 1.5 : 0;
  const shakeY =
    frame < 12 ? Math.cos(frame * 3.0) * (12 - frame) * 1.5 : 0;

  // 2. Card Spring entrance
  const cardSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 11, mass: 0.6, stiffness: 190 },
  });

  // 3. Apple badge spring
  const appleSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 220 },
  });

  // 4. Red badge spring
  const redSpring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 220 },
  });

  // 5. Animated Counter to 92%
  const counterSpring = spring({
    frame: frame - 32,
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 130 },
  });
  const percentValue = Math.min(
    92,
    Math.round(interpolate(counterSpring, [0, 1], [0, 92], {
      extrapolateRight: 'clamp',
    }))
  );

  // SVG Gauge calculations
  const gaugeRadius = 90;
  const circumference = 2 * Math.PI * gaugeRadius;
  const gaugeProgress = (percentValue / 100) * circumference;
  const strokeDashoffset = circumference - gaugeProgress;

  // Exit transition
  const exitOpacity = interpolate(frame, [112, 120], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitScale = interpolate(frame, [112, 120], [1, 0.95], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
        transform: `translate(${shakeX}px, ${shakeY}px) scale(${exitScale})`,
      }}
    >
      {/* Intense White/Lime Screen Flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle, #CCFF00 0%, #FFFFFF 60%, rgba(255,255,255,0) 100%)',
          opacity: flashOpacity,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      />

      {/* Header Tag */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 28px',
          borderRadius: 999,
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <span style={{ fontSize: 26, color: THEME.neon }}>⚡</span>
        <span
          style={{
            color: THEME.white,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Результат теста
        </span>
      </div>

      {/* Main Glass Card */}
      <div
        style={{
          width: '90%',
          maxWidth: 960,
          background: THEME.cardBg,
          border: `2px solid ${THEME.cardBorder}`,
          borderRadius: 36,
          padding: '50px 30px',
          boxShadow: '0 25px 80px rgba(0,0,0,0.7), inset 0 0 40px rgba(204,255,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          transform: `scale(${Math.max(0, cardSpring)})`,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: THEME.white,
            letterSpacing: 2,
            textTransform: 'uppercase',
            opacity: 0.9,
          }}
        >
          Ты загадал:
        </div>

        {/* Badges container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            width: '100%',
          }}
        >
          {/* Badge: ЯБЛОКО */}
          <div
            style={{
              width: '88%',
              padding: '18px 24px',
              borderRadius: 24,
              background: 'rgba(204, 255, 0, 0.15)',
              border: `3px solid ${THEME.neon}`,
              boxShadow: THEME.neonGlow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              transform: `scale(${Math.max(0, appleSpring)})`,
            }}
          >
            {/* Pure SVG Apple Icon */}
            <svg width="48" height="48" viewBox="0 0 24 24" fill={THEME.neon}>
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.6-.74 1.01-1.77.9-2.8-.87.04-1.92.58-2.54 1.31-.55.64-.99 1.68-.86 2.69.97.08 1.9-.46 2.5-1.2z" />
            </svg>
            <span
              style={{
                fontSize: 68,
                fontWeight: 900,
                color: THEME.neon,
                letterSpacing: 2,
                textShadow: `0 0 20px rgba(204, 255, 0, 0.6)`,
              }}
            >
              ЯБЛОКО
            </span>
          </div>

          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: THEME.muted,
              letterSpacing: 2,
            }}
          >
            ИЛИ
          </div>

          {/* Badge: КРАСНЫЙ? */}
          <div
            style={{
              width: '88%',
              padding: '18px 24px',
              borderRadius: 24,
              background: 'rgba(255, 51, 102, 0.15)',
              border: `3px solid ${THEME.red}`,
              boxShadow: THEME.redGlow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              transform: `scale(${Math.max(0, redSpring)})`,
            }}
          >
            {/* Pure SVG Drop / Heart icon */}
            <svg width="48" height="48" viewBox="0 0 24 24" fill={THEME.red}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span
              style={{
                fontSize: 68,
                fontWeight: 900,
                color: THEME.red,
                letterSpacing: 2,
                textShadow: `0 0 25px rgba(255, 51, 102, 0.6)`,
              }}
            >
              КРАСНЫЙ?
            </span>
          </div>
        </div>

        {/* Animated Counter Section with Circular Gauge */}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 30,
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 28,
            padding: '16px 36px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Gauge */}
          <div
            style={{
              position: 'relative',
              width: 140,
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="140"
              height="140"
              viewBox="0 0 200 200"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="100"
                cy="100"
                r={gaugeRadius}
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="16"
              />
              <circle
                cx="100"
                cy="100"
                r={gaugeRadius}
                fill="none"
                stroke={THEME.neon}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                style={{
                  filter: `drop-shadow(0 0 10px ${THEME.neon})`,
                }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                fontSize: 38,
                fontWeight: 900,
                color: THEME.white,
              }}
            >
              {percentValue}%
            </div>
          </div>

          {/* Counter info */}
          <div style={{ textAlign: 'left', maxWidth: 380 }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: THEME.neon,
                lineHeight: 1.1,
              }}
            >
              {percentValue}% людей
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 600,
                color: THEME.muted,
                marginTop: 4,
              }}
            >
              называют именно эту пару!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
