import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sharedDir = path.join(rootDir, 'shared');

if (!fs.existsSync(sharedDir)) {
  fs.mkdirSync(sharedDir, { recursive: true });
}

const trendPath = path.join(sharedDir, 'trend.json');
const trend = JSON.parse(fs.readFileSync(trendPath, 'utf8'));

console.log('--- SUBAUTOMATION: CONTENT GENERATOR ---');
console.log('Topic:', trend.topic);
console.log('Angle:', trend.angle);
console.log('Hook:', trend.hook);

// 35-second structured script split into natural spoken segments:
// 0-5s: Hook
// 5-25s: 3 AI features / Vibe coding tricks
// 25-35s: Punchline + CTA
const segments = [
  {
    part: 'hook',
    text: `${trend.hook}`,
    rate: '+8%',
  },
  {
    part: 'feature1',
    text: 'Связка Cursor Agent и Claude Code полностью меняет правила игры.',
    rate: '+8%',
  },
  {
    part: 'feature2',
    text: 'Первое: мультифайловый агент сам раскладывает фичи по всей архитектуре проекта.',
    rate: '+10%',
  },
  {
    part: 'feature3',
    text: 'Второе: агент в терминале на лету прогоняет и фиксит падающие тесты.',
    rate: '+10%',
  },
  {
    part: 'feature4',
    text: 'И главное: умные правила в cursorrules превращают размытые промпты в чистый продакшн-код с первого раза.',
    rate: '+8%',
  },
  {
    part: 'cta',
    text: 'Один разработчик заменяет целую команду. Сохраняй ролик и пиши в комментариях: ты уже на vibe coding?',
    rate: '+8%',
  },
];

async function generateTTS() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata('ru-RU-DmitryNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
    wordBoundaryEnabled: true,
  });

  const tempDir = path.join(rootDir, 'temp_tts_segments');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  const audioBuffers = [];
  const allWords = [];
  let currentOffsetSec = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    console.log(`[Content] Synthesizing segment ${i + 1}/${segments.length}: "${seg.text.slice(0, 40)}..."`);
    const segTempDir = path.join(tempDir, `seg_${i}`);
    fs.mkdirSync(segTempDir, { recursive: true });

    const result = await tts.toFile(segTempDir, seg.text, {
      rate: seg.rate,
      pitch: '+0Hz',
    });

    const audioBuf = fs.readFileSync(result.audioFilePath);
    audioBuffers.push(audioBuf);

    // Read metadata if available
    let segmentDuration = 0;
    if (result.metadataFilePath && fs.existsSync(result.metadataFilePath)) {
      const meta = JSON.parse(fs.readFileSync(result.metadataFilePath, 'utf8'));
      if (meta.Metadata && meta.Metadata.length > 0) {
        for (const item of meta.Metadata) {
          if (item.Type === 'WordBoundary' && item.Data && item.Data.text) {
            const startSec = currentOffsetSec + (item.Data.Offset / 10000000);
            const endSec = currentOffsetSec + ((item.Data.Offset + item.Data.Duration) / 10000000);
            allWords.push({
              word: item.Data.text.Text,
              start: Number(startSec.toFixed(2)),
              end: Number(endSec.toFixed(2)),
            });
            const itemEnd = (item.Data.Offset + item.Data.Duration) / 10000000;
            if (itemEnd > segmentDuration) {
              segmentDuration = itemEnd;
            }
          }
        }
      }
    }

    // If metadata did not compute duration or segment had pause, estimate duration from audio buffer size:
    // MP3 24kHz 96kbps = 96000 bits/s = 12000 bytes/s
    const estDuration = audioBuf.length / 12000;
    const effectiveDuration = Math.max(segmentDuration, estDuration);
    currentOffsetSec += effectiveDuration + 0.15; // 150ms natural pause between sentences
  }

  tts.close();

  // Combine audio buffers
  const finalAudioBuffer = Buffer.concat(audioBuffers);
  const audioOutPath = path.join(sharedDir, 'audio.mp3');
  fs.writeFileSync(audioOutPath, finalAudioBuffer);

  // Mirror to video-shorts/shared/audio.mp3 and video-shorts/public/audio.mp3
  const vsShared = path.join(rootDir, 'video-shorts', 'shared');
  if (!fs.existsSync(vsShared)) fs.mkdirSync(vsShared, { recursive: true });
  fs.writeFileSync(path.join(vsShared, 'audio.mp3'), finalAudioBuffer);

  const vsPublic = path.join(rootDir, 'video-shorts', 'public');
  if (!fs.existsSync(vsPublic)) fs.mkdirSync(vsPublic, { recursive: true });
  fs.writeFileSync(path.join(vsPublic, 'audio.mp3'), finalAudioBuffer);

  const totalDuration = Number(currentOffsetSec.toFixed(2));
  console.log(`[Content] Generated audio saved to ${audioOutPath}`);
  console.log(`[Content] Total duration: ${totalDuration}s, total words: ${allWords.length}`);

  // Build shared/data.json
  const dataJson = {
    topic: trend.topic,
    source_trend: 'shared/trend.json',
    audio: 'shared/audio.mp3',
    duration: totalDuration,
    words: allWords,
    youtube: {
      title: 'Как писать продакшн за вечер с Cursor и Claude #shorts',
      description: 'Ты всё ещё пишешь код руками? Разбираем связку Cursor Agent + Claude Code: как 1 разработчик заменяет команду из 3 человек.\n\n0:00 — Хук\n0:05 — Мультифайловый агент\n0:15 — Автофикс тестов в терминале\n0:25 — Секрет .cursorrules\n0:30 — Итог и CTA\n\n#shorts #ai #programming #cursor #vibecoding #webdev',
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

  console.log(`[Content] Metadata saved to ${dataPath}`);
  console.log('STATUS: DONE');
}

generateTTS().catch((err) => {
  console.error('[Content] FAILED:', err);
  process.exit(1);
});
