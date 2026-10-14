import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { enrichImagePrompt, getStylePreset } from './styles_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname.endsWith('video-shorts') ? path.resolve(__dirname, '..') : __dirname;
const vsDir = path.join(rootDir, 'video-shorts');

const scenesDirPublic = path.join(vsDir, 'public', 'scenes');
const scenesDirAssets = path.join(vsDir, 'assets', 'scenes');
const rootScenesDir = path.join(rootDir, 'out', 'scenes');

if (!fs.existsSync(scenesDirPublic)) fs.mkdirSync(scenesDirPublic, { recursive: true });
if (!fs.existsSync(scenesDirAssets)) fs.mkdirSync(scenesDirAssets, { recursive: true });
if (!fs.existsSync(rootScenesDir)) fs.mkdirSync(rootScenesDir, { recursive: true });

export const KEN_BURNS_MOTIONS = ['zoom_in', 'zoom_out', 'pan_up', 'pan_down', 'tilt_zoom'];

/**
 * Генерация высокотехнологичного процедурного SVG-кадра (9:16, 1080x1920)
 * с глубиной резкости, карточками кода и стилизацией под выбранный пресет.
 */
export function generateSvgScene({ id, text, stylePreset, imagePrompt }) {
  const preset = typeof stylePreset === 'string' ? getStylePreset(stylePreset) : stylePreset;
  const theme = preset.theme;

  const bg = theme.bgColor || '#05060A';
  const accent = theme.accentColor || '#00F0FF';
  const subtitleColor = theme.subtitleActiveColor || '#00F0FF';

  // Различные типы карточек в зависимости от номера сцены (0: терминал, 1: архитектура, 2: правила/код, 3: тесты/производительность, 4: результат)
  const cardTypes = ['terminal', 'architecture', 'rules', 'benchmark', 'success'];
  const cardType = cardTypes[id % cardTypes.length];

  let cardContent = '';
  if (cardType === 'terminal') {
    cardContent = `
      <text x="60" y="160" font-family="monospace" font-size="32" fill="${accent}">❯ ai agent --mode autonomous</text>
      <text x="60" y="230" font-family="monospace" font-size="28" fill="#7EE787">✔ Context loaded: full workspace</text>
      <text x="60" y="290" font-family="monospace" font-size="28" fill="#7EE787">✔ Generating clean architecture</text>
      <text x="60" y="350" font-family="monospace" font-size="28" fill="#7EE787">✔ 0 compile errors | 100% tests passed</text>
      <rect x="50" y="420" width="780" height="380" rx="20" fill="#161B22" stroke="#30363D"/>
      <text x="80" y="500" font-family="monospace" font-size="28" fill="#FF7B72">export const</text>
      <text x="290" y="500" font-family="monospace" font-size="28" fill="#79C0FF">fastWorkflow</text>
      <text x="510" y="500" font-family="monospace" font-size="28" fill="#E6EDF3">= async () =&gt; {</text>
      <text x="120" y="570" font-family="monospace" font-size="28" fill="#D2A8FF">  const boost</text>
      <text x="320" y="570" font-family="monospace" font-size="28" fill="#E6EDF3">= await ai.speed();</text>
      <text x="120" y="640" font-family="monospace" font-size="28" fill="#D2A8FF">  return boost</text>
      <text x="330" y="640" font-family="monospace" font-size="28" fill="#79C0FF">* 10; // 1 dev = team</text>
      <text x="80" y="710" font-family="monospace" font-size="28" fill="#E6EDF3">};</text>
    `;
  } else if (cardType === 'architecture') {
    cardContent = `
      <text x="60" y="150" font-family="monospace" font-size="32" fill="${accent}">ARCHITECTURE // MULTI-AGENT</text>
      <!-- Node 1 -->
      <rect x="80" y="220" width="320" height="140" rx="16" fill="#1F2937" stroke="${accent}" stroke-width="2"/>
      <text x="240" y="280" font-family="monospace" font-size="24" fill="#FFFFFF" text-anchor="middle">Agent Planner</text>
      <text x="240" y="320" font-family="monospace" font-size="20" fill="#9CA3AF" text-anchor="middle">Task Decomposition</text>
      <!-- Arrow -->
      <line x1="400" y1="290" x2="480" y2="290" stroke="${accent}" stroke-width="3" stroke-dasharray="6,6"/>
      <!-- Node 2 -->
      <rect x="480" y="220" width="320" height="140" rx="16" fill="#1F2937" stroke="#10B981" stroke-width="2"/>
      <text x="640" y="280" font-family="monospace" font-size="24" fill="#FFFFFF" text-anchor="middle">Code Generator</text>
      <text x="640" y="320" font-family="monospace" font-size="20" fill="#9CA3AF" text-anchor="middle">TypeScript &amp; React</text>
      <!-- Node 3 -->
      <rect x="280" y="440" width="320" height="140" rx="16" fill="#1F2937" stroke="#F59E0B" stroke-width="2"/>
      <text x="440" y="500" font-family="monospace" font-size="24" fill="#FFFFFF" text-anchor="middle">Automated QA</text>
      <text x="440" y="540" font-family="monospace" font-size="20" fill="#9CA3AF" text-anchor="middle">Zero Hallucinations</text>
      <line x1="640" y1="360" x2="440" y2="440" stroke="#10B981" stroke-width="3"/>
      <text x="440" y="670" font-family="monospace" font-size="28" fill="${accent}" text-anchor="middle">⚡ Full Pipeline Automated</text>
    `;
  } else if (cardType === 'rules') {
    cardContent = `
      <text x="60" y="150" font-family="monospace" font-size="32" fill="${accent}">RULESET // .cursorrules</text>
      <rect x="60" y="200" width="760" height="110" rx="14" fill="#111827" stroke="#374151"/>
      <text x="100" y="260" font-family="monospace" font-size="24" fill="#10B981">1. Do not modify working files without permission</text>
      <rect x="60" y="340" width="760" height="110" rx="14" fill="#111827" stroke="#374151"/>
      <text x="100" y="400" font-family="monospace" font-size="24" fill="#60A5FA">2. Enforce strict tech stack versions</text>
      <rect x="60" y="480" width="760" height="110" rx="14" fill="#111827" stroke="#374151"/>
      <text x="100" y="540" font-family="monospace" font-size="24" fill="#F43F5E">3. Generate unit tests alongside all logic</text>
      <text x="440" y="670" font-family="monospace" font-size="30" fill="${subtitleColor}" text-anchor="middle">RESULT: 3X CODE PURITY</text>
    `;
  } else if (cardType === 'benchmark') {
    cardContent = `
      <text x="60" y="150" font-family="monospace" font-size="32" fill="${accent}">SWE-BENCH 2026 BENCHMARK</text>
      <!-- Bars -->
      <text x="60" y="240" font-family="monospace" font-size="24" fill="#E5E7EB">Claude 3.7 Sonnet (Thinking)</text>
      <rect x="60" y="260" width="720" height="45" rx="8" fill="${accent}"/>
      <text x="750" y="292" font-family="monospace" font-size="24" fill="${accent}">70.3%</text>

      <text x="60" y="360" font-family="monospace" font-size="24" fill="#9CA3AF">Legacy Models (Standard)</text>
      <rect x="60" y="380" width="460" height="45" rx="8" fill="#4B5563"/>
      <text x="490" y="412" font-family="monospace" font-size="24" fill="#9CA3AF">43.8%</text>

      <text x="60" y="480" font-family="monospace" font-size="24" fill="#9CA3AF">Manual Coding Baseline</text>
      <rect x="60" y="500" width="310" height="45" rx="8" fill="#374151"/>
      <text x="340" y="532" font-family="monospace" font-size="24" fill="#6B7280">29.1%</text>

      <text x="440" y="660" font-family="monospace" font-size="30" fill="#10B981" text-anchor="middle">⚡ +240% Productivity Advantage</text>
    `;
  } else {
    cardContent = `
      <circle cx="440" cy="270" r="90" fill="none" stroke="${accent}" stroke-width="6"/>
      <path d="M 390 270 L 425 305 L 495 235" fill="none" stroke="#10B981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="440" y="430" font-family="monospace" font-size="38" font-weight="bold" fill="#FFFFFF" text-anchor="middle">PRODUCTION READY</text>
      <text x="440" y="490" font-family="monospace" font-size="26" fill="#9CA3AF" text-anchor="middle">Dev Ops, Tests &amp; Logic Verified</text>
      <rect x="140" y="550" width="600" height="90" rx="45" fill="${accent}" fill-opacity="0.15" stroke="${accent}" stroke-width="2"/>
      <text x="440" y="605" font-family="monospace" font-size="28" fill="${accent}" font-weight="bold" text-anchor="middle">JOIN VIBE CODING REVOLUTION</text>
    `;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
  <defs>
    <radialGradient id="bgGlow_${id}" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
      <stop offset="60%" stop-color="#000000" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${bg}" stop-opacity="1"/>
    </radialGradient>
    <pattern id="grid_${id}" width="70" height="70" patternUnits="userSpaceOnUse">
      <path d="M 70 0 L 0 0 0 70" fill="none" stroke="#FFFFFF" stroke-opacity="0.04" stroke-width="1"/>
    </pattern>
    <filter id="cardGlow_${id}">
      <feGaussianBlur stdDeviation="20" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Ambient Backdrop -->
  <rect width="1080" height="1920" fill="${bg}"/>
  <rect width="1080" height="1920" fill="url(#bgGlow_${id})"/>
  <rect width="1080" height="1920" fill="url(#grid_${id})"/>

  <!-- Centered Glass Card with High Depth-of-Field Contrast -->
  <g transform="translate(100, 520)">
    <rect width="880" height="840" rx="36" fill="#0B0F17" fill-opacity="0.88" stroke="${accent}" stroke-width="2" stroke-opacity="0.45" filter="url(#cardGlow_${id})"/>
    <circle cx="50" cy="50" r="12" fill="#FF5F56"/>
    <circle cx="85" cy="50" r="12" fill="#FFBD2E"/>
    <circle cx="120" cy="50" r="12" fill="#27C93F"/>
    <text x="440" y="58" font-family="monospace" font-size="22" fill="#6B7280" text-anchor="middle">SCENE ${id + 1} — ${preset.name.toUpperCase()}</text>
    <line x1="0" y1="90" x2="880" y2="90" stroke="#1F2937" stroke-width="1.5"/>

    ${cardContent}
  </g>
</svg>
  `.trim();
}

/**
 * Загрузка сгенерированного изображения через AI Image API (с прокси при наличии)
 */
async function fetchAiImage(prompt, outputPath, timeoutMs = 12000) {
  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(prompt.slice(0, 200));
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=720&height=1280&nologo=true&seed=${seed}`;

  // Используем Python через прокси для 100% стабильного TLS-соединения
  const { execFileSync } = await import('child_process');
  const pyScript = `
import urllib.request, sys
proxy = urllib.request.ProxyHandler({'http': 'http://127.0.0.1:10809', 'https': 'http://127.0.0.1:10809'})
opener = urllib.request.build_opener(proxy)
req = urllib.request.Request(sys.argv[1], headers={'User-Agent': 'Mozilla/5.0'})
with opener.open(req, timeout=10) as r:
    data = r.read()
    if len(data) < 5000:
        sys.exit(1)
    with open(sys.argv[2], 'wb') as f:
        f.write(data)
`;
  execFileSync('python', ['-c', pyScript, url, outputPath]);
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 5000) {
    throw new Error('Файл не был сохранен или слишком мал');
  }
  return fs.statSync(outputPath).size;
}

/**
 * Генерация полного набора кадров для всех смысловых сцен ролика
 */
export async function generateScenesVisuals(scenes, stylePreset) {
  const preset = typeof stylePreset === 'string' ? getStylePreset(stylePreset) : stylePreset;
  console.log(`[Image Subagent] Генерация визуалов для ${scenes.length} сцен в стиле "${preset.name}"...`);

  const processedScenes = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const motionType = KEN_BURNS_MOTIONS[i % KEN_BURNS_MOTIONS.length];
    const finalPrompt = enrichImagePrompt(scene.imagePrompt || scene.text, preset);

    console.log(`[Image Subagent] Сцена #${i + 1} (${motionType}): "${(scene.text || '').slice(0, 45)}..."`);

    let targetFile = `scenes/scene_${i}.jpg`;
    const jpgDest = path.join(scenesDirPublic, `scene_${i}.jpg`);
    const svgDest = path.join(scenesDirPublic, `scene_${i}.svg`);

    let successAi = false;
    try {
      const bytes = await fetchAiImage(finalPrompt, jpgDest);
      console.log(`[Image Subagent] ✓ Сцена #${i + 1} сгенерирована через AI (${(bytes / 1024).toFixed(1)} KB)`);
      targetFile = `scenes/scene_${i}.jpg`;
      successAi = true;
    } catch (e) {
      // При ограничении внешнего AI генерируем специализированный векторный кадр высокого разрешения
      console.log(`[Image Subagent] Создание высокоточного процедурного SVG-кадра для сцены #${i + 1}...`);
      const svgContent = generateSvgScene({
        id: i,
        text: scene.text,
        stylePreset: preset,
        imagePrompt: finalPrompt,
      });
      fs.writeFileSync(svgDest, svgContent, 'utf8');
      targetFile = `scenes/scene_${i}.svg`;
    }

    // Зеркалируем сгенерированный кадр
    try {
      const src = successAi ? jpgDest : svgDest;
      const baseName = path.basename(src);
      fs.copyFileSync(src, path.join(scenesDirAssets, baseName));
      fs.copyFileSync(src, path.join(rootScenesDir, baseName));
    } catch (e) {}

    processedScenes.push({
      id: i,
      text: scene.text,
      displayWords: scene.displayWords,
      imageFile: targetFile,
      imagePrompt: finalPrompt,
      kenBurns: motionType,
      startTime: scene.startTime || 0,
      endTime: scene.endTime || 0,
      duration: scene.duration || 0,
    });
  }

  console.log(`[Image Subagent] Все кадры (${processedScenes.length} шт.) успешно подготовлены к анимации!`);
  return processedScenes;
}
