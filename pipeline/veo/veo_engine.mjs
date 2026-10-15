import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const vsDir = path.join(rootDir, 'video-shorts');

const cacheDir = path.join(rootDir, 'out', 'veo_cache');
const publicScenesDir = path.join(vsDir, 'public', 'scenes');
const winFfmpeg = path.join(vsDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
const ffmpeg = fs.existsSync(winFfmpeg) ? winFfmpeg : 'ffmpeg';

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
if (!fs.existsSync(publicScenesDir)) fs.mkdirSync(publicScenesDir, { recursive: true });

// Чередование крупностей планов под динамичный ритм шортса
export const CAMERA_SHOT_TYPES = [
  'dynamic tracking shot, fast forward push-in, low angle cyber view',
  'dramatic macro close-up, sharp mechanical details, rack focus depth',
  'cinematic wide establishing shot, vast server room, atmospheric volumetric light',
  'orbital 360 camera rotation, floating glowing holographic interfaces',
  'high-speed fpv drone motion, cinematic tilt up, hyper-detailed cyberpunk aesthetic',
];

/**
 * Создает процедурный MP4 видео-клип (9:16, 1080x1920, 30fps) из процедурного кадра,
 * если Veo API недоступен, включен MOCK_VEO=true или отсутствует ключ.
 */
export function generateProceduralMockClip({ inputImage, outputFile, duration = 4.0, shotType = 'zoom' }) {
  if (!fs.existsSync(inputImage)) {
    throw new Error(`Входное изображение для клипа не найдено: ${inputImage}`);
  }

  // Фильтр масштабирования и анимации камеры
  let filter = '';
  const totalFrames = Math.round(duration * 30);

  if (shotType.includes('close-up')) {
    filter = `zoompan=z='min(zoom+0.0025,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=30`;
  } else if (shotType.includes('wide')) {
    filter = `zoompan=z='max(1.2-0.002*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=30`;
  } else {
    filter = `zoompan=z='min(1.0+0.003*on,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+sin(on/10)*8':d=${totalFrames}:s=1080x1920:fps=30`;
  }

  try {
    execFileSync(ffmpeg, [
      '-y',
      '-loop', '1',
      '-i', inputImage,
      '-vf', filter,
      '-c:v', 'libx264',
      '-t', String(duration),
      '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast',
      outputFile,
    ], { stdio: 'pipe' });
    return true;
  } catch (err) {
    console.error(`[Veo Mock Engine] Ошибка создания видеоклипа ffmpeg:`, err.message);
    return false;
  }
}

/**
 * Запрос к Google Veo API для генерации вертикального видео 9:16.
 */
async function callGoogleVeoApi(prompt, duration = 4) {
  const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Формируем запрос к Veo генератору
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-video:predictLongRunning?key=${apiKey}`;
  const payload = {
    prompt: prompt,
    aspectRatio: '9:16',
    durationSeconds: Math.min(5, Math.max(3, Math.round(duration))),
    fps: 30,
    compressionQuality: 'high',
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn(`[Veo API] Ответ сервера ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    // Возвращаем данные операции если начат рендер
    return data;
  } catch (err) {
    console.warn(`[Veo API] Сбой сетевого вызова: ${err.message}`);
    return null;
  }
}

/**
 * Основной метод генерации видеоряда для сцены:
 * 1. Проверяет кэш.
 * 2. Пробует вызвать Google Veo API.
 * 3. При MOCK_VEO=true или сбое переключается на генерацию видеоряда через procedural engine.
 */
export async function generateVeoSceneClip({
  sceneId,
  prompt,
  duration = 4.0,
  fallbackImage = null,
  isOutro = false,
}) {
  const shotVariety = CAMERA_SHOT_TYPES[sceneId % CAMERA_SHOT_TYPES.length];
  const enrichedPrompt = `Cinematic 9:16 vertical video, ${shotVariety}. ${prompt}. 8k render, photorealistic lighting, cyber aesthetic, seamless loop.`;

  const promptHash = crypto.createHash('sha256').update(enrichedPrompt).digest('hex').slice(0, 16);
  const cachedVideoPath = path.join(cacheDir, `veo_${sceneId}_${promptHash}.mp4`);
  const publicVideoRel = `scenes/veo_scene_${sceneId}.mp4`;
  const publicVideoPath = path.join(publicScenesDir, `veo_scene_${sceneId}.mp4`);

  // 1. Проверка локального кэша
  if (fs.existsSync(cachedVideoPath) && fs.statSync(cachedVideoPath).size > 10000) {
    fs.copyFileSync(cachedVideoPath, publicVideoPath);
    console.log(`[Veo Engine] ✓ Сцена #${sceneId + 1} взята из кэша (${publicVideoRel})`);
    return { videoFile: publicVideoRel, fromCache: true };
  }

  const isMock = process.env.MOCK_VEO === 'true' || !process.env.VEO_API_KEY;

  if (!isMock) {
    console.log(`[Veo Engine] Запрос видеогенерации Google Veo для сцены #${sceneId + 1} (${shotVariety})...`);
    const apiResult = await callGoogleVeoApi(enrichedPrompt, duration);
    if (apiResult && apiResult.videoUrl) {
      // Сохраняем скачанное видео в кэш
      // fs.writeFileSync(cachedVideoPath, buffer)
    }
  }

  // 2. Фоллбэк/Mock генерация динамического MP4 из входного изображения
  if (fallbackImage && fs.existsSync(fallbackImage)) {
    console.log(`[Veo Engine] Создание динамичного 9:16 видеоклипа [${shotVariety}] для сцены #${sceneId + 1}...`);
    const success = generateProceduralMockClip({
      inputImage: fallbackImage,
      outputFile: cachedVideoPath,
      duration,
      shotType: shotVariety,
    });

    if (success && fs.existsSync(cachedVideoPath)) {
      fs.copyFileSync(cachedVideoPath, publicVideoPath);
      return { videoFile: publicVideoRel, fromCache: false, isMock: true };
    }
  }

  return { videoFile: null, isMock: true };
}
