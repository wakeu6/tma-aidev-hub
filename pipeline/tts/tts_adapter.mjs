import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const vsDir = path.join(rootDir, 'video-shorts');

const pythonExe = fs.existsSync(path.join(rootDir, '.venv', 'Scripts', 'python.exe'))
  ? path.join(rootDir, '.venv', 'Scripts', 'python.exe')
  : 'python';

const winFfprobe = path.join(vsDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe');
const ffprobe = fs.existsSync(winFfprobe) ? winFfprobe : 'ffprobe';

/**
 * Синтезирует аудио сегмента через ElevenLabs / Edge-TTS
 * и вычисляет кинетические тайминги для субтитров Remotion.
 */
export async function synthesizeHumanSegment({
  text,
  displayWords,
  outputFile,
  rate = '+5%',
  voice = 'ru-RU-DmitryNeural',
  elevenKey = null,
}) {
  const scriptPath = path.join(__dirname, 'synthesize_tts_human.py');
  const args = [
    scriptPath,
    '--text', text,
    '--voice', voice,
    '--rate', rate,
    '--output', outputFile,
  ];

  const effectiveKey = elevenKey || process.env.ELEVENLABS_API_KEY;
  if (effectiveKey) {
    args.push('--eleven-key', effectiveKey);
  }

  // Запуск синтезатора
  try {
    execFileSync(pythonExe, args, { cwd: rootDir, stdio: 'pipe' });
  } catch (err) {
    throw new Error(`Ошибка синтеза сегмента TTS: ${err.message}`);
  }

  if (!fs.existsSync(outputFile) || fs.statSync(outputFile).size < 500) {
    throw new Error(`Файл аудио сегмента ${outputFile} пуст или отсутствует`);
  }

  // Замер точной длительности через ffprobe
  const duration = parseFloat(
    execFileSync(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      outputFile,
    ]).toString().trim()
  );

  return { duration, outputFile };
}

/**
 * Рассчитывает пословные кинетические тайминги с учетом длины слов и знаков препинания.
 */
export function calculateWordTimings(words, segDuration, globalStartTime) {
  const weights = words.map((w) => {
    let len = w.length;
    if (/[.,!?;:]$/.test(w)) len += 2.5; // Микро-пауза на знаках препинания
    return Math.max(2, len);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const wordTimings = [];
  let currentStart = globalStartTime;

  for (let i = 0; i < words.length; i++) {
    const wordDur = (weights[i] / totalWeight) * segDuration;
    const wordEnd = currentStart + wordDur;
    wordTimings.push({
      word: words[i],
      start: Number(currentStart.toFixed(2)),
      end: Number(wordEnd.toFixed(2)),
    });
    currentStart = wordEnd;
  }

  return wordTimings;
}
