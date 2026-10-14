import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../styles/theme';

export const Scene4CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 180 },
  });

  const btnLeftSpring = spring({
    frame: frame - 14,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 200 },
  });

  const btnRightSpring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 200 },
  });

  // Bouncing arrow animation
  const bounceY = Math.sin(frame * 0.35) * 16;

  // Seamless loop transition (frames 68..90)
  // Zooms into center vortex that matches the opening frame 0 perfectly
  const loopProgress = interpolate(frame, [68, 90], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaScale = interpolate(loopProgress, [0, 1], [1, 1.4]);
  const ctaOpacity = interpolate(loopProgress, [0, 0.8], [1, 0], {
    extrapolateRight: 'clamp',
  });

  // Loop incoming portal matching Scene 1 Frame 0
  const portalScale = interpolate(loopProgress, [0, 1], [0.3, 1]);
  const portalOpacity = interpolate(loopProgress, [0, 0.4, 1], [0, 0.5, 1]);

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
        overflow: 'hidden',
      }}
    >
      {/* Active CTA Content */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${ctaScale})`,
          opacity: ctaOpacity,
          padding: '0 40px',
        }}
      >
        {/* Main CTA Question */}
        <div
          style={{
            textAlign: 'center',
            transform: `scale(${Math.max(0, enterSpring)})`,
            maxWidth: 960,
          }}
        >
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              color: THEME.white,
              lineHeight: 1.15,
              letterSpacing: -1,
            }}
          >
            Я УГАДАЛ
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: THEME.neon,
              lineHeight: 1.15,
              letterSpacing: -1,
              textShadow: THEME.neonGlow,
            }}
          >
            ИЛИ НЕТ?
          </div>
        </div>

        {/* Voting / Interactive style buttons */}
        <div
          style={{
            marginTop: 60,
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            width: '100%',
            maxWidth: 820,
          }}
        >
          {/* Button 1: YES */}
          <div
            style={{
              padding: '24px 36px',
              borderRadius: 24,
              background: 'rgba(204, 255, 0, 0.12)',
              border: `3px solid ${THEME.neon}`,
              boxShadow: THEME.neonGlow,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transform: `scale(${Math.max(0, btnLeftSpring)})`,
            }}
          >
            <span
              style={{
                fontSize: 48,
                fontWeight: 900,
                color: THEME.neon,
                letterSpacing: 1,
              }}
            >
              ДА, В ТОЧКУ!
            </span>
            <span style={{ fontSize: 44 }}>🔥</span>
          </div>

          {/* Button 2: NO */}
          <div
            style={{
              padding: '24px 36px',
              borderRadius: 24,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transform: `scale(${Math.max(0, btnRightSpring)})`,
            }}
          >
            <span
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: THEME.white,
                letterSpacing: 1,
              }}
            >
              НЕ УГАДАЛ
            </span>
            <span style={{ fontSize: 44 }}>🤔</span>
          </div>
        </div>

        {/* Comment prompt banner */}
        <div
          style={{
            marginTop: 70,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 42,
              fontWeight: 800,
              color: THEME.white,
              letterSpacing: 1,
              background: 'rgba(0,0,0,0.4)',
              padding: '14px 34px',
              borderRadius: 999,
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          >
            Напиши в комменты 👇
          </div>

          {/* Bouncing Hand SVG Pointer */}
          <div
            style={{
              transform: `translateY(${bounceY}px)`,
              fontSize: 70,
              filter: `drop-shadow(0 0 16px ${THEME.neon})`,
            }}
          >
            👇
          </div>
        </div>
      </div>

      {/* Seamless Loop Vortex Overlay that matches Frame 0 */}
      {loopProgress > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: portalOpacity,
            transform: `scale(${portalScale})`,
            pointerEvents: 'none',
          }}
        >
          {/* Top alert badge replica */}
          <div
            style={{
              position: 'absolute',
              top: 240,
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

          {/* Replica of Frame 0 hook */}
          <div
            style={{
              position: 'absolute',
              top: 380,
              textAlign: 'center',
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
                textShadow: `0 0 35px rgba(204, 255, 0, 0.6)`,
              }}
            >
              ОБ ЭТОМ!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
