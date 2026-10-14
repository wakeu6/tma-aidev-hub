import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const musicDirs = [
  path.resolve(rootDir, 'assets', 'music'),
  path.resolve(__dirname, 'assets', 'music'),
];

export function getMusicDir() {
  for (const dir of musicDirs) {
    if (fs.existsSync(dir)) return dir;
  }
  const defaultDir = musicDirs[0];
  fs.mkdirSync(defaultDir, { recursive: true });
  return defaultDir;
}

export function getFfmpegPath() {
  const candidates = [
    path.join(rootDir, 'video-shorts', 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe'),
    path.join(__dirname, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffmpeg';
}

export function getFfprobePath() {
  const candidates = [
    path.join(rootDir, 'video-shorts', 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe'),
    path.join(__dirname, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'ffprobe';
}

// 10 проверенных инструментальных треков без авторских прав (CC-BY / Public Domain, безопасные для YouTube Shorts)
const VERIFIED_TRACKS = [
  {
    name: 'chill_lofi_carefree.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3',
  },
  {
    name: 'lofi_vibes_chill.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Chill.mp3',
  },
  {
    name: 'ambient_deliberate_thought.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Deliberate%20Thought.mp3',
  },
  {
    name: 'smooth_chillhop_lovin.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Smooth%20Lovin.mp3',
  },
  {
    name: 'protofunk_chill_beat.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Protofunk.mp3',
  },
  {
    name: 'ambient_dispersion.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dispersion%20Relation.mp3',
  },
  {
    name: 'ambient_airport_lounge.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Airport%20Lounge.mp3',
  },
  {
    name: 'bossa_chill_antigua.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bossa%20Antigua.mp3',
  },
  {
    name: 'feelin_good_groove.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Feelin%20Good.mp3',
  },
  {
    name: 'playful_sneaky_snitch.mp3',
    url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3',
  },
];

/**
 * Проверка наличия аудиофайлов в папке assets/music.
 * Если файлов меньше 7, скачивает недостающие треки.
 */
export async function ensureMusicLibrary() {
  const musicDir = getMusicDir();
  let existingFiles = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|ogg)$/i.test(f));

  if (existingFiles.length >= 7) {
    console.log(`[BGM Engine] Музыкальная библиотека уже содержит ${existingFiles.length} треков. Повторная загрузка не требуется.`);
    return existingFiles.map((f) => path.join(musicDir, f));
  }

  console.log(`[BGM Engine] В библиотеке ${existingFiles.length} треков. Загрузка треков без авторских прав...`);

  for (const track of VERIFIED_TRACKS) {
    const destPath = path.join(musicDir, track.name);
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100000) {
      continue;
    }

    try {
      console.log(`[BGM Engine] Загрузка: ${track.name}...`);
      const res = await fetch(track.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        console.warn(`[BGM Engine] Не удалось загрузить ${track.name} (HTTP ${res.status})`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      console.log(`[BGM Engine] Сохранен: ${track.name} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      console.warn(`[BGM Engine] Ошибка при скачивании ${track.name}:`, err.message);
    }
  }

  // Синхронизируем директории
  for (const dir of musicDirs) {
    if (dir !== musicDir) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const current = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|ogg)$/i.test(f));
      for (const f of current) {
        const src = path.join(musicDir, f);
        const dst = path.join(dir, f);
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
  }

  existingFiles = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|ogg)$/i.test(f));
  console.log(`[BGM Engine] Музыкальная библиотека готова: ${existingFiles.length} треков.`);
  return existingFiles.map((f) => path.join(musicDir, f));
}

/**
 * Выбор случайного фонового трека
 */
export async function getRandomBgmTrack() {
  const musicDir = getMusicDir();
  let files = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|ogg)$/i.test(f));

  if (files.length === 0) {
    await ensureMusicLibrary();
    files = fs.readdirSync(musicDir).filter((f) => /\.(mp3|wav|ogg)$/i.test(f));
  }

  const chosen = files[Math.floor(Math.random() * files.length)];
  return path.join(musicDir, chosen);
}

/**
 * Получение длительности медиафайла через ffprobe
 */
export function getMediaDuration(filePath) {
  const ffprobe = getFfprobePath();
  const stdout = execFileSync(ffprobe, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]).toString().trim();
  return parseFloat(stdout);
}

/**
 * Микширование звука в видео через FFmpeg:
 * - Выбор случайного трека
 * - Зацикливание BGM (-stream_loop -1)
 * - Громкость музыки: 10–12% (volume=0.12)
 * - Плавное затухание (fade out) в последние 1.5–2 секунды (afade=t=out:st=...:d=2)
 * - Обрезка строго по длине видео (-t)
 */
export function mixBgmIntoVideo({ inputVideo, bgmTrack, outputVideo }) {
  const ffmpeg = getFfmpegPath();
  const duration = getMediaDuration(inputVideo);

  // Время начала плавного затухания: за 2 секунды до конца ролика
  const fadeDuration = 2.0;
  const fadeStart = Math.max(0, duration - fadeDuration);

  console.log(`[BGM Engine] Микширование фонового трека: ${path.basename(bgmTrack)}`);
  console.log(`[BGM Engine] Длительность видео: ${duration.toFixed(2)}s, Fade out с ${fadeStart.toFixed(2)}s (длительность ${fadeDuration}s)`);

  const tempOut = outputVideo + '.temp.mp4';
  if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);

  // Фильтр-граф FFmpeg:
  // [0:a] - оригинальный голос (volume=1.0) с плавным затуханием в последние fadeDuration сек
  // [1:a] - фоновая музыка (volume=0.12 = 12%) с плавным затуханием в последние fadeDuration сек
  // amix объединяет аудиопотоки
  const voiceVolExpr = `volume='if(isnan(t),1,if(gte(t,${fadeStart.toFixed(2)}),max(0,1-(t-${fadeStart.toFixed(2)})/${fadeDuration.toFixed(2)}),1))':eval=frame`;
  const bgmVolExpr = `volume='if(isnan(t),0.12,if(gte(t,${fadeStart.toFixed(2)}),max(0,0.12*(1-(t-${fadeStart.toFixed(2)})/${fadeDuration.toFixed(2)})),0.12))':eval=frame`;

  const filterComplex = [
    `[0:a]${voiceVolExpr}[voice]`,
    `[1:a]${bgmVolExpr}[bgm]`,
    `[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
  ].join(';');

  execFileSync(ffmpeg, [
    '-y',
    '-i', inputVideo,
    '-stream_loop', '-1',
    '-i', bgmTrack,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[aout]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-t', duration.toFixed(2),
    tempOut,
  ]);

  if (fs.existsSync(outputVideo)) {
    fs.unlinkSync(outputVideo);
  }
  fs.renameSync(tempOut, outputVideo);

  console.log(`[BGM Engine] Финальное видео с музыкой создано: ${outputVideo} (${(fs.statSync(outputVideo).size / 1024 / 1024).toFixed(2)} MB)`);
  return outputVideo;
}

if (process.argv[1] && process.argv[1].endsWith('bgm_engine.mjs')) {
  ensureMusicLibrary().catch(console.error);
}
