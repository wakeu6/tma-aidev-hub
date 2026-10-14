/**
 * Style Variation Engine
 * Управляет визуально-повествовательными стилями для YouTube Shorts.
 */

export const STYLE_PRESETS = {
  dark_gritty: {
    id: 'dark_gritty',
    name: 'Dark / Gritty Storytelling',
    badgeText: 'DARK TECH // CODE NOIR',
    description: 'Мрачные тона, кинематографичный контраст, низкий ключ, драматический темп, глубокие тени и приглушенный кибер-неон.',
    promptSuffix: 'cinematic lighting, low key, dark moody atmosphere, gritty film texture, high contrast deep shadows, cyberpunk noir, hyperrealistic depth of field, sharp foreground, blurred dark background, 8k resolution, vertical 9:16 aspect ratio composition, photorealistic masterpiece',
    theme: {
      bgColor: '#05060A',
      accentColor: '#00F0FF',
      subtitleActiveColor: '#00F0FF',
      subtitleInactiveColor: '#E2E8F0',
      subtitleShadow: '0 0 32px rgba(0,240,255,0.85), 0 0 60px rgba(0,240,255,0.35), 0 4px 14px rgba(0,0,0,0.95)',
      badgeBg: 'rgba(5, 8, 16, 0.75)',
      badgeBorder: '1px solid rgba(0, 240, 255, 0.45)',
      badgeColor: '#00F0FF',
      vignetteIntensity: 0.75,
      kenBurnsIntensity: 1.15,
      overlayFilter: 'contrast(1.22) brightness(0.88) saturate(1.05)',
      progressGradient: 'linear-gradient(90deg, #00F0FF 0%, #3B82F6 100%)',
    },
  },
  y2k_retro: {
    id: 'y2k_retro',
    name: 'Y2K / Retro Vibe',
    badgeText: 'Y2K RETRO // CYBER GLITCH',
    description: 'Неоновые акценты, легкий глитч, зернистость CRT, динамичный монтаж, ностальгическая эстетика 2000-х и vaporwave.',
    promptSuffix: 'y2k retro aesthetic, neon magenta and cyan backlighting, crt scanlines texture, vibrant saturated colors, early 2000s cyber tech, depth of field, focused subject, blurred atmospheric background, 8k resolution, vertical 9:16 aspect ratio, dramatic cinematic angle',
    theme: {
      bgColor: '#090414',
      accentColor: '#FF007A',
      subtitleActiveColor: '#FF007A',
      subtitleInactiveColor: '#F3E8FF',
      subtitleShadow: '0 0 35px rgba(255,0,122,0.9), 0 0 70px rgba(0,240,255,0.45), 0 4px 14px rgba(0,0,0,0.95)',
      badgeBg: 'rgba(20, 5, 30, 0.75)',
      badgeBorder: '1px solid rgba(255, 0, 122, 0.55)',
      badgeColor: '#FF007A',
      vignetteIntensity: 0.55,
      kenBurnsIntensity: 1.20,
      overlayFilter: 'contrast(1.18) saturate(1.35)',
      progressGradient: 'linear-gradient(90deg, #FF007A 0%, #A855F7 60%, #00F0FF 100%)',
    },
  },
  minimalist_tech: {
    id: 'minimalist_tech',
    name: 'Minimalist / Tech Modern',
    badgeText: 'MINIMAL TECH // LINEAR DEV',
    description: 'Строгая геометрия, чистый свет, акцент на инфографику, четкие объекты, премиальный Apple/Linear дизайн-код.',
    promptSuffix: 'minimalist modern architecture, clean studio lighting, dark graphite matte surfaces, sleek glowing emerald and white tech lines, ultra sharp focus on foreground object, soft depth of field background, 8k resolution, vertical 9:16 aspect ratio composition, immaculate modern aesthetics',
    theme: {
      bgColor: '#08090C',
      accentColor: '#10B981',
      subtitleActiveColor: '#34D399',
      subtitleInactiveColor: '#F1F5F9',
      subtitleShadow: '0 0 30px rgba(16,185,129,0.75), 0 4px 14px rgba(0,0,0,0.95)',
      badgeBg: 'rgba(15, 23, 42, 0.75)',
      badgeBorder: '1px solid rgba(52, 211, 153, 0.4)',
      badgeColor: '#34D399',
      vignetteIntensity: 0.45,
      kenBurnsIntensity: 1.12,
      overlayFilter: 'contrast(1.08) brightness(0.96)',
      progressGradient: 'linear-gradient(90deg, #10B981 0%, #34D399 100%)',
    },
  },
  street_grunge: {
    id: 'street_grunge',
    name: 'Dynamic Street / Grunge',
    badgeText: 'STREET GRUNGE // DEV REBEL',
    description: 'Агрессивные смены планов, уличная эстетика, высокий контраст, текстуры бетона и граффити, дерзкий постерный стиль.',
    promptSuffix: 'urban street art poster style, raw grunge textures, concrete background, neon yellow and spray paint accents, edgy high contrast lighting, distinct foreground subject, moody depth of field, 8k resolution, vertical 9:16 aspect ratio composition, bold underground aesthetic',
    theme: {
      bgColor: '#070707',
      accentColor: '#FFE600',
      subtitleActiveColor: '#FFE600',
      subtitleInactiveColor: '#FFFFFF',
      subtitleShadow: '0 0 35px rgba(255,230,0,0.9), 0 4px 14px rgba(0,0,0,0.95)',
      badgeBg: 'rgba(10, 10, 10, 0.85)',
      badgeBorder: '2px solid rgba(255, 230, 0, 0.7)',
      badgeColor: '#FFE600',
      vignetteIntensity: 0.65,
      kenBurnsIntensity: 1.22,
      overlayFilter: 'contrast(1.28) saturate(1.15)',
      progressGradient: 'linear-gradient(90deg, #FFE600 0%, #F59E0B 100%)',
    },
  },
};

/**
 * Получение пресета стиля (по ключу или случайно)
 */
export function getStylePreset(styleKey = null) {
  const keys = Object.keys(STYLE_PRESETS);
  if (styleKey && STYLE_PRESETS[styleKey]) {
    return STYLE_PRESETS[styleKey];
  }
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return STYLE_PRESETS[randomKey];
}

/**
 * Обогащение промпта сцены визуальными тегами выбранного стиля
 */
export function enrichImagePrompt(basePrompt, stylePreset) {
  const preset = typeof stylePreset === 'string' ? getStylePreset(stylePreset) : stylePreset;
  return `${basePrompt.trim()}, ${preset.promptSuffix}`;
}
