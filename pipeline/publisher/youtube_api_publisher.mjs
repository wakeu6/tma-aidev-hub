import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const videoPath = path.join(rootDir, 'out', 'video.mp4');
const dataPath = path.join(rootDir, 'shared', 'data.json');
const trendPath = path.join(rootDir, 'shared', 'trend.json');

console.log('[Cloud Publisher] Запуск модуля публикации в YouTube...');

// Проверка наличия видео
if (!fs.existsSync(videoPath)) {
  console.error(`[Cloud Publisher] Ошибка: файл ${videoPath} не найден.`);
  process.exit(1);
}

const stats = fs.statSync(videoPath);
console.log(`[Cloud Publisher] Видео найдено: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// Извлечение метаданных
let metadata = {
  title: 'Как писать продакшн за вечер с Cursor и Claude 🔥 #shorts',
  description: 'AI инструменты 2026 года для разработчиков.\n\n👇 Все материалы и бот: https://t.me/aidev_shorts_bot/app\n\n#shorts #ai #coding #cursor #tech',
  tags: ['shorts', 'ai', 'cursor', 'claude', 'programming'],
};

if (fs.existsSync(dataPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (data.youtube) {
      metadata.title = data.youtube.title || metadata.title;
      metadata.description = data.youtube.description || metadata.description;
      if (Array.isArray(data.youtube.tags)) {
        metadata.tags = data.youtube.tags;
      }
    }
  } catch (e) {
    console.warn('[Cloud Publisher] Предупреждение: ошибка чтения data.json:', e.message);
  }
}

// Убедимся, что в описании есть ссылка на TMA и тег #shorts
if (!metadata.title.includes('#shorts')) {
  metadata.title += ' #shorts';
}
if (!metadata.description.includes('https://t.me/aidev_shorts_bot')) {
  metadata.description = `👇 Бот и материалы из видео: https://t.me/aidev_shorts_bot/app\n\n` + metadata.description;
}

const clientId = process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
const privacyStatus = process.env.YOUTUBE_PRIVACY_STATUS || 'public';

if (!clientId || !clientSecret || !refreshToken) {
  console.log('[Cloud Publisher] Уведомление: Секреты YouTube API не настроены в окружении.');
  console.log('[Cloud Publisher] Видео успешно собрано и сохранено в артефактах GitHub Actions.');
  console.log('[Cloud Publisher] Чтобы включить автоматическую загрузку в YouTube, добавьте в GitHub Secrets:');
  console.log('  - YOUTUBE_CLIENT_ID');
  console.log('  - YOUTUBE_CLIENT_SECRET');
  console.log('  - YOUTUBE_REFRESH_TOKEN');
  process.exit(0);
}

/**
 * 1. Получение Access Token через Google OAuth
 */
async function getAccessToken() {
  console.log('[Cloud Publisher] Обновление OAuth токена доступа Google...');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Ошибка получения access token: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

/**
 * 2. Загрузка видео через YouTube Resumable Upload
 */
async function uploadVideo(accessToken) {
  console.log('[Cloud Publisher] Инициализация Resumable Upload...');

  const videoMetadata = {
    snippet: {
      title: metadata.title.slice(0, 100),
      description: metadata.description.slice(0, 5000),
      tags: metadata.tags,
      categoryId: '28', // Science & Technology
    },
    status: {
      privacyStatus: privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': stats.size.toString(),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(videoMetadata),
    }
  );

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`Ошибка инициализации загрузки: ${initRes.status} ${errText}`);
  }

  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Google API не вернул Location заголовок для загрузки.');
  }

  console.log('[Cloud Publisher] Отправка видеопотока в YouTube...');
  const fileStream = fs.createReadStream(videoPath);

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': stats.size.toString(),
      'Content-Type': 'video/mp4',
    },
    body: fileStream,
    duplex: 'half',
  });

  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`Ошибка отправки видеофайла: ${JSON.stringify(uploadJson)}`);
  }

  const videoId = uploadJson.id;
  console.log(`[Cloud Publisher] ✅ Видео успешно опубликовано! Video ID: ${videoId}`);
  console.log(`[Cloud Publisher] 🔗 Ссылка: https://youtube.com/shorts/${videoId}`);

  return videoId;
}

/**
 * 3. Авто-публикация первого закрепленного комментария
 */
async function addPinnedComment(accessToken, videoId) {
  try {
    console.log('[Cloud Publisher] Публикация первого комментария...');
    const commentText = `👇 Забирай AI-стартер-пак, промпты и репозиторий в нашем боте: https://t.me/aidev_shorts_bot/app`;

    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            videoId: videoId,
            topLevelComment: {
              snippet: {
                textOriginal: commentText,
              },
            },
          },
        }),
      }
    );

    if (res.ok) {
      console.log('[Cloud Publisher] ✅ Комментарий успешно опубликован!');
    } else {
      console.warn('[Cloud Publisher] Не удалось опубликовать комментарий (возможно канал не верифицирован):', await res.text());
    }
  } catch (err) {
    console.warn('[Cloud Publisher] Ошибка при создании комментария:', err.message);
  }
}

async function main() {
  try {
    const token = await getAccessToken();
    const videoId = await uploadVideo(token);
    await addPinnedComment(token, videoId);
    console.log('[Cloud Publisher] Полный облачный цикл публикации завершен успешно!');
  } catch (e) {
    console.error('[Cloud Publisher] Сбой публикации:', e.message);
    process.exit(1);
  }
}

main();
