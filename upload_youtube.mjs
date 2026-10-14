import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Поиск видео
const candidateVideoPaths = [
  path.join(rootDir, 'out', 'video.mp4'),
  path.join(__dirname, 'out', 'video.mp4'),
  path.resolve(process.cwd(), 'out', 'video.mp4'),
];
const videoPath = candidateVideoPaths.find((p) => fs.existsSync(p));

// Поиск метаданных
const candidateDataPaths = [
  path.join(rootDir, 'shared', 'data.json'),
  path.join(__dirname, 'shared', 'data.json'),
  path.resolve(process.cwd(), 'shared', 'data.json'),
];
const dataPath = candidateDataPaths.find((p) => fs.existsSync(p));

const candidateTrendPaths = [
  path.join(rootDir, 'shared', 'trend.json'),
  path.join(__dirname, 'shared', 'trend.json'),
  path.resolve(process.cwd(), 'shared', 'trend.json'),
];
const trendPath = candidateTrendPaths.find((p) => fs.existsSync(p));

console.log('=== СУБАГЕНТ 3: UPLOADER ===');

if (!videoPath) {
  console.error(`[Uploader] FAILED: Файл видео не найден ни по одному из путей:`, candidateVideoPaths);
  process.exit(1);
}

if (!dataPath) {
  console.error(`[Uploader] FAILED: Файл данных shared/data.json не найден ни по одному из путей:`, candidateDataPaths);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const trend = trendPath ? JSON.parse(fs.readFileSync(trendPath, 'utf8')) : null;

const ytMeta = data.youtube || {};
const title = ytMeta.title || 'Как писать продакшн за вечер с Cursor и Claude 🔥 #shorts';
const description = ytMeta.description || '';
const tags = Array.from(new Set([...(ytMeta.tags || []), ...(trend?.keywords || [])]));

console.log(`[Uploader] Название видео: "${title}"`);
console.log(`[Uploader] Файл: ${videoPath} (${(fs.statSync(videoPath).size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`[Uploader] Теги: ${tags.join(', ')}`);

// Поиск сохраненного профиля ./chrome-profile
const candidateProfiles = [
  path.resolve(process.cwd(), 'chrome-profile'),
  path.resolve(__dirname, 'chrome-profile'),
  path.resolve(rootDir, 'chrome-profile'),
];
const effectiveProfileDir = candidateProfiles.find((p) => fs.existsSync(p));

if (!effectiveProfileDir) {
  console.error(`[Uploader] FAILED: Папка профиля Chrome не найдена в ./chrome-profile`);
  console.error('[Uploader] Причина: Отсутствует авторизованная сессия Chrome.');
  console.error('[Uploader] Запустите: node init_chrome_profile.mjs для входа в YouTube Studio.');
  process.exit(1);
}

console.log(`[Uploader] Используется профиль Chrome: ${effectiveProfileDir}`);

// Загрузка Playwright
let playwright;
try {
  playwright = await import('playwright');
} catch (e) {
  console.error('[Uploader] FAILED: Модуль playwright не установлен.');
  console.error('[Uploader] Установите: npm install playwright');
  process.exit(1);
}

async function uploadShorts() {
  const { chromium } = playwright;
  console.log('[Uploader] Запуск системного Google Chrome с маскировкой автоматизации...');

  // Проверка и запуск локального прокси при необходимости
  let proxyArg = [];
  try {
    const net = await import('net');
    const hasProxy = await new Promise((resolve) => {
      const s = new net.Socket();
      s.setTimeout(1000);
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('timeout', () => { s.destroy(); resolve(false); });
      s.on('error', () => { s.destroy(); resolve(false); });
      s.connect(10809, '127.0.0.1');
    });
    if (hasProxy) {
      console.log('[Uploader] Обнаружен локальный прокси 127.0.0.1:10809. Подключение через прокси...');
      proxyArg = ['--proxy-server=http://127.0.0.1:10809'];
    }
  } catch (e) {}

  const browserContext = await chromium.launchPersistentContext(effectiveProfileDir, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-features=IsolateOrigins,site-per-process',
      '--start-maximized',
      '--no-first-run',
      '--no-service-autorun',
      '--password-store=basic',
      ...proxyArg,
    ],
  });

  // Маскировка navigator.webdriver
  await browserContext.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    if (!window.chrome) {
      window.chrome = {};
    }
    window.chrome.runtime = window.chrome.runtime || {};
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ru-RU', 'ru', 'en-US', 'en'],
    });
  });

  const page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
  console.log('[Uploader] Переход на https://studio.youtube.com/...');

  let navSuccess = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Uploader] Попытка перехода ${attempt}/3...`);
      await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      navSuccess = true;
      break;
    } catch (err) {
      console.warn(`[Uploader] Попытка ${attempt} завершилась с ошибкой:`, err.message);
      if (attempt < 3) {
        await page.waitForTimeout(4000);
      } else {
        throw err;
      }
    }
  }

  // Проверка редиректа на страницу авторизации
  if (page.url().includes('accounts.google.com')) {
    console.error('[Uploader] FAILED: Сессия не авторизована в профиле.');
    console.error('[Uploader] Google требует авторизации. Запустите сначала node init_chrome_profile.mjs');
    await browserContext.close();
    process.exit(1);
  }

  console.log('[Uploader] Поиск кнопки Создать / Загрузить видео...');

  // 1. Клик по кнопке "Создать"
  const createBtn = page.locator('#create-icon, button:has-text("Создать"), button:has-text("Create")').first();
  await createBtn.waitFor({ timeout: 20000 });
  await createBtn.click();
  console.log('[Uploader] Нажата кнопка "Создать".');
  await page.waitForTimeout(1000);

  // 2. Клик по пункту "Добавить видео" в выпадающем меню
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

  // 4. Поле заголовка (Title)
  const titleBox = page.locator('#title-textarea #textbox, [aria-label*="Название"], [aria-label*="title"]').first();
  await titleBox.waitFor({ timeout: 45000 });
  await page.waitForTimeout(2000);
  await titleBox.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(title.slice(0, 70));
  console.log(`[Uploader] Заголовок установлен: "${title.slice(0, 70)}"`);

  // 5. Поле описания (Description)
  const descBox = page.locator('#description-textarea #textbox, [aria-label*="Описание"], [aria-label*="description"]').first();
  if (await descBox.isVisible({ timeout: 5000 }).catch(() => false)) {
    await descBox.click();
    await page.keyboard.type(description);
    console.log('[Uploader] Описание заполнено.');
  }

  // 6. Переключатель "Не для детей"
  const notForKidsRadio = page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], tp-yt-paper-radio-button:has-text("не для детей"), tp-yt-paper-radio-button:has-text("Not made for kids")').first();
  if (await notForKidsRadio.isVisible({ timeout: 5000 }).catch(() => false)) {
    await notForKidsRadio.scrollIntoViewIfNeeded();
    await notForKidsRadio.click();
    console.log('[Uploader] Установлено: Не для детей.');
  }

  // 7. Добавление тегов (развернуть дополнительные параметры)
  const showMoreBtn = page.locator('button:has-text("Развернуть"), button:has-text("Show more"), ytcp-button:has-text("Развернуть")').first();
  if (await showMoreBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await showMoreBtn.scrollIntoViewIfNeeded();
    await showMoreBtn.click();
    await page.waitForTimeout(1000);
    const tagsInput = page.locator('#tags-container input, input[aria-label*="Теги"]').first();
    if (await tagsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tagsInput.scrollIntoViewIfNeeded();
      await tagsInput.fill(tags.slice(0, 10).join(', '));
      await tagsInput.press('Enter');
      console.log('[Uploader] Теги добавлены.');
    }
  }

  // 8. Переход по шагам проверки (Далее / Next)
  for (let step = 1; step <= 3; step++) {
    const nextBtn = page.locator('#next-button, button:has-text("Далее"), ytcp-button:has-text("Далее"), button:has-text("Next")').first();
    if (await nextBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nextBtn.click();
      console.log(`[Uploader] Шаг проверки ${step} пройден.`);
      await page.waitForTimeout(2000);
    }
  }

  // 9. Установка видимости: Открытый доступ (Public)
  const publicRadio = page.locator('tp-yt-paper-radio-button[name="PUBLIC"], tp-yt-paper-radio-button:has-text("Открытый доступ"), tp-yt-paper-radio-button:has-text("Public")').first();
  await publicRadio.waitFor({ timeout: 12000 });
  await publicRadio.scrollIntoViewIfNeeded();
  await publicRadio.click();
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
  await doneBtn.click();
  console.log('[Uploader] Нажата кнопка публикации.');

  // Ожидание завершения запроса
  await page.waitForTimeout(8000);

  // Проверяем ссылку в финальном всплывающем окне
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

  await browserContext.close();

  console.log(`[Uploader] Финальная ссылка на опубликованный Shorts: ${videoUrl}`);
  console.log('STATUS: DONE');
}

uploadShorts().catch((err) => {
  console.error('[Uploader] FAILED:', err.message);
  process.exit(1);
});
