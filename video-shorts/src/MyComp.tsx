import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import data from '../shared/data.json';

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface SceneItem {
  id: number;
  text: string;
  imageFile?: string;
  videoFile?: string;
  kenBurns?: string;
  startTime: number;
  endTime: number;
  duration: number;
  isCtaOutro?: boolean;
}

export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const currentTime = frame / fps;
  const totalVideoDuration = durationInFrames / fps;

  const words: WordTiming[] = data.words || [];
  const scenes: SceneItem[] = (data as any).scenes || [];
  const stylePreset = (data as any).stylePreset || 'dark_gritty';
  const brandBotHandle = (data as any).brandBotHandle || '@AIBot';
  const enableBrandPill = (data as any).enableBrandPill !== false;

  const theme = (data as any).styleTheme || {
    bgColor: '#05060A',
    accentColor: '#00F0FF',
    subtitleActiveColor: '#00F0FF',
    subtitleInactiveColor: '#FFFFFF',
    subtitleShadow: '0 0 35px rgba(0,240,255,0.85), 0 4px 14px rgba(0,0,0,0.95)',
    badgeBg: 'rgba(5, 8, 16, 0.75)',
    badgeBorder: '1px solid rgba(0, 240, 255, 0.45)',
    badgeColor: '#00F0FF',
    vignetteIntensity: 0.7,
    overlayFilter: 'contrast(1.15) brightness(0.9)',
    progressGradient: 'linear-gradient(90deg, #00F0FF 0%, #3B82F6 100%)',
    badgeText: 'GOOGLE VEO // AI 2026',
  };

  // Определение текущей активной сцены
  const activeSceneIndex = useMemo(() => {
    if (scenes.length === 0) return 0;
    for (let i = 0; i < scenes.length; i++) {
      if (currentTime >= scenes[i].startTime && currentTime <= scenes[i].endTime) {
        return i;
      }
    }
    for (let i = 0; i < scenes.length; i++) {
      if (currentTime < scenes[i].startTime) {
        return Math.max(0, i - 1);
      }
    }
    return scenes.length - 1;
  }, [scenes, currentTime]);

  const activeScene = scenes[activeSceneIndex];

  // Группировка слов в кинетические блоки по 3-4 слова
  const chunks = useMemo(() => {
    const list: WordTiming[][] = [];
    let currentChunk: WordTiming[] = [];

    for (let i = 0; i < words.length; i++) {
      currentChunk.push(words[i]);
      const endsWithPunct = /[.!?]$/.test(words[i].word);
      if (currentChunk.length >= 4 || endsWithPunct || i === words.length - 1) {
        list.push(currentChunk);
        currentChunk = [];
      }
    }
    return list;
  }, [words]);

  // Поиск активного чанка субтитров
  const activeChunkIndex = useMemo(() => {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkStart = chunk[0].start;
      const chunkEnd = chunk[chunk.length - 1].end;
      if (currentTime >= chunkStart && currentTime <= chunkEnd + 0.25) {
        return i;
      }
    }
    for (let i = 0; i < chunks.length; i++) {
      if (currentTime < chunks[i][0].start) {
        return Math.max(0, i - 1);
      }
    }
    return Math.max(0, chunks.length - 1);
  }, [chunks, currentTime]);

  const currentChunk = chunks[activeChunkIndex] || [];

  // Расчет анимации Ken Burns для статичных кадров
  const { kenBurnsTransform, kenBurnsOpacity } = useMemo(() => {
    if (!activeScene) {
      return { kenBurnsTransform: 'scale(1.05)', kenBurnsOpacity: 1 };
    }

    const sceneDur = Math.max(0.1, activeScene.duration || 5);
    const progress = Math.min(1, Math.max(0, (currentTime - activeScene.startTime) / sceneDur));
    const motion = activeScene.kenBurns || 'zoom_in';

    let scale = 1.0;
    let translateX = 0;
    let translateY = 0;
    let rotate = 0;

    switch (motion) {
      case 'zoom_in':
        scale = interpolate(progress, [0, 1], [1.0, 1.18]);
        break;
      case 'zoom_out':
        scale = interpolate(progress, [0, 1], [1.18, 1.02]);
        break;
      case 'pan_up':
        scale = 1.12;
        translateY = interpolate(progress, [0, 1], [25, -25]);
        break;
      case 'pan_down':
        scale = 1.12;
        translateY = interpolate(progress, [0, 1], [-25, 25]);
        break;
      case 'tilt_zoom':
        scale = interpolate(progress, [0, 1], [1.05, 1.20]);
        rotate = interpolate(progress, [0, 1], [-1, 1]);
        break;
      default:
        scale = interpolate(progress, [0, 1], [1.0, 1.15]);
    }

    // Плавный фейд на стыках сцен (первые 6 кадров)
    const framesIntoScene = (currentTime - activeScene.startTime) * fps;
    const opacity = interpolate(framesIntoScene, [0, 6], [0.65, 1.0], {
      extrapolateRight: 'clamp',
    });

    return {
      kenBurnsTransform: `scale(${scale.toFixed(3)}) translate(${translateX}px, ${translateY.toFixed(1)}px) rotate(${rotate.toFixed(2)}deg)`,
      kenBurnsOpacity: opacity,
    };
  }, [activeScene, currentTime, fps]);

  const progressPercent = Math.min(100, Math.max(0, (frame / durationInFrames) * 100));

  // Определение активности Outro CTA (финальные 4.5 секунды ролика)
  const isOutroActive = currentTime >= Math.max(0, totalVideoDuration - 4.5) || (activeScene && activeScene.isCtaOutro);
  const outroProgress = isOutroActive
    ? Math.min(1, Math.max(0, (currentTime - (totalVideoDuration - 4.5)) / 0.5))
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bgColor || '#05060A',
        color: '#FFFFFF',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Montserrat', sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* 1. Аудиодорожка (голос диктора) */}
      <Audio src={staticFile('audio.mp3')} />

      {/* 2. Фон: Google Veo видеоряд или процедурный кадр с Ken Burns */}
      {activeScene && activeScene.videoFile ? (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <OffthreadVideo
            src={staticFile(activeScene.videoFile)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: theme.overlayFilter || 'none',
            }}
          />
        </div>
      ) : activeScene && activeScene.imageFile ? (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Img
            src={staticFile(activeScene.imageFile)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: kenBurnsTransform,
              transformOrigin: 'center center',
              opacity: kenBurnsOpacity,
              filter: theme.overlayFilter || 'none',
              transition: 'opacity 0.1s linear',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 50% 30%, rgba(0,240,255,0.2) 0%, transparent 70%)',
          }}
        />
      )}

      {/* 3. Стилистические оверлеи (Виньетка + Текстуры стилей) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, ${theme.vignetteIntensity || 0.6}) 100%)`,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.85) 100%)',
          pointerEvents: 'none',
          zIndex: 6,
        }}
      />

      {/* 3.3 Специфичные текстурные оверлеи по стилю */}
      {stylePreset === 'y2k_retro' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 4px)',
            pointerEvents: 'none',
            zIndex: 7,
          }}
        />
      )}

      {stylePreset === 'dark_gritty' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 160px rgba(0,0,0,0.95)',
            pointerEvents: 'none',
            zIndex: 7,
          }}
        />
      )}

      {stylePreset === 'street_grunge' && (
        <div
          style={{
            position: 'absolute',
            inset: 20,
            border: '2px dashed rgba(255, 230, 0, 0.25)',
            pointerEvents: 'none',
            zIndex: 7,
          }}
        />
      )}

      {/* 4. Верхний бейдж стиля и тематики (Safe Zone Top) */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 28px',
            borderRadius: 999,
            backgroundColor: theme.badgeBg || 'rgba(0,0,0,0.65)',
            border: theme.badgeBorder || '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(16px)',
            boxShadow: `0 0 25px ${theme.accentColor}33`,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: theme.badgeColor || theme.accentColor,
              boxShadow: `0 0 12px ${theme.badgeColor || theme.accentColor}`,
            }}
          />
          <span
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 2,
              color: theme.badgeColor || '#FFFFFF',
              textTransform: 'uppercase',
            }}
          >
            {theme.badgeText || 'GOOGLE VEO // AI 2026'}
          </span>
        </div>
      </div>

      {/* 5. Водяной знак бренда / Брендинг-плашка (Brand Pill в Safe Zone) */}
      {enableBrandPill && (
        <div
          style={{
            position: 'absolute',
            top: 165,
            left: 45,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 20px',
            borderRadius: 999,
            backgroundColor: 'rgba(10, 11, 14, 0.78)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            zIndex: 15,
          }}
        >
          <span style={{ fontSize: 18, color: '#00F0FF' }}>⚡</span>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: 1,
            }}
          >
            {brandBotHandle}
          </span>
        </div>
      )}

      {/* 6. Центрированные кинетические субтитры с адаптивной подсветкой */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 50px',
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px 20px',
            maxWidth: 980,
            textAlign: 'center',
          }}
        >
          {currentChunk.map((item, idx) => {
            const isWordActive =
              currentTime >= item.start &&
              (currentTime <= item.end || idx === currentChunk.length - 1);

            return (
              <span
                key={`${item.word}-${idx}`}
                style={{
                  display: 'inline-block',
                  fontSize: isWordActive ? 76 : 66,
                  fontWeight: 900,
                  color: isWordActive
                    ? theme.subtitleActiveColor || '#FFE600'
                    : theme.subtitleInactiveColor || '#FFFFFF',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  lineHeight: 1.15,
                  transform: isWordActive ? 'scale(1.14)' : 'scale(1.0)',
                  transition: 'transform 0.06s ease-out, color 0.06s ease-out',
                  textShadow: isWordActive
                    ? theme.subtitleShadow || '0 0 30px rgba(255,230,0,0.85)'
                    : '0 4px 16px rgba(0,0,0,0.95)',
                  backgroundColor: isWordActive ? 'rgba(0, 0, 0, 0.55)' : 'transparent',
                  padding: isWordActive ? '6px 16px' : '0px',
                  borderRadius: 16,
                  border: isWordActive
                    ? `1px solid ${theme.subtitleActiveColor || '#FFE600'}55`
                    : 'none',
                }}
              >
                {item.word}
              </span>
            );
          })}
        </div>
      </div>

      {/* 7. Динамический Outro CTA Оверлей (финальные 4–5 сек в Safe Zone Shorts) */}
      {isOutroActive && (
        <div
          style={{
            position: 'absolute',
            bottom: 240, // Безопасная зона выше описания Shorts
            left: 50,
            right: 50,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            padding: '24px 30px',
            borderRadius: 28,
            backgroundColor: 'rgba(10, 11, 14, 0.92)',
            border: `1.5px solid ${theme.accentColor || '#00F0FF'}`,
            backdropFilter: 'blur(24px)',
            boxShadow: `0 0 45px ${theme.accentColor}55`,
            zIndex: 35,
            opacity: outroProgress,
            transform: `translateY(${(1 - outroProgress) * 20}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 32 }}>👇</span>
            <span
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: theme.accentColor || '#00F0FF',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              Исходники и бот в закрепе
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '10px 24px',
              borderRadius: 18,
            }}
          >
            <span style={{ fontSize: 24, color: '#38BDF8' }}>✈</span>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF' }}>
              {brandBotHandle} • Фарми баллы в TMA
            </span>
          </div>
        </div>
      )}

      {/* 8. Нижний прогресс-бар в градиенте стиля */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          zIndex: 30,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background:
              theme.progressGradient ||
              'linear-gradient(90deg, #00F0FF 0%, #A855F7 60%, #FF007A 100%)',
            boxShadow: `0 0 20px ${theme.accentColor || '#00F0FF'}`,
            transition: 'width 0.03s linear',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
