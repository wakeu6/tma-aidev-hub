import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../styles/theme';

interface WordItem {
  text: string;
  delay: number;
  isHighlight?: boolean;
  color?: string;
  fontSize?: number;
}

export const Scene2Prompt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene transition in and out
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.5 },
  });

  const exitOpacity = interpolate(frame, [112, 120], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitScale = interpolate(frame, [112, 120], [1, 1.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Micro-delayed word timing
  const words: WordItem[] = [
    { text: 'НАЗОВИ', delay: 4, fontSize: 62 },
    { text: 'ЛЮБОЙ', delay: 14, fontSize: 62 },
    {
      text: 'ФРУКТ',
      delay: 24,
      isHighlight: true,
      color: THEME.neon,
      fontSize: 104,
    },
    { text: 'И', delay: 38, fontSize: 50 },
    { text: 'ЛЮБОЙ', delay: 46, fontSize: 62 },
    {
      text: 'ЦВЕТ',
      delay: 56,
      isHighlight: true,
      color: THEME.neon,
      fontSize: 104,
    },
    {
      text: 'ПРЯМО СЕЙЧАС!',
      delay: 72,
      isHighlight: true,
      color: THEME.white,
      fontSize: 78,
    },
  ];

  // Fast urgency pulse bars
  const pulseScale = Math.sin(frame * 0.4) * 0.04 + 1;

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
        padding: '0 50px',
      }}
    >
      {/* Floating Header indicator */}
      <div
        style={{
          position: 'absolute',
          top: 220,
          transform: `scale(${Math.max(0, enterSpring)})`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 28px',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: THEME.neon,
            boxShadow: `0 0 14px ${THEME.neon}`,
            display: 'inline-block',
          }}
        />
        <span
          style={{
            color: THEME.white,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Включай интуицию
        </span>
      </div>

      {/* Main Glassmorphic Task Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          background: THEME.cardBg,
          border: `2px solid ${THEME.cardBorder}`,
          borderRadius: 36,
          padding: '60px 40px',
          boxShadow: '0 20px 80px rgba(0, 0, 0, 0.6), inset 0 0 40px rgba(204, 255, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          position: 'relative',
        }}
      >
        {/* Subtle decorative corner crosses */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: THEME.neon,
            fontSize: 20,
            fontWeight: 900,
            opacity: 0.7,
          }}
        >
          +
        </div>
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            color: THEME.neon,
            fontSize: 20,
            fontWeight: 900,
            opacity: 0.7,
          }}
        >
          +
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            color: THEME.neon,
            fontSize: 20,
            fontWeight: 900,
            opacity: 0.7,
          }}
        >
          +
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            color: THEME.neon,
            fontSize: 20,
            fontWeight: 900,
            opacity: 0.7,
          }}
        >
          +
        </div>

        {/* Row 1: НАЗОВИ ЛЮБОЙ */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[words[0], words[1]].map((w, idx) => {
            const wSpring = spring({
              frame: frame - w.delay,
              fps,
              config: { damping: 12, mass: 0.4, stiffness: 200 },
            });
            const opacity = interpolate(frame - w.delay, [0, 4], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <span
                key={idx}
                style={{
                  fontSize: w.fontSize,
                  fontWeight: 900,
                  color: THEME.white,
                  letterSpacing: -1,
                  opacity,
                  transform: `scale(${Math.max(0, wSpring)}) translateY(${interpolate(
                    wSpring,
                    [0, 1],
                    [20, 0]
                  )}px)`,
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>

        {/* Row 2: ФРУКТ (Massive Highlight Card) */}
        {(() => {
          const w = words[2];
          const wSpring = spring({
            frame: frame - w.delay,
            fps,
            config: { damping: 9, mass: 0.5, stiffness: 240 },
          });
          const opacity = interpolate(frame - w.delay, [0, 4], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              style={{
                background: 'rgba(204, 255, 0, 0.12)',
                border: `3px solid ${THEME.neon}`,
                borderRadius: 24,
                padding: '10px 48px',
                boxShadow: THEME.neonGlow,
                opacity,
                transform: `scale(${Math.max(0, wSpring)})`,
              }}
            >
              <span
                style={{
                  fontSize: w.fontSize,
                  fontWeight: 900,
                  color: THEME.neon,
                  letterSpacing: 2,
                  textShadow: `0 0 25px rgba(204, 255, 0, 0.7)`,
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            </div>
          );
        })()}

        {/* Row 3: И ЛЮБОЙ */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {[words[3], words[4]].map((w, idx) => {
            const wSpring = spring({
              frame: frame - w.delay,
              fps,
              config: { damping: 12, mass: 0.4, stiffness: 200 },
            });
            const opacity = interpolate(frame - w.delay, [0, 4], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <span
                key={idx}
                style={{
                  fontSize: w.fontSize,
                  fontWeight: 900,
                  color: THEME.white,
                  letterSpacing: -1,
                  opacity,
                  transform: `scale(${Math.max(0, wSpring)}) translateY(${interpolate(
                    wSpring,
                    [0, 1],
                    [20, 0]
                  )}px)`,
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>

        {/* Row 4: ЦВЕТ (Massive Highlight Card) */}
        {(() => {
          const w = words[5];
          const wSpring = spring({
            frame: frame - w.delay,
            fps,
            config: { damping: 9, mass: 0.5, stiffness: 240 },
          });
          const opacity = interpolate(frame - w.delay, [0, 4], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              style={{
                background: 'rgba(204, 255, 0, 0.12)',
                border: `3px solid ${THEME.neon}`,
                borderRadius: 24,
                padding: '10px 48px',
                boxShadow: THEME.neonGlow,
                opacity,
                transform: `scale(${Math.max(0, wSpring)})`,
              }}
            >
              <span
                style={{
                  fontSize: w.fontSize,
                  fontWeight: 900,
                  color: THEME.neon,
                  letterSpacing: 2,
                  textShadow: `0 0 25px rgba(204, 255, 0, 0.7)`,
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            </div>
          );
        })()}

        {/* Row 5: ПРЯМО СЕЙЧАС! */}
        {(() => {
          const w = words[6];
          const wSpring = spring({
            frame: frame - w.delay,
            fps,
            config: { damping: 10, mass: 0.6, stiffness: 220 },
          });
          const opacity = interpolate(frame - w.delay, [0, 4], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              style={{
                marginTop: 18,
                opacity,
                transform: `scale(${Math.max(0, wSpring) * (frame > 85 ? pulseScale : 1)})`,
                background: 'linear-gradient(90deg, #CCFF00 0%, #FFFFFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontSize: w.fontSize,
                  fontWeight: 900,
                  letterSpacing: 1,
                  display: 'inline-block',
                }}
              >
                {w.text}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Visual Audio equalizer wave bars beneath */}
      <div
        style={{
          marginTop: 60,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          height: 80,
        }}
      >
        {Array.from({ length: 18 }).map((_, i) => {
          const barHeight =
            frame > 30
              ? Math.sin(frame * 0.25 + i * 0.7) * 28 + 36
              : 8;
          return (
            <div
              key={i}
              style={{
                width: 8,
                height: barHeight,
                borderRadius: 4,
                backgroundColor: i % 3 === 0 ? THEME.neon : 'rgba(255, 255, 255, 0.4)',
                boxShadow: i % 3 === 0 ? `0 0 10px ${THEME.neon}` : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
