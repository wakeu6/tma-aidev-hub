import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname.endsWith('video-shorts') ? path.resolve(__dirname, '..') : __dirname;
const vsDir = path.join(rootDir, 'video-shorts');

function getFfprobePath() {
  const p = path.join(vsDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe');
  return fs.existsSync(p) ? p : 'ffprobe';
}

function getFfmpegPath() {
  const p = path.join(vsDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
  return fs.existsSync(p) ? p : 'ffmpeg';
}

/**
 * Получение точной длительности медиафайла в секундах
 */
export function getExactDuration(filePath) {
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
 * Определение момента появления первого звука речи (voice onset) через silencedetect
 */
export function detectSpeechOnset(audioPath) {
  const ffmpeg = getFfmpegPath();
  try {
    const stderr = execFileSync(ffmpeg, [
      '-i', audioPath,
      '-af', 'silencedetect=noise=-32dB:d=0.08',
      '-f', 'null',
      '-',
    ], { stdio: ['pipe', 'pipe', 'pipe'] }).toString();

    const match = stderr.match(/silence_end:\s*([0-9.]+)/);
    if (match) {
      return parseFloat(match[1]);
    }
  } catch (e) {
    if (e.stderr) {
      const match = e.stderr.toString().match(/silence_end:\s*([0-9.]+)/);
      if (match) return parseFloat(match[1]);
    }
  }
  return 0.0;
}

/**
 * Аудио-видео валидатор (Sync & Pacing QA Subagent)
 *
 * Критерии:
 * 1. Видеоряд не обрывается раньше речи (videoDuration >= audioDuration).
 * 2. В конце нет висящих пауз более 0.5–1 секунды (endGap <= 1.0s).
 * 3. Рассинхрон субтитров (drift) не превышает 200 мс (0.2s).
 */
export async function validateShortsSync({ audioPath, videoPath, dataPath, autoFixFn = null }) {
  console.log('=== [QA Subagent] Валидация синхронизации и темпа ролика ===');

  if (!fs.existsSync(audioPath)) {
    return { status: 'FAILED', reason: `Аудиофайл не найден: ${audioPath}` };
  }
  if (!fs.existsSync(videoPath)) {
    return { status: 'FAILED', reason: `Видеофайл не найден: ${videoPath}` };
  }

  const audioDur = getExactDuration(audioPath);
  const videoDur = getExactDuration(videoPath);
  const endGap = Number((videoDur - audioDur).toFixed(3));

  console.log(`[QA Subagent] Длительность речи (TTS): ${audioDur.toFixed(3)}s`);
  console.log(`[QA Subagent] Длительность видео: ${videoDur.toFixed(3)}s`);
  console.log(`[QA Subagent] Финальный зазор (end gap): ${endGap.toFixed(3)}s`);

  let data = null;
  if (dataPath && fs.existsSync(dataPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {}
  }

  const failures = [];

  // Проверка 1: Видео не обрывается раньше конца речи
  if (videoDur < audioDur - 0.05) {
    failures.push(
      `ОБРЕЗКА РЕЧИ: Видеоряд (${videoDur.toFixed(2)}s) короче озвучки (${audioDur.toFixed(2)}s) на ${Math.abs(endGap).toFixed(2)}s!`
    );
  }

  // Проверка 2: Зазор в конце не должен превышать 1.0 секунды
  if (endGap > 1.0) {
    failures.push(
      `ПРОСАДКА УДЕРЖАНИЯ: Пауза в конце ролика ${endGap.toFixed(2)}s превышает порог 1.0s!`
    );
  }

  // Проверка 3: Рассинхрон субтитров (drift <= 200ms)
  let maxDriftMs = 0;
  if (data && Array.isArray(data.words) && data.words.length > 0) {
    const firstWord = data.words[0];
    const speechOnset = detectSpeechOnset(audioPath);
    const onsetDrift = Math.abs(firstWord.start - speechOnset);
    const lastWord = data.words[data.words.length - 1];
    const endDrift = Math.abs(lastWord.end - audioDur);

    maxDriftMs = Math.round(Math.max(onsetDrift, endDrift) * 1000);
    console.log(`[QA Subagent] Оценка синхронизации субтитров: onset drift = ${(onsetDrift * 1000).toFixed(0)}ms, end drift = ${(endDrift * 1000).toFixed(0)}ms (макс: ${maxDriftMs}ms)`);

    if (maxDriftMs > 200) {
      failures.push(
        `ДРЕЙФ СУБТИТРОВ: Рассинхрон таймингов речи и субтитров составляет ${maxDriftMs}ms (порог: 200ms)!`
      );
    }
  }

  // Если валидация пройдена
  if (failures.length === 0) {
    console.log('[QA Subagent] ✓ Все тесты пройдены! Статус: PASSED');
    return {
      status: 'PASSED',
      audioDuration: audioDur,
      videoDuration: videoDur,
      endGap,
      maxDriftMs,
    };
  }

  // Если валидация провалена
  console.warn('[QA Subagent] ✗ Обнаружены несоответствия:');
  failures.forEach((f) => console.warn(`  - ${f}`));

  if (typeof autoFixFn === 'function') {
    console.log('[QA Subagent] Запуск АВТО-КОРРЕКЦИИ длительности и таймингов...');
    const fixedTargetDuration = Number((audioDur + 0.35).toFixed(2));
    await autoFixFn({
      targetDuration: fixedTargetDuration,
      audioDuration: audioDur,
    });

    // Повторная инспекция после коррекции
    const newVideoDur = getExactDuration(videoPath);
    const newEndGap = Number((newVideoDur - audioDur).toFixed(3));
    console.log(`[QA Subagent] Повторная проверка: видео ${newVideoDur.toFixed(2)}s, зазор ${newEndGap.toFixed(2)}s`);

    if (newVideoDur >= audioDur - 0.05 && newEndGap <= 1.0) {
      console.log('[QA Subagent] ✓ Авто-коррекция успешна! Статус: PASSED');
      return {
        status: 'PASSED',
        audioDuration: audioDur,
        videoDuration: newVideoDur,
        endGap: newEndGap,
        autoFixed: true,
      };
    }
  }

  return {
    status: 'FAILED',
    reason: failures.join('; '),
    audioDuration: audioDur,
    videoDuration: videoDur,
    endGap,
    maxDriftMs,
  };
}
