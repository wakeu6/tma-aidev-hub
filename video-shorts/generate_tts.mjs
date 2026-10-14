import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const ttsTasks = [
  {
    fileName: 'voice_1.mp3',
    text: 'Ты всё ещё пишешь код руками? В две тысячи двадцать шестом это уже мем.',
    rate: '+10%',
  },
  {
    fileName: 'voice_2.mp3',
    text: 'Связка Cursor Agent и Claude Code меняет правила игры. Мультифайловый агент сам раскладывает фичи по всей архитектуре.',
    rate: '+12%',
  },
  {
    fileName: 'voice_3.mp3',
    text: 'А агент в терминале на лету запускает и фиксит падающие тесты. Плюс умные cursorrules для идеального продакшн-кода.',
    rate: '+12%',
  },
  {
    fileName: 'voice_4.mp3',
    text: 'Один разработчик заменяет целую команду! Сохраняй ролик и пиши: ты уже перешел на vibe coding?',
    rate: '+10%',
  },
];

async function run() {
  console.log('Initializing Edge TTS with ru-RU-DmitryNeural...');
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    'ru-RU-DmitryNeural',
    OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
  );

  for (const task of ttsTasks) {
    console.log(`Generating ${task.fileName} for: "${task.text}"...`);
    const filePath = path.join(publicDir, task.fileName);
    const { audioStream } = tts.toStream(task.text, {
      rate: task.rate,
      pitch: '+0Hz',
    });

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      audioStream.pipe(writeStream);
      audioStream.on('error', reject);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const stat = fs.statSync(filePath);
    console.log(`Saved ${task.fileName} (${stat.size} bytes)`);
  }

  tts.close();
  console.log('All voice tracks generated successfully!');
}

run().catch((err) => {
  console.error('Error generating TTS:', err);
  process.exit(1);
});
