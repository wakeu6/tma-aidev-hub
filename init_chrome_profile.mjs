import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Убеждаемся, что профиль сохраняется в папку ./chrome-profile
const profilePath = path.resolve(process.cwd(), 'chrome-profile');

if (!fs.existsSync(profilePath)) {
  fs.mkdirSync(profilePath, { recursive: true });
}

console.log('====================================================');
console.log('  Инициализация профиля Google Chrome для YouTube Studio');
console.log('====================================================');
console.log('Канал браузера: Системный Google Chrome (channel: "chrome")');
console.log('Маскировка автоматизации: Включена (stealth mode)');
console.log('Путь к профилю:', profilePath);
console.log('\nОткрываем браузер. Пожалуйста, выполните вход в Google / YouTube Studio...');

const context = await chromium.launchPersistentContext(profilePath, {
  channel: 'chrome',
  headless: false,
  viewport: null,
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
  ],
});

// Маскировка navigator.webdriver и свойств автоматизации в браузере
await context.addInitScript(() => {
  // Скрываем флаг webdriver
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });

  // Эмулируем объект window.chrome
  if (!window.chrome) {
    window.chrome = {};
  }
  window.chrome.runtime = window.chrome.runtime || {};

  // Эмулируем плагины
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });

  // Эмулируем языки
  Object.defineProperty(navigator, 'languages', {
    get: () => ['ru-RU', 'ru', 'en-US', 'en'],
  });
});

const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

await page.goto('https://studio.youtube.com/', {
  waitUntil: 'domcontentloaded',
});

console.log('\n[Инструкция]:');
console.log('1. В открывшемся окне Chrome войдите в свой аккаунт Google.');
console.log('2. Убедитесь, что открылась главная панель YouTube Studio.');
console.log('3. После успешного входа просто закройте окно браузера.');
console.log('4. Все куки и сессия сохранятся в ./chrome-profile для автономного аплоада.\n');

// Ожидаем закрытия контекста пользователем
await new Promise((resolve) => {
  context.on('close', resolve);
});

console.log('Профиль успешно сохранен в ./chrome-profile!');
