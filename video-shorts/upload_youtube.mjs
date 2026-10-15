import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname.endsWith('video-shorts') ? path.resolve(__dirname, '..') : __dirname;

console.log('=== СУБАГЕНТ 3: YOUTUBE UPLOADER (Playwright CI & Local) ===');

// 1. Поиск видеофайла
const candidateVideoPaths = [
  path.join(rootDir, 'out', 'video.mp4'),
  path.join(rootDir, 'video-shorts', 'out', 'video.mp4'),
  path.join(__dirname, 'out', 'video.mp4'),
  path.resolve(process.cwd(), 'out', 'video.mp4'),
];
const videoPath = candidateVideoPaths.find((p) => fs.existsSync(p));

if (!videoPath) {
  console.error('[Uploader] FAILED: Файл видео не найден ни по одному из путей:', candidateVideoPaths);
  process.exit(1);
}

// 2. Поиск метаданных (shared/data.json и shared/trend.json)
const candidateDataPaths = [
  path.join(rootDir, 'shared', 'data.json'),
  path.join(rootDir, 'video-shorts', 'shared', 'data.json'),
  path.join(__dirname, 'shared', 'data.json'),
  path.resolve(process.cwd(), 'shared', 'data.json'),
];
const dataPath = candidateDataPaths.find((p) => fs.existsSync(p));

const candidateTrendPaths = [
  path.join(rootDir, 'shared', 'trend.json'),
  path.join(rootDir, 'video-shorts', 'shared', 'trend.json'),
  path.join(__dirname, 'shared', 'trend.json'),
  path.resolve(process.cwd(), 'shared', 'trend.json'),
];
const trendPath = candidateTrendPaths.find((p) => fs.existsSync(p));

let metadata = {
  title: 'Как писать продакшн за вечер с Cursor и Claude 🔥 #shorts',
  description: 'AI инструменты 2026 года для разработчиков.\n\n👇 Все материалы и бот: https://t.me/aidev_shorts_bot/app\n\n#shorts #ai #coding #cursor #tech',
  tags: ['shorts', 'ai', 'cursor', 'claude', 'vibecoding', 'programming'],
};

if (dataPath && fs.existsSync(dataPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (data.youtube) {
      if (data.youtube.title) metadata.title = data.youtube.title;
      if (data.youtube.description) metadata.description = data.youtube.description;
      if (Array.isArray(data.youtube.tags)) metadata.tags = data.youtube.tags;
    }
  } catch (e) {
    console.warn('[Uploader] Предупреждение: ошибка чтения data.json:', e.message);
  }
}

if (trendPath && fs.existsSync(trendPath)) {
  try {
    const trend = JSON.parse(fs.readFileSync(trendPath, 'utf8'));
    if (Array.isArray(trend.keywords)) {
      metadata.tags = Array.from(new Set([...metadata.tags, ...trend.keywords]));
    }
  } catch (e) {}
}

// Убедимся, что заголовок содержит #shorts, а описание — ссылку на Mini App
if (!metadata.title.includes('#shorts')) {
  metadata.title = `${metadata.title} #shorts`;
}
if (!metadata.description.includes('https://t.me/aidev_shorts_bot')) {
  metadata.description = `👇 Бот и материалы из видео: https://t.me/aidev_shorts_bot/app\n\n` + metadata.description;
}

const stats = fs.statSync(videoPath);
console.log(`[Uploader] Видео: ${videoPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`[Uploader] Заголовок: "${metadata.title}"`);
console.log(`[Uploader] Теги: ${metadata.tags.slice(0, 10).join(', ')}`);

// 3. Извлечение сессии: YOUTUBE_STORAGE_STATE или storage_state.json или chrome-profile
let storageStateObj = null;

if (process.env.YOUTUBE_STORAGE_STATE) {
  try {
    const raw = process.env.YOUTUBE_STORAGE_STATE.trim();
    if (raw.startsWith('{')) {
      storageStateObj = JSON.parse(raw);
    } else {
      const decoded = Buffer.from(raw, 'base64').toString('utf8');
      storageStateObj = JSON.parse(decoded);
    }
    console.log('[Uploader] Успешно загружен storageState из секрета окружения YOUTUBE_STORAGE_STATE');
  } catch (e) {
    if (fs.existsSync(process.env.YOUTUBE_STORAGE_STATE)) {
      try {
        storageStateObj = JSON.parse(fs.readFileSync(process.env.YOUTUBE_STORAGE_STATE, 'utf8'));
        console.log('[Uploader] Загружен storageState из файла по пути в переменной окружения');
      } catch (err) {}
    } else {
      console.warn('[Uploader] Предупреждение: не удалось распарсить YOUTUBE_STORAGE_STATE:', e.message);
    }
  }
}

if (!storageStateObj) {
  const candidateStorageFiles = [
    path.resolve(process.cwd(), 'storage_state.json'),
    path.join(rootDir, 'video-shorts', 'storage_state.json'),
    path.join(__dirname, 'storage_state.json'),
    path.join(rootDir, 'storage_state.json'),
  ];
  const foundFile = candidateStorageFiles.find((p) => fs.existsSync(p));
  if (foundFile) {
    try {
      storageStateObj = JSON.parse(fs.readFileSync(foundFile, 'utf8'));
      console.log(`[Uploader] Найдена сохраненная сессия в файле: ${foundFile}`);
    } catch (e) {
      console.warn(`[Uploader] Ошибка чтения ${foundFile}:`, e.message);
    }
  }
}

// Поиск локальной папки профиля Chrome (для локального дебага)
const candidateProfiles = [
  path.resolve(process.cwd(), 'chrome-profile'),
  path.resolve(__dirname, 'chrome-profile'),
  path.resolve(rootDir, 'chrome-profile'),
  path.resolve(rootDir, 'video-shorts', 'chrome-profile'),
];
const effectiveProfileDir = candidateProfiles.find((p) => fs.existsSync(p));

if (!storageStateObj && !effectiveProfileDir) {
  console.error('[Uploader] FAILED: Авторизованная сессия не найдена.');
  console.error('[Uploader] Требуется секрет YOUTUBE_STORAGE_STATE или файл storage_state.json или папка chrome-profile.');
  process.exit(1);
}

// 4. Загрузка Playwright
let playwright;
try {
  playwright = await import('playwright');
} catch (e) {
  const candidatePlaywright = [
    path.join(rootDir, 'video-shorts', 'node_modules', 'playwright', 'index.mjs'),
    path.join(__dirname, 'video-shorts', 'node_modules', 'playwright', 'index.mjs'),
    path.join(__dirname, 'node_modules', 'playwright', 'index.mjs'),
  ];
  for (const c of candidatePlaywright) {
    if (fs.existsSync(c)) {
      try {
        playwright = await import(c);
        break;
      } catch (err) {}
    }
  }
}

if (!playwright) {
  console.error('[Uploader] FAILED: Модуль playwright не установлен.');
  console.error('[Uploader] Установите: npm install playwright');
  process.exit(1);
}

async function uploadShorts() {
  const { chromium } = playwright;

  // Опциональный локальный прокси (если поднят на порту 10809 локально)
  let proxyArg = [];
  try {
    const net = await import('net');
    const hasProxy = await new Promise((resolve) => {
      const s = new net.Socket();
      s.setTimeout(800);
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('timeout', () => { s.destroy(); resolve(false); });
      s.on('error', () => { s.destroy(); resolve(false); });
      s.connect(10809, '127.0.0.1');
    });
    if (hasProxy) {
      console.log('[Uploader] Обнаружен локальный прокси 127.0.0.1:10809. Использование прокси...');
      proxyArg = ['--proxy-server=http://127.0.0.1:10809'];
    }
  } catch (e) {}

  let browser = null;
  let browserContext = null;

  const isHeadless = process.env.HEADLESS !== 'false';

  if (storageStateObj) {
    console.log(`[Uploader] Запуск Chromium (${isHeadless ? 'headless' : 'headful'}) с сессией storageState...`);
    browser = await chromium.launch({
      headless: isHeadless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        ...proxyArg,
      ],
    });
    browserContext = await browser.newContext({
      storageState: storageStateObj,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'ru-RU',
    });
  } else {
    console.log(`[Uploader] Запуск Chrome с локальным профилем: ${effectiveProfileDir}`);
    browserContext = await chromium.launchPersistentContext(effectiveProfileDir, {
      channel: 'chrome',
      headless: isHeadless,
      viewport: isHeadless ? { width: 1280, height: 800 } : null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-service-autorun',
        '--password-store=basic',
        ...proxyArg,
      ],
    });
  }

  // Маскировка признаков автоматизации
  await browserContext.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    if (!window.chrome) window.chrome = {};
    window.chrome.runtime = window.chrome.runtime || {};
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en-US', 'en'] });
  });

  let page = null;
  try {
    page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
    console.log('[Uploader] Переход на https://studio.youtube.com/...');

  let navSuccess = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Uploader] Навигация ${attempt}/3...`);
      await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      navSuccess = true;
      break;
    } catch (err) {
      console.warn(`[Uploader] Попытка ${attempt} завершилась с ошибкой:`, err.message);
      if (attempt < 3) await page.waitForTimeout(4000);
      else throw err;
    }
  }

  // Проверка редиректа на страницу авторизации
  if (page.url().includes('accounts.google.com')) {
    console.error('[Uploader] FAILED: Сессия Google не авторизована или срок действия кук истек.');
    console.error('[Uploader] Пожалуйста, обновите сессию в YOUTUBE_STORAGE_STATE.');
    if (browser) await browser.close();
    else await browserContext.close();
    process.exit(1);
  }

  console.log('[Uploader] Поиск кнопки Создать / Загрузить видео...');

  // 1. Клик по кнопке "Создать"
  const createBtn = page.locator('#create-icon, button:has-text("Создать"), button:has-text("Create")').first();
  await createBtn.waitFor({ timeout: 25000 });
  await createBtn.click();
  console.log('[Uploader] Нажата кнопка "Создать".');
  await page.waitForTimeout(1000);

  // 2. Клик по пункту "Добавить видео" в меню
  const uploadOption = page.locator('#text-item-0, tp-yt-paper-item:has-text("Добавить видео"), tp-yt-paper-item:has-text("Upload videos")').first();
  await uploadOption.waitFor({ timeout: 10000 });
  await uploadOption.click();
  console.log('[Uploader] Выбран пункт "Добавить видео".');

  // 3. Прикрепление видеофайла
  console.log('[Uploader] Ожидание диалога загрузки файла...');
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30000 });
  await fileInput.setInputFiles(videoPath);
  console.log('[Uploader] Видеофайл успешно прикреплен. Ожидание формы ввода метаданных...');

  // Проверка и закрытие возможных всплывающих окон/диалогов подтверждения
  await page.waitForTimeout(3000);
  const authDialog = page.locator('ytcp-auth-confirmation-dialog, ytcp-confirmation-dialog, [dialog-type="CONFIRMATION"], [role="dialog"]').first();
  if (await authDialog.isVisible({ timeout: 4000 }).catch(() => false)) {
    const dialogText = await authDialog.innerText().catch(() => '');
    console.log('[Uploader] ВНИМАНИЕ: Обнаружен диалог YouTube:\n' + dialogText.trim());

    const confirmBtn = authDialog.locator('#confirm-button, button:has-text("Продолжить"), button:has-text("Подтвердить"), button:has-text("Понятно"), button:has-text("ОК"), button:has-text("Next"), button:has-text("Continue")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[Uploader] Нажатие кнопки в диалоге...');
      await confirmBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }

  // 4. Заголовок (Title)
  const titleBox = page.locator('#title-textarea #textbox, [aria-label*="Название"], [aria-label*="title"]').first();
  await titleBox.waitFor({ timeout: 45000 });
  await page.waitForTimeout(2000);
  try {
    await titleBox.click({ force: true });
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(metadata.title.slice(0, 95));
  } catch (err) {
    console.warn('[Uploader] Предупреждение при обычном вводе заголовка, используем evaluate:', err.message);
    await titleBox.evaluate((el, text) => {
      el.innerText = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, metadata.title.slice(0, 95));
  }
  console.log(`[Uploader] Заголовок установлен: "${metadata.title.slice(0, 95)}"`);

  // 5. Описание (Description)
  const descBox = page.locator('#description-textarea #textbox, [aria-label*="Описание"], [aria-label*="description"]').first();
  if (await descBox.isVisible({ timeout: 5000 }).catch(() => false)) {
    try {
      await descBox.click({ force: true });
      await page.keyboard.type(metadata.description);
    } catch (err) {
      await descBox.evaluate((el, text) => {
        el.innerText = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, metadata.description);
    }
    console.log('[Uploader] Описание заполнено.');
  }

  // Нейтрализация перехватывающих оверлеев/бэкдропов
  await page.evaluate(() => {
    document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach((el) => {
      el.style.pointerEvents = 'none';
    });
  }).catch(() => {});

  // 6. Переключатель "Не для детей"
  const notForKidsRadio = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], tp-yt-paper-radio-button:has-text("не для детей"), tp-yt-paper-radio-button:has-text("Not made for kids")').first();
  if (await notForKidsRadio.isVisible({ timeout: 5000 }).catch(() => false)) {
    const isChecked = await notForKidsRadio.getAttribute('aria-checked').catch(() => 'false');
    if (isChecked === 'true') {
      console.log('[Uploader] "Не для детей" уже выбрано по умолчанию.');
    } else {
      await notForKidsRadio.scrollIntoViewIfNeeded().catch(() => {});
      try {
        await notForKidsRadio.click({ force: true });
      } catch (err) {
        await notForKidsRadio.evaluate((el) => el.click()).catch(() => {});
      }
      console.log('[Uploader] Установлено: Не для детей.');
    }
  }

  // 7. Теги (развернуть "Развернуть" / "Show more")
  const showMoreBtn = page.locator('button:has-text("Развернуть"), button:has-text("Show more"), ytcp-button:has-text("Развернуть")').first();
  if (await showMoreBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await showMoreBtn.scrollIntoViewIfNeeded().catch(() => {});
    try {
      await showMoreBtn.click({ force: true });
    } catch (e) {
      await showMoreBtn.evaluate((el) => el.click()).catch(() => {});
    }
    await page.waitForTimeout(1000);
    const tagsInput = page.locator('#tags-container input, input[aria-label*="Теги"]').first();
    if (await tagsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tagsInput.scrollIntoViewIfNeeded().catch(() => {});
      await tagsInput.fill(metadata.tags.slice(0, 10).join(', '));
      await tagsInput.press('Enter');
      console.log('[Uploader] Теги добавлены.');
    }
  }

  // 8. Переход по шагам проверки (Далее / Next)
  for (let step = 1; step <= 3; step++) {
    await page.evaluate(() => {
      document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach((el) => {
        el.style.pointerEvents = 'none';
      });
    }).catch(() => {});
    const nextBtn = page.locator('#next-button, button:has-text("Далее"), ytcp-button:has-text("Далее"), button:has-text("Next")').first();
    if (await nextBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      try {
        await nextBtn.click({ force: true });
      } catch (e) {
        await nextBtn.evaluate((el) => el.click()).catch(() => {});
      }
      console.log(`[Uploader] Шаг проверки ${step} пройден.`);
      await page.waitForTimeout(2000);
    }
  }

  // 9. Видимость: Открытый доступ (Public)
  await page.evaluate(() => {
    document.querySelectorAll('tp-yt-iron-overlay-backdrop').forEach((el) => {
      el.style.pointerEvents = 'none';
    });
  }).catch(() => {});
  const publicRadio = page.locator('tp-yt-paper-radio-button[name="PUBLIC"], tp-yt-paper-radio-button:has-text("Открытый доступ"), tp-yt-paper-radio-button:has-text("Public")').first();
  await publicRadio.waitFor({ timeout: 12000 });
  await publicRadio.scrollIntoViewIfNeeded().catch(() => {});
  try {
    await publicRadio.click({ force: true });
  } catch (e) {
    await publicRadio.evaluate((el) => el.click()).catch(() => {});
  }
  console.log('[Uploader] Установлен открытый доступ (Public).');

  // 10. Получение ссылки на ролик из окна загрузки
  let videoUrl = 'https://youtube.com/shorts/pending';
  const linkElem = page.locator('a.ytcp-video-info, a[href*="youtu.be"], a[href*="shorts"]').first();
  if (await linkElem.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await linkElem.getAttribute('href');
    if (href) videoUrl = href;
  }

  // 11. Кнопка Опубликовать / Сохранить
  const doneBtn = page.locator('#done-button, button:has-text("Опубликовать"), ytcp-button:has-text("Опубликовать"), button:has-text("Publish"), button:has-text("Сохранить")').first();
  await doneBtn.waitFor({ timeout: 12000 });
  try {
    await doneBtn.click({ force: true });
  } catch (e) {
    await doneBtn.evaluate((el) => el.click()).catch(() => {});
  }
  console.log('[Uploader] Нажата кнопка публикации.');

  // Ожидание завершения запроса
  await page.waitForTimeout(8000);

  // Проверяем ссылку в финальном окне
  const successLink = page.locator('a[href*="youtu.be"], a[href*="shorts"]').first();
  if (await successLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    const href = await successLink.getAttribute('href');
    if (href && !href.includes('pending')) videoUrl = href;
  }

  // Приведение формата ссылки к https://youtube.com/shorts/<id>
  if (videoUrl.includes('youtu.be/')) {
    const id = videoUrl.split('youtu.be/')[1].split('?')[0];
    videoUrl = `https://youtube.com/shorts/${id}`;
  }

    console.log(`[Uploader] ✅ Финальная ссылка на опубликованный Shorts: ${videoUrl}`);
    console.log('STATUS: DONE');
    return videoUrl;
  } catch (err) {
    console.error('[Uploader] ОШИБКА В ПРОЦЕССЕ ЗАГРУЗКИ:', err.message);
    if (page) {
      try {
        const errorScreenshot = path.join(rootDir, 'out', 'upload_error.png');
        await page.screenshot({ path: errorScreenshot, fullPage: true });
        console.log('[Uploader] Скриншот экрана в момент ошибки сохранен в:', errorScreenshot);
      } catch (e) {}
    }
    throw err;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    } else if (browserContext) {
      await browserContext.close().catch(() => {});
    }
  }
}

uploadShorts().catch((err) => {
  console.error('[Uploader] FAILED:', err.message);
  process.exit(1);
});
