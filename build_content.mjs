import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sharedDir = path.join(rootDir, 'shared');
const outDir = path.join(rootDir, 'out');
const ffprobePath = path.join(
  rootDir,
  'video-shorts',
  'node_modules',
  '@remotion',
  'compositor-win32-x64-msvc',
  'ffprobe.exe'
);
const ffmpegPath = path.join(
  rootDir,
  'video-shorts',
  'node_modules',
  '@remotion',
  'compositor-win32-x64-msvc',
  'ffmpeg.exe'
);

if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const trendPath = path.join(sharedDir, 'trend.json');
if (!fs.existsSync(trendPath)) {
  console.error('[Content] Error: shared/trend.json does not exist!');
  process.exit(1);
}
const trend = JSON.parse(fs.readFileSync(trendPath, 'utf8'));

console.log('=== SUBAUTOMATION 1: CONTENT ===');
console.log('Loaded trend:', trend.topic);
console.log('Hook:', trend.hook);

// 34-35 seconds total script
const segments = [
  {
    id: 1,
    name: 'Hook (0-5s)',
    text: 'Ты все еще пишешь код руками? В двадцать шестом году это уже мем.',
    displayWords: ['Ты', 'всё', 'ещё', 'пишешь', 'код', 'руками?', 'В', '2026', 'году', 'это', 'уже', 'мем.'],
    rate: '+5%',
  },
  {
    id: 2,
    name: 'Essence - Part 1 (5-12s)',
    text: 'Связка Cursor и Claude меняет правила игры. Мультифайловый агент сам раскладывает архитектуру и пишет логику.',
    displayWords: ['Связка', 'Cursor', 'и', 'Claude', 'меняет', 'правила', 'игры.', 'Мультифайловый', 'агент', 'сам', 'раскладывает', 'архитектуру', 'и', 'пишет', 'логику.'],
    rate: '+8%',
  },
  {
    id: 3,
    name: 'Essence - Part 2 (12-19s)',
    text: 'Второе: агент в терминале на лету запускает билд, отлавливает баги и сам фиксит упавшие тесты.',
    displayWords: ['Второе:', 'агент', 'в', 'терминале', 'на', 'лету', 'запускает', 'билд,', 'отлавливает', 'баги', 'и', 'сам', 'фиксит', 'упавшие', 'тесты.'],
    rate: '+8%',
  },
  {
    id: 4,
    name: 'Essence - Part 3 (19-27s)',
    text: 'И главное: умные правила в cursorrules заставляют модель выдавать чистый продакшн код без лишней воды.',
    displayWords: ['И', 'главное:', 'умные', 'правила', 'в', '.cursorrules', 'заставляют', 'модель', 'выдавать', 'чистый', 'продакшн-код', 'без', 'лишней', 'воды.'],
    rate: '+8%',
  },
  {
    id: 5,
    name: 'CTA (27-35s)',
    text: 'Один разработчик заменяет целую команду. Сохраняй ролик и пиши в комментариях: ты уже на vibe coding?',
    displayWords: ['Один', 'разработчик', 'заменяет', 'целую', 'команду.', 'Сохраняй', 'ролик', 'и', 'пиши', 'в', 'комментариях:', 'ты', 'уже', 'на', 'vibe', 'coding?'],
    rate: '+6%',
  },
];

function getDuration(filePath) {
  const stdout = execFileSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]).toString().trim();
  return parseFloat(stdout);
}

async function synthesizeSegment(tts, text, rate, outPath) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { audioStream } = tts.toStream(text, { rate, pitch: '+0Hz' });
      const ws = fs.createWriteStream(outPath);
      audioStream.pipe(ws);
      await new Promise((resolve, reject) => {
        let finished = false;
        audioStream.on('error', (e) => { if (!finished) { finished = true; reject(e); } });
        ws.on('error', (e) => { if (!finished) { finished = true; reject(e); } });
        ws.on('finish', () => { if (!finished) { finished = true; resolve(); } });
      });
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function main() {
  const tempDir = path.join(rootDir, 'temp_audio_build');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const tts = new MsEdgeTTS();
  await tts.setMetadata('ru-RU-DmitryNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const segmentFiles = [];
  const allWordTimings = [];
  let currentGlobalTime = 0.0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segFile = path.join(tempDir, `seg_${i}.mp3`);
    console.log(`[Content] Synthesizing ${seg.name}...`);
    await synthesizeSegment(tts, seg.text, seg.rate, segFile);
    await new Promise(r => setTimeout(r, 400));

    const segDuration = getDuration(segFile);
    console.log(`[Content] Segment ${i + 1} generated: duration ${segDuration.toFixed(2)}s`);
    segmentFiles.push(segFile);

    // Compute precise kinetic word-level timestamps for seg.displayWords
    const words = seg.displayWords;
    // Weight by length of word with slight punctuation padding
    const weights = words.map(w => {
      let len = w.length;
      if (/[.,!?;:]$/.test(w)) len += 2;
      return Math.max(2, len);
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let segWordStart = currentGlobalTime;
    for (let w = 0; w < words.length; w++) {
      const wordDur = (weights[w] / totalWeight) * segDuration;
      const wordEnd = segWordStart + wordDur;
      allWordTimings.push({
        word: words[w],
        start: Number(segWordStart.toFixed(2)),
        end: Number(wordEnd.toFixed(2)),
      });
      segWordStart = wordEnd;
    }

    currentGlobalTime += segDuration;
  }

  tts.close();

  // Concat all segments using ffmpeg
  const concatListFile = path.join(tempDir, 'concat_list.txt');
  const concatLines = segmentFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListFile, concatLines);

  const finalAudioPath = path.join(sharedDir, 'audio.mp3');
  execFileSync(ffmpegPath, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListFile,
    '-c', 'copy',
    finalAudioPath,
  ]);

  const totalDuration = getDuration(finalAudioPath);
  console.log(`[Content] Final audio concatenated: ${finalAudioPath} (${totalDuration.toFixed(2)}s)`);

  // Mirror to video-shorts/shared and video-shorts/public
  const vsShared = path.join(rootDir, 'video-shorts', 'shared');
  const vsPublic = path.join(rootDir, 'video-shorts', 'public');
  if (!fs.existsSync(vsShared)) fs.mkdirSync(vsShared, { recursive: true });
  if (!fs.existsSync(vsPublic)) fs.mkdirSync(vsPublic, { recursive: true });
  fs.copyFileSync(finalAudioPath, path.join(vsShared, 'audio.mp3'));
  fs.copyFileSync(finalAudioPath, path.join(vsPublic, 'audio.mp3'));

  const dataJson = {
    topic: trend.topic,
    source_trend: 'shared/trend.json',
    audio: 'shared/audio.mp3',
    duration: Number(totalDuration.toFixed(2)),
    words: allWordTimings,
    youtube: {
      title: 'Как писать продакшн за вечер с Cursor и Claude 🔥 #shorts',
      description: 'Ты всё ещё пишешь код руками? В 2026 году это мем! Разбираем связку Cursor Agent и Claude Code: как 1 разработчик заменяет команду из 3 человек.\n\n0:00 — Хук\n0:05 — Мультифайловый агент\n0:12 — Запуск и автофикс тестов в терминале\n0:19 — Секретные правила в .cursorrules\n0:27 — Финал и призыв к действию\n\n#shorts #ai #programming #vibecoding #cursor #claudecode #webdev',
      tags: trend.keywords,
      madeForKids: false,
      visibility: 'public',
    },
  };

  const dataPath = path.join(sharedDir, 'data.json');
  fs.writeFileSync(dataPath, JSON.stringify(dataJson, null, 2));
  fs.writeFileSync(path.join(vsShared, 'data.json'), JSON.stringify(dataJson, null, 2));

  // Clean temp
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log(`[Content] Word timestamps generated: ${allWordTimings.length} words.`);
  console.log(`[Content] shared/data.json saved successfully.`);
  console.log('STATUS: DONE');
}

main().catch((err) => {
  console.error('[Content] FAILED:', err);
  process.exit(1);
});
