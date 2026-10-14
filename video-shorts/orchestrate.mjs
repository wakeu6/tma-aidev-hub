import fs from 'fs';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getRandomBgmTrack, mixBgmIntoVideo, ensureMusicLibrary, getMediaDuration } from './bgm_engine.mjs';
import { STYLE_PRESETS, getStylePreset, enrichImagePrompt } from './styles_engine.mjs';
import { generateScenesVisuals, KEN_BURNS_MOTIONS } from './image_engine.mjs';
import { validateShortsSync, getExactDuration } from './qa_validator.mjs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Pipeline 2026 модули
import { TRENDS_POOL_2026, validateTrend2026 } from '../pipeline/trends/trend_pool.mjs';
import { synthesizeHumanSegment, calculateWordTimings } from '../pipeline/tts/tts_adapter.mjs';
import { generateVeoSceneClip } from '../pipeline/veo/veo_engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname.endsWith('video-shorts') ? path.resolve(__dirname, '..') : __dirname;
const vsDir = path.join(rootDir, 'video-shorts');

// Автозагрузка переменных окружения из .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

// Пути к ключевым папкам проекта
const sharedDir = path.resolve(rootDir, 'shared');
const outDir = path.resolve(rootDir, 'out');
const logsDir = path.resolve(rootDir, 'logs');
const logFile = path.join(logsDir, 'automation.log');

if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// Зеркальные папки внутри video-shorts для Remotion и Webpack
const vsShared = path.resolve(vsDir, 'shared');
const vsOut = path.resolve(vsDir, 'out');
const vsPublic = path.resolve(vsDir, 'public');
if (!fs.existsSync(vsShared)) fs.mkdirSync(vsShared, { recursive: true });
if (!fs.existsSync(vsOut)) fs.mkdirSync(vsOut, { recursive: true });
if (!fs.existsSync(vsPublic)) fs.mkdirSync(vsPublic, { recursive: true });

/**
 * Логирование с меткой времени [ГГГГ-ММ-ДД ЧЧ:ММ:СС]
 */
export function log(message, level = 'INFO') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
  const formatted = `${timestamp} [${level}] ${message}`;
  console.log(formatted);
  try {
    fs.appendFileSync(logFile, formatted + '\n');
  } catch (e) {
    console.error('Ошибка записи лога:', e.message);
  }
}

// Банк вирусных трендов по AI-программированию и vibe coding
// Каждый ролик разбит на 5 смысловых сцен с промптами под анимацию (размытый фон / четкий фокус)
export const VIRAL_TRENDS_POOL = [
  {
    topic: 'Cursor + Claude Code: как писать продакшн за вечер',
    angle: 'Скорость: один разработчик заменяет команду из трёх',
    hook: 'Ты всё ещё пишешь код руками? В 2026 это уже мем.',
    style_preset: 'dark_gritty',
    segments: [
      {
        id: 1,
        text: 'Ты всё ещё пишешь код руками? В двадцать шестом году это уже мем.',
        displayWords: ['Ты', 'всё', 'ещё', 'пишешь', 'код', 'руками?', 'В', '2026', 'году', 'это', 'уже', 'мем.'],
        rate: '+5%',
        imagePrompt: 'Frustrated programmer sitting in dark room surrounded by glowing monitors with error logs, glowing holographic code errors in foreground, moody cyber atmosphere',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Связка Cursor и Claude меняет правила игры. Мультифайловый агент сам раскладывает архитектуру и пишет логику.',
        displayWords: ['Связка', 'Cursor', 'и', 'Claude', 'меняет', 'правила', 'игры.', 'Мультифайловый', 'агент', 'сам', 'раскладывает', 'архитектуру', 'и', 'пишет', 'логику.'],
        rate: '+8%',
        imagePrompt: 'Glowing 3D neural node interconnecting dozens of floating code architecture blocks, cyan neon data streams, close up focus with deep dark background bokeh',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Второе: агент в терминале на лету запускает билд, отлавливает баги и сам фиксит упавшие тесты.',
        displayWords: ['Второе:', 'агент', 'в', 'терминале', 'на', 'лету', 'запускает', 'билд,', 'отлавливает', 'баги', 'и', 'сам', 'фиксит', 'упавшие', 'тесты.'],
        rate: '+8%',
        imagePrompt: 'Futuristic terminal command prompt executing automated code tests, glowing green checkmarks, sharp keyboard in foreground, blurred cyberpunk server room',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'И главное: умные правила в cursorrules заставляют модель выдавать чистый продакшн код без лишней воды.',
        displayWords: ['И', 'главное:', 'умные', 'правила', 'в', '.cursorrules', 'заставляют', 'модель', 'выдавать', 'чистый', 'продакшн-код', 'без', 'лишней', 'воды.'],
        rate: '+8%',
        imagePrompt: 'Glowing crystal file card labeled .cursorrules radiating pure energy, laser etched code guidelines, immaculate depth of field',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Один разработчик заменяет целую команду. Сохраняй ролик и пиши в комментариях: ты уже на vibe coding?',
        displayWords: ['Один', 'разработчик', 'заменяет', 'целую', 'команду.', 'Сохраняй', 'ролик', 'и', 'пиши', 'в', 'комментариях:', 'ты', 'уже', 'на', 'vibe', 'coding?'],
        rate: '+6%',
        imagePrompt: 'Single confident software engineer on a high rise balcony at night with laptop, futuristic mega city lights in blurred background, master of tech aesthetic',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['cursor', 'claude code', 'ai coding', 'vibe coding', 'shorts', 'webdev', 'programming'],
    title: 'Как писать продакшн за вечер с Cursor и Claude 🔥 #shorts',
    description: 'Ты всё ещё пишешь код руками? В 2026 это мем! Разбираем связку Cursor Agent + Claude Code.\n\n#shorts #ai #programming #vibecoding #cursor #claudecode',
  },
  {
    topic: '3 скрытых правила в .cursorrules для чистого кода',
    angle: 'Хакинг промптов: код без галлюцинаций с первого раза',
    hook: 'Твой AI-ассистент всё время ошибается? Исправь это за 30 секунд.',
    style_preset: 'minimalist_tech',
    segments: [
      {
        id: 1,
        text: 'Твой искусственный интеллект всё время ошибается в коде? Исправь это за тридцать секунд.',
        displayWords: ['Твой', 'AI-ассистент', 'всё', 'время', 'ошибается?', 'Исправь', 'это', 'за', '30', 'секунд.'],
        rate: '+6%',
        imagePrompt: 'Minimalist tech workspace with glitching AI hologram, frustrated developer hands adjusting clean keyboard, sleek dark studio lighting',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Создай в корне файл cursorrules. Первое правило: строго запрети модели трогать работающие файлы без разрешения.',
        displayWords: ['Создай', 'файл', '.cursorrules.', 'Первое:', 'запрети', 'трогать', 'рабочий', 'код', 'без', 'спроса.'],
        rate: '+8%',
        imagePrompt: 'Minimalist holographic shield locking code files into a secure vault, glowing emerald security perimeter, pristine modern tech design',
        kenBurns: 'pan_up',
      },
      {
        id: 3,
        text: 'Второе: задай точный стек с версиями библиотек, чтобы не получать устаревший синтаксис.',
        displayWords: ['Второе:', 'задай', 'точный', 'стек', 'и', 'версии,', 'чтобы', 'не', 'получать', 'устаревший', 'код.'],
        rate: '+8%',
        imagePrompt: 'Floating modern software stack icons with precise version badges, React, NextJS, TypeScript, ultra clean white and emerald lighting',
        kenBurns: 'pan_down',
      },
      {
        id: 4,
        text: 'И третье: требуй писать тесты на каждый новый метод прямо во время генерации.',
        displayWords: ['И', 'третье:', 'требуй', 'автотесты', 'на', 'каждый', 'метод', 'прямо', 'в', 'моменте.'],
        rate: '+8%',
        imagePrompt: 'Precision automated test suite visualized as glowing architectural beams forming an indestructible code structure, depth of field',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 5,
        text: 'Качество кода вырастет сразу в три раза! Сохраняй шпаргалку и подписывайся на канал.',
        displayWords: ['Качество', 'кода', 'вырастет', 'в', '3', 'раза!', 'Сохраняй', 'шпаргалку', 'и', 'подписывайся.'],
        rate: '+6%',
        imagePrompt: 'Pristine glowing 3X multiplier icon over elegant developer workstation, warm accent light, clean modern aesthetic',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['cursorrules', 'cursor', 'claude', 'ai tips', 'clean code', 'programming', 'shorts'],
    title: '3 секретных правила в .cursorrules для идеального кода 🚀 #shorts',
    description: 'Как заставить Cursor и Claude писать чистый код без галлюцинаций? 3 правила для файла .cursorrules.\n\n#shorts #ai #programming #cursor #vibecoding',
  },
  {
    topic: 'Vibe Coding: как один промпт заменяет 3 часа работы',
    angle: 'Магия агентного программирования: от идеи до деплоя',
    hook: 'Программирование изменилось навсегда, пока ты спал.',
    style_preset: 'y2k_retro',
    segments: [
      {
        id: 1,
        text: 'Программирование изменилось навсегда, пока ты спал. Теперь в тренде vibe coding.',
        displayWords: ['Программирование', 'изменилось', 'навсегда.', 'Теперь', 'в', 'тренде', 'vibe', 'coding.'],
        rate: '+6%',
        imagePrompt: 'Cyber retro sleeping person next to glowing 90s CRT monitor typing code autonomously, neon pink and violet atmosphere',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Тебе больше не нужно вручную верстать формы или писать рутинные роуты на бэкенде.',
        displayWords: ['Больше', 'не', 'нужно', 'вручную', 'верстать', 'формы', 'или', 'писать', 'рутинные', 'роуты.'],
        rate: '+8%',
        imagePrompt: 'Vintage computer screen dissolving tedious lines of manual code into colorful digital sparks, retro neon glitch',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Ты просто описываешь фичу на естественном языке, а агент сам собирает компоненты, стили и базу данных.',
        displayWords: ['Ты', 'описываешь', 'фичу,', 'а', 'агент', 'сам', 'собирает', 'UI,', 'стили', 'и', 'базу.'],
        rate: '+8%',
        imagePrompt: 'Human voice speech bubble transforming magically into complete fullstack app UI with database connections, vaporwave aesthetics',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Главный навык современного разработчика — это системное мышление и четкие инструкции для агентов.',
        displayWords: ['Главный', 'навык', 'сейчас', '—', 'системное', 'мышление', 'и', 'контроль', 'архитектуры.'],
        rate: '+8%',
        imagePrompt: 'Holographic human brain connected to digital puppet strings conducting multiple AI code agents like an orchestra, retro futurism',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Кто быстрее освоит этот инструмент — тот заберет лучшие проекты. Переходи на новый уровень!',
        displayWords: ['Кто', 'быстрее', 'освоит', 'инструменты', '—', 'заберет', 'рынок.', 'Подписывайся!'],
        rate: '+6%',
        imagePrompt: 'Retro arcade screen showing LEVEL UP with rocket taking off towards cyberspace, neon purple and turquoise glow',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['vibecoding', 'ai agent', 'chatgpt', 'cursor', 'software engineer', 'shorts'],
    title: 'Vibe Coding: будущее разработки уже наступило ⚡ #shorts',
    description: 'Что такое Vibe Coding и почему один разработчик с AI теперь заменяет целый отдел?\n\n#shorts #vibecoding #ai #programming #tech',
  },
  {
    topic: 'Claude 3.7 Sonnet: гибридное мышление в терминале',
    angle: 'Интеллект нового поколения: глубокое рассуждение без галлюцинаций',
    hook: 'Нейросети больше не тупят над сложной архитектурой.',
    style_preset: 'street_grunge',
    segments: [
      {
        id: 1,
        text: 'Нейросети больше не тупят над сложной архитектурой. Релиз Claude три семь Sonnet перевернул разработку.',
        displayWords: ['Нейросети', 'больше', 'не', 'тупят!', 'Релиз', 'Claude', '3.7', 'Sonnet', 'взорвал', 'индустрию.'],
        rate: '+6%',
        imagePrompt: 'Street grunge underground tech poster announcing Claude 3.7 Sonnet, distressed paper texture, spray paint neon yellow lightning',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Теперь модель умеет включать гибридное рассуждение прямо перед генерацией кода.',
        displayWords: ['Модель', 'включает', 'глубокое', 'мышление', 'прямо', 'перед', 'генерацией', 'кода.'],
        rate: '+8%',
        imagePrompt: 'Gears and neural synapses glowing brightly inside an edgy mechanical cyborg skull thinking deeply, high contrast grunge lighting',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Она сначала в уме проектирует схему базы, учитывает крайние случаи, и только потом пишет логику без багов.',
        displayWords: ['Сначала', 'проектирует', 'архитектуру', 'и', 'edge-кейсы,', 'затем', 'пишет', 'чистый', 'код.'],
        rate: '+8%',
        imagePrompt: 'Complex architectural blueprint spray painted with neon precision onto dark concrete wall, sharp focused foreground',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'В сложных бенчмарках Sonnet обогнал всех конкурентов с рекордным отрывом.',
        displayWords: ['В', 'тестах', 'SWE-bench', 'Sonnet', 'обогнал', 'всех', 'конкурентов', 'с', 'отрывом.'],
        rate: '+8%',
        imagePrompt: 'Leaderboard graph spray painted in electric yellow showing crushing defeat of all rivals, concrete alley bokeh background',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Подключай через терминал и ускоряй разработку в разы. Подписывайся на свежие AI-фичи!',
        displayWords: ['Подключай', 'в', 'свой', 'IDE', 'и', 'делай', 'проекты', 'быстрее.', 'Подписывайся!'],
        rate: '+6%',
        imagePrompt: 'Raw industrial hacker setup with terminal flashing lightning fast build output, high contrast yellow tape and stickers',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['claude 3.7', 'anthropic', 'sonnet', 'hybrid reasoning', 'ai coding', 'programming', 'shorts'],
    title: 'Claude 3.7 Sonnet: гибридный интеллект для кода ⚡ #shorts',
    description: 'Новый Claude 3.7 Sonnet с гибридным мышлением рвёт бенчмарки в кодинге.\n\n#shorts #claude #anthropic #ai #programming',
  },
  {
    topic: 'Топ-3 инструмента AI-разработки в 2026 году',
    angle: 'Ультимативный стек: экономия 15 часов каждую неделю',
    hook: 'Забудь про старый стек разработки без AI-агентов.',
    style_preset: 'minimalist_tech',
    segments: [
      {
        id: 1,
        text: 'Забудь про старый стек разработки без AI-агентов. Вот топ три инструмента, которые экономят часы работы.',
        displayWords: ['Забудь', 'про', 'старый', 'стек!', 'Вот', 'топ-3', 'инструмента', 'для', 'кодинга.'],
        rate: '+6%',
        imagePrompt: 'Ultra clean minimalist tech studio workspace with glowing holographic developer tools icons floating in air, Apple style aesthetic',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Первый: Cursor. Лучший мультифайловый редактор с фоновым контекстом всего репозитория.',
        displayWords: ['1.', 'Cursor:', 'лучший', 'редактор', 'с', 'индексацией', 'всего', 'репозитория.'],
        rate: '+8%',
        imagePrompt: 'Sleek dark interface showing multi-file indexing visualization with glowing emerald neural connections, sharp foreground focus',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Второй: Claude Code. Автономный агент в консоли, который сам коммитит и пушит в гит.',
        displayWords: ['2.', 'Claude', 'Code:', 'агент', 'в', 'терминале,', 'который', 'сам', 'пушит', 'в', 'git.'],
        rate: '+8%',
        imagePrompt: 'Minimalist command line interface displaying automated git commit and branch push with green success badges, soft bokeh background',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'И третий: v0. Мгновенная генерация адаптивного React и Tailwind интерфейса по описанию.',
        displayWords: ['3.', 'v0:', 'мгновенная', 'генерация', 'готового', 'React', 'и', 'Tailwind', 'UI.'],
        rate: '+8%',
        imagePrompt: 'Pristine modern React component assembling itself dynamically with Tailwind CSS classes, glassmorphic UI card in foreground',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Используешь хотя бы один из них? Пиши в комментариях свой актуальный стек!',
        displayWords: ['Что', 'из', 'этого', 'юзаешь?', 'Пиши', 'в', 'комментариях', 'свой', 'сетап!'],
        rate: '+6%',
        imagePrompt: 'Futuristic developer desk with sleek glowing monitor setup, emerald ambient glow, perfect minimalist composition',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['developer tools', 'cursor', 'claude code', 'v0', 'react', 'webdev', 'shorts'],
    title: 'Топ-3 инструмента AI-разработки в 2026 году 🛠️ #shorts',
    description: '3 лучших инструмента для современного программиста с искусственным интеллектом.\n\n#shorts #webdev #cursor #claudecode #v0 #ai',
  },
  {
    topic: 'DeepSeek R1 локально: бесплатный AI-напарник без подписок',
    angle: 'Безопасность и экономия: топовая модель прямо на твоем железе',
    hook: 'Платишь двадцать долларов за ChatGPT? Зря.',
    style_preset: 'dark_gritty',
    segments: [
      {
        id: 1,
        text: 'Платишь двадцать долларов каждый месяц за ChatGPT? Зря.',
        displayWords: ['Платишь', '$20', 'каждый', 'месяц', 'за', 'ChatGPT?', 'Зря.'],
        rate: '+6%',
        imagePrompt: 'Dramatic close up of credit card subscription payment on dark screen burning into digital ash, moody cyan lighting',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Открытая модель DeepSeek R1 работает прямо на твоем компьютере без подписок и цензуры.',
        displayWords: ['Открытая', 'модель', 'DeepSeek', 'R1', 'работает', 'прямо', 'на', 'твоем', 'ПК.'],
        rate: '+8%',
        imagePrompt: 'Cyberpunk PC tower with glowing open-source whale emblem, liquid cooling tubes, deep dark room with volumetric smoke',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Через Ollama она разворачивается одной командой в терминале всего за пару минут.',
        displayWords: ['Через', 'Ollama', 'она', 'ставится', 'одной', 'командой', 'за', 'пару', 'минут.'],
        rate: '+8%',
        imagePrompt: 'High tech terminal executing ollama run deepseek-r1, rapid downloading progress bar glowing cyan, sharp keyboard reflection',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Модель отлично решает алгоритмы, оптимизирует SQL-запросы и ревьюит код без отправки в облако.',
        displayWords: ['Модель', 'решает', 'алгоритмы,', 'SQL', 'и', 'ревьюит', 'код', 'локально.'],
        rate: '+8%',
        imagePrompt: 'Complex 3D SQL query tree and algorithmic graph optimizing itself into pure glowing crystal structure, dark cyberpunk depth of field',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Твои данные остаются строго на твоем диске. Ставь лайк и сохраняй инструкцию!',
        displayWords: ['Твои', 'данные', 'в', 'безопасности.', 'Ставь', 'лайк', 'и', 'сохраняй!'],
        rate: '+6%',
        imagePrompt: 'Secure glowing digital vault lock over encrypted SSD drive, impenetrable cyber defense aesthetic, low key dramatic lighting',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['deepseek', 'deepseek r1', 'ollama', 'local ai', 'privacy', 'coding', 'shorts'],
    title: 'DeepSeek R1 локально: бесплатный AI без подписок 🚀 #shorts',
    description: 'Как запустить DeepSeek R1 локально для написания и ревью кода бесплатно.\n\n#shorts #deepseek #ollama #ai #programming #localai',
  },
  {
    topic: 'MCP протокол: суперсила AI-ассистентов в 2026 году',
    angle: 'Интеграция: как дать модели доступ к базам данных и API за пару строк',
    hook: 'Твой AI-помощник изолирован от реального мира? Подключи MCP.',
    style_preset: 'y2k_retro',
    segments: [
      {
        id: 1,
        text: 'Твой искусственный интеллект всё ещё оторван от реальных баз данных? Пора включить MCP.',
        displayWords: ['Твой', 'AI', 'оторван', 'от', 'данных?', 'Пора', 'подключить', 'MCP!'],
        rate: '+6%',
        imagePrompt: 'Vibrant Y2K aesthetic terminal showing glowing neon protocol plugs connecting neural network to database cylinders, vaporwave grid bokeh',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Model Context Protocol — это открытый стандарт от Anthropic, превращающий ассистента в суперагента.',
        displayWords: ['MCP', '—', 'открытый', 'стандарт', 'от', 'Anthropic', 'для', 'агентов.'],
        rate: '+8%',
        imagePrompt: 'Futuristic retro-futuristic holographic bridge connecting AI core to external cloud services, neon magenta and cyan aesthetic',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Одна строка в конфигурации — и модель напрямую читает PostgreSQL, ищет в GitHub и дергает API.',
        displayWords: ['Модель', 'напрямую', 'читает', 'базы,', 'GitHub', 'и', 'вызывает', 'любые', 'API.'],
        rate: '+8%',
        imagePrompt: 'Stylized 3D database console with live SQL streams in synthwave neon purple, sharp foreground code card, glitch chromatic aberration',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Больше никаких копирований логов руками. Агент сам находит причину бага в проде.',
        displayWords: ['Никакой', 'рутины.', 'Агент', 'сам', 'диагностирует', 'баги', 'на', 'сервере.'],
        rate: '+8%',
        imagePrompt: 'Cyber terminal displaying automated bug resolution with glowing green status lines, CRT monitor curvature, retro neon reflections',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Будущее уже наступило. Сохраняй гайд и пиши в комментариях: юзаешь MCP в работе?',
        displayWords: ['Будущее', 'здесь.', 'Сохраняй', 'и', 'пиши:', 'юзаешь', 'MCP?'],
        rate: '+6%',
        imagePrompt: 'Retro futuristic developer command center with neon glowing screens, aesthetic cyberpunk Y2K sunset through window',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['mcp', 'model context protocol', 'anthropic', 'claude', 'ai coding', 'vibe coding', 'shorts'],
    title: 'MCP: как подключить AI напрямую к базам данных ⚡ #shorts',
    description: 'Что такое Model Context Protocol (MCP) и как он превращает AI в полноценного автономного инженера.\n\n#shorts #mcp #anthropic #claude #ai #programming',
  },
  {
    topic: 'Windsurf против Cursor: битва AI-редакторов кодинга',
    angle: 'Инновации: агент Cascade меняет подход к мультифайловому рефакторингу',
    hook: 'Cursor всё ещё номер один? У него появился дерзкий конкурент.',
    style_preset: 'street_grunge',
    segments: [
      {
        id: 1,
        text: 'Cursor всё ещё абсолютный король среди AI-редакторов? У него появился дерзкий конкурент.',
        displayWords: ['Cursor', 'всё', 'ещё', 'топ-1?', 'Появился', 'мощный', 'соперник!'],
        rate: '+6%',
        imagePrompt: 'Two glowing cyberpunk ide logos facing off in an urban underground street fight, electric sparks, gritty concrete texture bokeh',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Это Windsurf с агентом Cascade. Он непрерывно следит за каждым твоим действием в редакторе.',
        displayWords: ['Windsurf', 'с', 'агентом', 'Cascade', 'видит', 'каждый', 'твой', 'клик.'],
        rate: '+8%',
        imagePrompt: 'High speed code stream racing across industrial terminal with neon stencil spray paint, high contrast grunge lighting',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Cascade понимает, какой файл ты только что открыл, и сразу подсказывает следующий логический шаг.',
        displayWords: ['Cascade', 'наперед', 'знает', 'следующий', 'шаг', 'в', 'твоей', 'архитектуре.'],
        rate: '+8%',
        imagePrompt: 'Urban hacker laptop displaying dynamic multi-file diff with vibrant spray painted UI elements, sharp focus on mechanical keyboard',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'В сложных рефакторингах он ошибается меньше и почти не ломает контекст проекта.',
        displayWords: ['Меньше', 'галлюцинаций,', 'чище', 'рефакторинг', 'сложных', 'проектов.'],
        rate: '+8%',
        imagePrompt: 'Bold yellow cautionary tape over raw brick wall with glowing graffiti code metrics, ultra high contrast grunge',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Что выберешь ты: проверенный Cursor или дерзкий Windsurf? Голосуй в комментариях!',
        displayWords: ['Cursor', 'или', 'Windsurf?', 'Пиши', 'свой', 'выбор', 'в', 'комментариях!'],
        rate: '+6%',
        imagePrompt: 'Two neon signs glowing intensely on a dark rain-soaked asphalt street at night, cinematic street grunge vibe',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['windsurf', 'cursor', 'codeium', 'cascade', 'ai coding', 'vibe coding', 'programming', 'shorts'],
    title: 'Windsurf или Cursor: кто побеждает в 2026 году? ⚔️ #shorts',
    description: 'Сравнение топовых AI-редакторов для программистов: агент Cascade против Cursor Agent.\n\n#shorts #windsurf #cursor #ai #programming #codeium',
  },
  {
    topic: 'v0 против Bolt.new: генерация веб-приложений за 60 секунд',
    angle: 'Сравнение: чистый UI от Vercel против мгновенного фуллстек-деплоя',
    hook: 'Верстаешь интерфейсы руками с нуля? В 2026 году это делают за минуту.',
    style_preset: 'minimalist_tech',
    segments: [
      {
        id: 1,
        text: 'Верстаешь интерфейсы с нуля руками? В двадцать шестом году прототипы создаются за одну минуту.',
        displayWords: ['Верстаешь', 'руками?', 'В', '2026', 'прототип', 'делают', 'за', 'минуту!'],
        rate: '+6%',
        imagePrompt: 'Sleek ultra modern UI wireframe magically generating itself with luminous emerald geometry, clean studio background',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'v0 от Vercel выдаёт эталонный React код на Tailwind и shadcn, который легко копировать в свой проект.',
        displayWords: ['v0:', 'идеальный', 'React,', 'Tailwind', 'и', 'shadcn', 'чистый', 'код.'],
        rate: '+8%',
        imagePrompt: 'Crystal clear Apple style glassmorphic UI card displaying immaculate code typography and live preview, subtle studio bokeh',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'А Bolt.new поднимает в браузере полноценный Node.js сервер, базу данных и рабочий бэкенд.',
        displayWords: ['Bolt.new:', 'запускает', 'Node.js', 'и', 'базу', 'прямо', 'в', 'браузере.'],
        rate: '+8%',
        imagePrompt: 'High tech minimalist architecture diagram showing live browser Node.js runtime and connected database node, mint green lighting',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Для дизайна идеален v0, а для быстрого MVP клиенту за вечер — лучше Bolt.',
        displayWords: ['v0', '—', 'для', 'дизайна,', 'Bolt', '—', 'для', 'готового', 'MVP.'],
        rate: '+8%',
        imagePrompt: 'Two pristine geometric holographic device screens comparing design fidelity and backend functionality, sleek minimalist aesthetic',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Чем пользуешься чаще? Пиши в комментариях и подписывайся на свежие AI-инструменты!',
        displayWords: ['Что', 'выберешь', 'ты?', 'Пиши', 'в', 'комментариях', 'и', 'подписывайся!'],
        rate: '+6%',
        imagePrompt: 'Ultra clean designer workspace with sleek wireless keyboard and floating glowing interactive UI elements, minimalist emerald ambient',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['v0', 'bolt new', 'vercel', 'react', 'nextjs', 'tailwind', 'ai coding', 'vibe coding', 'shorts'],
    title: 'v0 или Bolt.new: что лучше для веб-разработки? ⚡ #shorts',
    description: 'Сравниваем v0 от Vercel и Bolt.new: идеальный UI против мгновенного фуллстек приложения.\n\n#shorts #v0 #boltnew #react #vercel #ai #programming',
  },
  {
    topic: 'AI-ревью кода в GitHub: бот, который ловит уязвимости',
    angle: 'Безопасность: как автономный агент проверяет PR на утечки и баги',
    hook: 'Тратишь часы на ревью чужого кода? Подключи AI-агента.',
    style_preset: 'dark_gritty',
    segments: [
      {
        id: 1,
        text: 'Тратишь часы на ревью чужого кода перед мержем? Подключи автономного AI-агента прямо в репозиторий.',
        displayWords: ['Тратишь', 'часы', 'на', 'ревью?', 'Подключи', 'AI-агента', 'в', 'GitHub!'],
        rate: '+6%',
        imagePrompt: 'Dark moody hacker command center with glowing GitHub PR interface surrounded by red security warning holograms, cinematic low key',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Связка GitHub Actions и Claude мгновенно сканирует каждый пулл-реквест на утечки API-ключей.',
        displayWords: ['GitHub', 'Actions', 'и', 'Claude', 'сканируют', 'код', 'на', 'утечки', 'ключей.'],
        rate: '+8%',
        imagePrompt: 'Close up 3D encrypted key card dissolving into secure digital code particles, cyan and amber highlights, dramatic cyber bokeh',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Модель находит скрытые SQL-инъекции, проверяет типизацию и предлагает готовые фиксы в комментариях.',
        displayWords: ['Находит', 'SQL-инъекции,', 'типы', 'и', 'пишет', 'готовые', 'фиксы.'],
        rate: '+8%',
        imagePrompt: 'High tech code inspection terminal with glowing green fix recommendations hovering over flagged vulnerable code lines',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Это экономит до десяти часов работы сеньора каждую неделю и защищает прод от падений.',
        displayWords: ['Экономит', '10', 'часов', 'в', 'неделю', 'и', 'защищает', 'продакшн.'],
        rate: '+8%',
        imagePrompt: 'Futuristic digital fortress shield encasing server racks in glowing impenetrable barrier, atmospheric smoke and deep shadows',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Внедряй в свою команду уже сегодня. Сохраняй ролик и ставь лайк за чистый прод!',
        displayWords: ['Внедряй', 'в', 'проект!', 'Ставь', 'лайк', 'за', 'чистый', 'прод!'],
        rate: '+6%',
        imagePrompt: 'Confident software engineer at ultra dark desk smiling as automated tests turn completely green, moody rim lighting',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['github actions', 'code review', 'cybersecurity', 'claude', 'ai coding', 'vibe coding', 'shorts'],
    title: 'AI-ревью кода в GitHub за 1 минуту 🛡️ #shorts',
    description: 'Как настроить автономное AI-ревью пулл-реквестов с помощью LLM: защита от багов и уязвимостей.\n\n#shorts #github #security #codereview #ai #programming',
  },
  {
    topic: 'Claude 3.7 против GPT-4.5: битва нейросетей за код',
    angle: 'Сравнение: гибридное рассуждение Sonnet против масштаба OpenAI',
    hook: 'GPT-4.5 или Claude 3.7? Разработчики уже сделали свой выбор.',
    style_preset: 'y2k_retro',
    segments: [
      {
        id: 1,
        text: 'GPT-4.5 или Claude 3.7 Sonnet? Разработчики уже протестировали обе модели в коде.',
        displayWords: ['GPT-4.5', 'или', 'Claude', '3.7?', 'Кто', 'лучше', 'пишет', 'код?'],
        rate: '+6%',
        imagePrompt: 'Two retro holographic AI titans facing each other across a glowing synthwave neon cyber grid, vibrant pink and cyan lighting',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Claude 3.7 выигрывает за счет гибкого гибридного мышления: он сначала продумывает логику без спешки.',
        displayWords: ['Claude', '3.7:', 'гибридное', 'мышление', 'продумывает', 'архитектуру', 'наперед.'],
        rate: '+8%',
        imagePrompt: 'Glowing cybernetic brain nodes firing in geometric sequence with neon purple tracers and CRT scanline reflections',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'А модель от OpenAI хороша в широком кругозоре и сложных документациях редких фреймворков.',
        displayWords: ['GPT-4.5:', 'колоссальная', 'база', 'знаний', 'по', 'редким', 'библиотекам.'],
        rate: '+8%',
        imagePrompt: 'Futuristic floating data cube indexing millions of legacy and modern programming libraries, vibrant vaporwave magenta glow',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Но для повседневного кодинга и рефакторинга Sonnet остаётся безоговорочным лидером индустрии.',
        displayWords: ['Для', 'чистого', 'кода', 'и', 'рефакторинга', 'Sonnet', 'всё', 'ещё', 'топ-1.'],
        rate: '+8%',
        imagePrompt: 'Retro terminal glowing with victory crown icon over spotless green syntax highlighting, glitch artifacts in bokeh background',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'На какой модели сидишь ты? Пиши в комментариях свой выбор!',
        displayWords: ['На', 'какой', 'модели', 'ты?', 'Пиши', 'свой', 'выбор', 'в', 'комменты!'],
        rate: '+6%',
        imagePrompt: 'High tech 90s cyber deck with mechanical keys bathed in retro synthwave sunset neon light, ultra stylish composition',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['claude 3.7', 'gpt 4.5', 'openai', 'anthropic', 'sonnet', 'ai coding', 'vibe coding', 'shorts'],
    title: 'Claude 3.7 или GPT-4.5: кто пишет код лучше? 🤖 #shorts',
    description: 'Сравнение свежих флагманов Claude 3.7 Sonnet и GPT-4.5 в написании кода и поиске багов.\n\n#shorts #claude #gpt4 #anthropic #openai #ai #programming',
  },
  {
    topic: 'Claude Code в терминале: автономный агент без мышки',
    angle: 'Консольный хакинг: агент сам запускает тесты, чинит баги и пушит коммиты',
    hook: 'Хватит кликать мышкой в браузере. Настоящие сеньоры работают так.',
    style_preset: 'street_grunge',
    segments: [
      {
        id: 1,
        text: 'Хватит кликать мышкой в веб-интерфейсах. Anthropic выпустила Claude Code прямо для терминала.',
        displayWords: ['Хватит', 'кликать', 'мышкой!', 'Встречай', 'Claude', 'Code', 'в', 'терминале.'],
        rate: '+6%',
        imagePrompt: 'Dark edgy mechanical terminal workstation with gritty yellow caution stickers, raw concrete wall, dynamic street grunge aesthetic',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Он работает прямо в консоли: читает проект, запускает сборку и видит реальные ошибки компилятора.',
        displayWords: ['Агент', 'сам', 'читает', 'проект,', 'видит', 'ошибки', 'и', 'запускает', 'билд.'],
        rate: '+8%',
        imagePrompt: 'High speed bash terminal output blazing with neon lime code logs, spray painted stencil overlay, blurred underground bokeh',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Нашёл баг? Агент сам редактирует файлы, прогоняет юнит-тесты и делает чистый git commit.',
        displayWords: ['Сам', 'правит', 'код,', 'прогоняет', 'тесты', 'и', 'коммитит', 'в', 'ветку.'],
        rate: '+8%',
        imagePrompt: 'Close up on beat-up mechanical keyboard with glowing green git commit success notification reflected on keys',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Это не просто автодополнение — это полноценный автономный джуниор-разработчик в твоей командной строке.',
        displayWords: ['Это', 'не', 'автокомплит,', 'а', 'полноценный', 'инженер', 'в', 'консоли.'],
        rate: '+8%',
        imagePrompt: 'Urban street graffiti showing stylized cyber skull with terminal command prompt etched into brick, bold yellow accent lines',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Уже пробовал Claude Code? Пиши свои впечатления в комментариях и подписывайся!',
        displayWords: ['Уже', 'тестил?', 'Пиши', 'впечатления', 'в', 'комментариях!'],
        rate: '+6%',
        imagePrompt: 'Hacker hoodie silhouette working on glowing laptop in dark rain drenched alley, intense street grunge contrast',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['claude code', 'terminal', 'cli', 'anthropic', 'ai coding', 'vibe coding', 'programming', 'shorts'],
    title: 'Claude Code в терминале: разработка без мышки ⚡ #shorts',
    description: 'Как запустить автономного агента Claude Code прямо в терминале: авто-тесты, коммиты и рефакторинг.\n\n#shorts #claude #anthropic #cli #terminal #ai #programming',
  },
  {
    topic: 'Supabase + Lovable: фуллстек за 1 промпт',
    angle: 'Скорость запуска: база PostgreSQL, авторизация и React UI в один клик',
    hook: 'Потратил месяц на бэкенд и авторизацию? В 2026 это делается за минуту.',
    style_preset: 'minimalist_tech',
    segments: [
      {
        id: 1,
        text: 'Потратил месяц на ручную настройку бэкенда и авторизации? В двадцать шестом году это делается за одну минуту.',
        displayWords: ['Тратишь', 'месяц', 'на', 'бэкенд?', 'В', '2026', 'всё', 'собирается', 'за', 'минуту!'],
        rate: '+6%',
        imagePrompt: 'Sleek minimalist architecture diagram of cloud PostgreSQL connecting with glowing emerald data streams, pure white studio light',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Связка Lovable и Supabase генерирует рабочее веб-приложение прямо по текстовому описанию.',
        displayWords: ['Lovable', 'и', 'Supabase', 'создают', 'готовый', 'сервис', 'по', 'одному', 'промпту.'],
        rate: '+8%',
        imagePrompt: 'Clean modern glassmorphic dashboard interface generating live interactive tables and charts with emerald green accents',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'ИИ сам проектирует таблицы в базе данных, настраивает политики безопасности RLS и поднимает Auth.',
        displayWords: ['AI', 'сам', 'проектирует', 'схему', 'SQL,', 'RLS-политики', 'и', 'авторизацию.'],
        rate: '+8%',
        imagePrompt: 'Floating 3D geometric database schema linking user auth to encrypted data rows, pristine Apple aesthetic',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Ты получаешь готовый к приему пользователей стартап за вечер вместо месяцев изнурительной разработки.',
        displayWords: ['Готовый', 'стартап', 'за', 'один', 'вечер', 'вместо', 'месяцев', 'рутины.'],
        rate: '+8%',
        imagePrompt: 'Minimalist laptop displaying live production analytics with rising user graph, immaculate desk bokeh background',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Ты уже пробовал создавать сервисы на vibe coding? Пиши в комментариях!',
        displayWords: ['Уже', 'тестил', 'vibe', 'coding?', 'Пиши', 'в', 'комментариях!'],
        rate: '+6%',
        imagePrompt: 'Futuristic ultra clean workspace overlooking sunrise skyline, sleek emerald ambient light, vision of modern developer',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['supabase', 'lovable', 'postgres', 'rls', 'fullstack', 'ai coding', 'vibe coding', 'shorts'],
    title: 'Supabase + Lovable: фуллстек за 1 промпт 🚀 #shorts',
    description: 'Как создать полноценное веб-приложение с базой данных PostgreSQL, авторизацией и API без ручного кода.\n\n#shorts #supabase #lovable #postgres #ai #webdev',
  },
  {
    topic: 'Топ локальных LLM для кода в 2026 году',
    angle: 'Автономия: лучшие открытые модели для программирования без интернета и подписок',
    hook: 'Боишься блокировок облачных AI? Запусти мощную локальную модель.',
    style_preset: 'dark_gritty',
    segments: [
      {
        id: 1,
        text: 'Боишься, что облачные AI внезапно заблокируют доступ к твоим проектам? Пора ставить локальную модель.',
        displayWords: ['Боишься', 'блокировок', 'AI?', 'Запусти', 'свою', 'модель', 'локально!'],
        rate: '+6%',
        imagePrompt: 'Dark moody hacker workstation with glowing server tower glowing ice blue, volumetric smoke, deep cyberpunk shadows',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Первый лидер: Qwen 2.5 Coder. В тестах на знание Python, TypeScript и Go он обходит многие закрытые модели.',
        displayWords: ['1.', 'Qwen', '2.5', 'Coder:', 'эталонный', 'код', 'на', 'любых', 'языках.'],
        rate: '+8%',
        imagePrompt: 'High tech terminal showing Qwen neural weights loading with cyan laser data streams, sharp keyboard focus in foreground',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Второй гигант: DeepSeek R1. Модель с глубоким рассуждением, которая находит тончайшие алгоритмические баги.',
        displayWords: ['2.', 'DeepSeek', 'R1:', 'глубокое', 'рассуждение', 'и', 'сложные', 'алгоритмы.'],
        rate: '+8%',
        imagePrompt: 'Complex 3D mathematical algorithm graph rendered in glowing crystal matrices, cybernetic dark bokeh background',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Обе модели запускаются через Ollama за пять минут и работают прямо на твоей видеокарте.',
        displayWords: ['Ставятся', 'через', 'Ollama', 'за', '5', 'минут', 'на', 'твою', 'видеокарту.'],
        rate: '+8%',
        imagePrompt: 'High performance graphics card with glowing RGB fans and cooling pipes running local AI inferences, dramatic low key',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Код остаётся только твоим. Сохраняй ролик и пиши в комментариях: юзаешь локальные модели?',
        displayWords: ['Полная', 'приватность!', 'Сохраняй', 'и', 'пиши:', 'юзаешь', 'локалки?'],
        rate: '+6%',
        imagePrompt: 'Lone software engineer in dark hoodie looking at encrypted security terminal turning solid green, atmospheric cinematic lighting',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['qwen coder', 'deepseek', 'local llm', 'ollama', 'open source', 'ai coding', 'vibe coding', 'shorts'],
    title: 'Топ локальных LLM для кода в 2026 году 💻 #shorts',
    description: 'Лучшие открытые модели для программирования: Qwen 2.5 Coder и DeepSeek R1 прямо на твоем компьютере.\n\n#shorts #ollama #qwen #deepseek #localai #coding #ai',
  },
  {
    topic: 'Prompt Injection в коде: как хакают AI-ассистентов',
    angle: 'Кибербезопасность: скрытые инструкции в сторонних библиотеках, ворующие ключи',
    hook: 'Твой AI-ассистент может слить базу данных хакерам. Вот как.',
    style_preset: 'y2k_retro',
    segments: [
      {
        id: 1,
        text: 'Твой умный AI-ассистент может слить токены хакерам. Эта уязвимость называется Prompt Injection.',
        displayWords: ['Твой', 'AI-помощник', 'может', 'слить', 'ключи!', 'Это', 'Prompt', 'Injection.'],
        rate: '+6%',
        imagePrompt: 'Glitching retro terminal displaying Trojan code injection with vibrant neon pink hazard warnings, synthwave CRT scanlines',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Хакер публикует npm-пакет со скрытым текстом в комментариях или ридми-файле.',
        displayWords: ['Хакер', 'прячет', 'инструкцию', 'в', 'комментарии', 'чужой', 'библиотеки.'],
        rate: '+8%',
        imagePrompt: 'Close up of code snippet highlighting hidden malicious prompt in invisible Unicode text, glowing magenta and cyan bokeh',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Когда модель индексирует этот файл, она выполняет чужую команду и отправляет секреты на сервер злоумышленника.',
        displayWords: ['Модель', 'выполняет', 'чужой', 'приказ', 'и', 'отправляет', 'пароли', 'в', 'сеть.'],
        rate: '+8%',
        imagePrompt: 'Stylized 3D digital skull intercepting data packets streaming from code IDE to remote dark web server, Y2K neon aesthetic',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Защита простая: всегда запрещай AI выполнять неизвестные терминальные команды и доступ к файлам env.',
        displayWords: ['Защити', 'проект:', 'заблокируй', 'доступ', 'AI', 'к', 'файлу', '.env!'],
        rate: '+8%',
        imagePrompt: 'Futuristic retro digital shield sealing glowing env file with laser lock, vibrant synthwave sunset grid background',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Предупреди коллег по разработке. Ставь лайк и сохраняй ролик для безопасности проектов!',
        displayWords: ['Предупреди', 'коллег!', 'Ставь', 'лайк', 'и', 'защищай', 'свой', 'код!'],
        rate: '+6%',
        imagePrompt: 'Retro futuristic hacker workstation with multiple neon monitors displaying secure encrypted firewall, high style composition',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['prompt injection', 'cybersecurity', 'ai safety', 'cursor', 'claude', 'ai coding', 'vibe coding', 'shorts'],
    title: 'Prompt Injection в коде: как хакают AI ⚠️ #shorts',
    description: 'Как вредоносные инструкции в комментариях могут заставить AI-ассистента слить пароли и ключи.\n\n#shorts #cybersecurity #promptinjection #ai #security #programming',
  },
  {
    topic: 'Скрытый режим мышления в Claude 3.7: гибридный интеллект',
    angle: 'Инженерия промптов: как Extended Thinking решает баги, на которых ломаются другие LLM',
    hook: 'Твой AI выдаёт поверхностный код с ошибками? Включи этот режим.',
    style_preset: 'street_grunge',
    segments: [
      {
        id: 1,
        text: 'Твой искусственный интеллект торопится и выдаёт код с багами? Включи скрытый режим Thinking.',
        displayWords: ['AI', 'торопится', 'и', 'ошибается?', 'Включи', 'скрытый', 'режим', 'мышления!'],
        rate: '+6%',
        imagePrompt: 'Grungy urban graffiti showing glowing cyber skull wired into high voltage conduits, bold yellow caution stencil markings',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'В Claude 3.7 Sonnet ты можешь задать бюджет на размышления до шестидесяти четырёх тысяч токенов.',
        displayWords: ['Claude', '3.7', 'тратит', 'до', '64K', 'токенов', 'на', 'чистое', 'мышление.'],
        rate: '+8%',
        imagePrompt: 'High tech terminal displaying massive stream of hidden reasoning steps rendered in luminous green code font',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Модель сначала в скрытом логе проектирует архитектуру, проверяет все edge-кейсы и только потом пишет решение.',
        displayWords: ['Сначала', 'в', 'уме', 'проектирует', 'edge-кейсы,', 'затем', 'пишет', 'идеальный', 'код.'],
        rate: '+8%',
        imagePrompt: 'Close up on battle scarred mechanical keyboard under harsh dramatic cyberpunk lighting with glowing status indicators',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Результат: сложные микросервисы и многопоточные алгоритмы запускаются с первого раза без единого падения.',
        displayWords: ['Сложная', 'логика', 'и', 'многопоточка', 'работают', 'с', 'первого', 'раза.'],
        rate: '+8%',
        imagePrompt: 'Dark brick wall spray painted with giant neon checkmark over complex architectural diagram, street grunge aesthetic',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Включай Thinking Mode в API и Cursor. Ставь лайк и сохраняй настройку!',
        displayWords: ['Включай', 'в', 'Cursor', 'и', 'API!', 'Ставь', 'лайк', 'и', 'сохраняй!'],
        rate: '+6%',
        imagePrompt: 'Rebel software developer standing in neon washed alley at night holding glowing laptop, ultra high contrast grunge',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['claude 3.7', 'thinking mode', 'extended thinking', 'anthropic', 'sonnet', 'ai coding', 'vibe coding', 'shorts'],
    title: 'Скрытый режим мышления в Claude 3.7 🧠 #shorts',
    description: 'Как использовать Extended Thinking в Claude 3.7 Sonnet для решения сложнейших задач в программировании.\n\n#shorts #claude #anthropic #sonnet #ai #programming',
  },
  {
    topic: 'Docker + AI: контейнеризация за 30 секунд',
    angle: 'DevOps автоматизация: многоэтапные Dockerfile и CI/CD без ошибок в слоях',
    hook: 'Твой Docker-образ весит три гигабайта и падает? Исправь это через AI.',
    style_preset: 'minimalist_tech',
    segments: [
      {
        id: 1,
        text: 'Твой Docker-образ весит три гигабайта и постоянно падает при сборке? Пора доверить Dockerfile AI-агенту.',
        displayWords: ['Образ', 'весит', '3', 'гигабайта?', 'Собери', 'идеальный', 'Docker', 'через', 'AI!'],
        rate: '+6%',
        imagePrompt: 'Sleek minimalist 3D container cube floating in pure white tech studio with luminous emerald outlines, Apple style minimalism',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Ассистент сканирует твой репозиторий, определяет зависимости и собирает многоэтапный multi-stage билд.',
        displayWords: ['AI', 'сканирует', 'стек', 'и', 'собирает', 'чистый', 'multi-stage', 'билд.'],
        rate: '+8%',
        imagePrompt: 'Pristine glowing pipeline diagram showing layered Docker container stages compiling with zero footprint, emerald bokeh',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Лишние кэши и dev-зависимости отсекаются, а размер финального образа сокращается в десять раз.',
        displayWords: ['Размер', 'образа', 'уменьшается', 'в', '10', 'раз', 'без', 'лишних', 'слоев.'],
        rate: '+8%',
        imagePrompt: 'High tech minimalist terminal window displaying docker build success with tiny 45MB image badge, sharp typography',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Заодно модель на лету генерирует docker-compose и GitHub Actions для моментального деплоя в облако.',
        displayWords: ['Генерирует', 'docker-compose', 'и', 'GitHub', 'Actions', 'в', 'один', 'клик.'],
        rate: '+8%',
        imagePrompt: 'Clean glassmorphic cloud deployment card with automated checkmarks connecting to Docker registry, studio lighting',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Автоматизируй свой DevOps уже сегодня. Ставь лайк и сохраняй инструкцию!',
        displayWords: ['Автоматизируй', 'DevOps!', 'Ставь', 'лайк', 'и', 'сохраняй!'],
        rate: '+6%',
        imagePrompt: 'Futuristic ultra clean developer workspace overlooking high tech server cluster, pure emerald ambient, serene composition',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['docker', 'devops', 'cicd', 'container', 'ai coding', 'vibe coding', 'shorts'],
    title: 'Docker + AI: контейнеризация за 30 секунд 🐳 #shorts',
    description: 'Как сгенерировать идеальный multi-stage Dockerfile и CI/CD пайплайн с помощью AI без ошибок.\n\n#shorts #docker #devops #cicd #ai #programming #webdev',
  },
  {
    topic: 'Claude Sonnet 5.5 против GPT Astra 6: кто лучший программист планеты?',
    angle: 'Битва титанов: сравнение в написании сложных архитектур и SWE-bench 2026',
    hook: 'Пока все спорили о старых моделях, вышли Astra 6 и Sonnet 5.5 — мы сравнили их на безумном код-тесте!',
    style_preset: 'dark_gritty',
    segments: [
      {
        id: 1,
        text: 'Пока все спорили о старых моделях, вышли Astra 6 и Sonnet 5.5! Мы сравнили их на безумном код-тесте.',
        displayWords: ['Пока', 'все', 'спорили,', 'вышли', 'Astra', '6', 'и', 'Sonnet', '5.5!', 'Сравнили', 'их', 'в', 'бою!'],
        rate: '+6%',
        imagePrompt: 'Google Veo cinematic clash between glowing AI titans Astra 6 and Sonnet 5.5, neural network energy sparks, dark cyber arena, 8k vertical 9:16 video frame',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Sonnet 5.5 от Anthropic получил обновленный движок глубокого рассуждения. Он в один клик спроектировал распределенную архитектуру без единой ошибки.',
        displayWords: ['Sonnet', '5.5', 'спроектировал', 'сложнейшую', 'архитектуру', 'без', 'единой', 'ошибки.'],
        rate: '+8%',
        imagePrompt: 'Google Veo futuristic holographic software blueprint generated by Sonnet 5.5, glowing multi-layer architecture, dark moody lighting, 9:16 frame',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'А GPT Astra 6 от OpenAI показал рекордную скорость компиляции и интеграции с терминалом, набрав девяносто пять процентов на SWE-бенчмарке.',
        displayWords: ['GPT', 'Astra', '6', 'показал', 'рекордные', '95%', 'на', 'тестах', 'SWE-bench.'],
        rate: '+8%',
        imagePrompt: 'Google Veo high speed terminal stream with GPT Astra 6 executing automated tests at lightspeed, neon emerald benchmark charts, 9:16 frame',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Обе модели разносят старый софт в пух и прах. В связке они превращают одного разработчика в полноценную софтверную компанию.',
        displayWords: ['Обе', 'модели', 'разносят', 'старый', 'код!', '1', 'разработчик', '=', 'целая', 'IT-компания.'],
        rate: '+8%',
        imagePrompt: 'Google Veo futuristic autonomous software factory powered by neural engines, glowing server racks, sleek developer cockpit, 9:16 frame',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Какую модель выберешь ты: Astra 6 или Sonnet 5.5? Голосуй в комментариях и подписывайся на канал!',
        displayWords: ['Astra', '6', 'или', 'Sonnet', '5.5?', 'Голосуй', 'в', 'комментах', 'и', 'подписывайся!'],
        rate: '+6%',
        imagePrompt: 'Google Veo developer looking at dual floating holographic badges of Astra 6 and Sonnet 5.5, epic high contrast studio lighting, 9:16 frame',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['claude sonnet 5.5', 'gpt astra 6', 'astra 6', 'sonnet 5.5', 'ai coding', 'swe bench', 'vibe coding', 'shorts', 'programming', 'google veo'],
    title: 'Claude Sonnet 5.5 против GPT Astra 6: кто лучший программист? 🔥 #shorts',
    description: 'Пока все спорили о старых моделях, вышли GPT Astra 6 и Claude Sonnet 5.5. Мы устроили реальный батл в кодинге и архитектуре!\n\n#shorts #ai #sonnet5 #astra6 #claude #chatgpt #programming #vibecoding #googleveo',
  },
  {
    topic: 'Gemini Flash 3.8: квантовый скачок скорости и бесконечный контекст',
    angle: 'Нулевой пинг и миллионные контексты в разработке реального времени',
    hook: 'Забудь про задержки в генерации: Gemini Flash 3.8 выдает код быстрее, чем ты моргаешь!',
    style_preset: 'minimalist_tech',
    segments: [
      {
        id: 1,
        text: 'Забудь про задержки в генерации кода. Новый Gemini Flash 3.8 выдает готовые функции быстрее, чем ты успеваешь моргнуть!',
        displayWords: ['Забудь', 'про', 'задержки!', 'Gemini', 'Flash', '3.8', 'пишет', 'код', 'быстрее', 'мысли!'],
        rate: '+6%',
        imagePrompt: 'Google Veo minimalist ultra clean glowing quantum light beam representing zero latency code generation, sleek emerald typography, 9:16 frame',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Главный апдейт: честный контекст в пять миллионов токенов. Ты можешь скормить модели всю кодовую базу огромного энтерпрайз-проекта разом.',
        displayWords: ['Контекст', '5', 'миллионов', 'токенов:', 'загружай', 'весь', 'репозиторий', 'целиком.'],
        rate: '+8%',
        imagePrompt: 'Google Veo immense glowing data repository visualised as infinite crystal archive layers, clean minimalist tech aesthetic, emerald bokeh, 9:16 frame',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Модель находит скрытые баги в десятках микросервисов за полсекунды и моментально рефакторит устаревший легаси.',
        displayWords: ['Находит', 'баги', 'в', 'десятках', 'сервисов', 'за', 'полсекунды!'],
        rate: '+8%',
        imagePrompt: 'Google Veo clean minimalist terminal displaying instant automated bug scan across 50 microservices, 0 ms latency, pristine studio lighting, 9:16 frame',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'В терминале и редакторе это ощущается не как ожидание ответа, а как чтение твоих мыслей в реальном времени.',
        displayWords: ['Ощущается', 'как', 'чтение', 'мыслей', 'в', 'реальном', 'времени.'],
        rate: '+8%',
        imagePrompt: 'Google Veo modern programmer interacting with floating glass holographic code lines with zero delay, Apple tech elegance, 9:16 frame',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Скорость решает всё. Сохраняй ролик и тестируй Flash 3.8 в своих проектах!',
        displayWords: ['Скорость', 'решает', 'всё!', 'Сохраняй', 'шпаргалку', 'и', 'подписывайся!'],
        rate: '+6%',
        imagePrompt: 'Google Veo pristine glowing lightning badge labeled Flash 3.8 over sleek dark workstation, emerald accents, 9:16 frame',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['gemini flash 3.8', 'gemini flash', 'google gemini', 'ai coding', 'infinite context', 'vibe coding', 'shorts', 'programming'],
    title: 'Gemini Flash 3.8: скорость света и бесконечный контекст ⚡ #shorts',
    description: 'Разбираем новый Gemini Flash 3.8: 5 миллионов токенов контекста, нулевой пинг и мгновенный рефакторинг целых репозиториев!\n\n#shorts #gemini #geminiflash #ai #programming #vibecoding #developer #code',
  },
  {
    topic: 'Google Veo в нашем пайплайне: видео без людей и камер за 60 секунд',
    angle: 'Нейровидеогенерация Google Veo прямо в Remotion: будущее контента',
    hook: 'Этот ролик полностью сгенерирован нейросетью Google Veo без людей, камер и монтажера!',
    style_preset: 'y2k_retro',
    segments: [
      {
        id: 1,
        text: 'Этот ролик полностью сгенерирован нейросетью Google Veo без съемочной группы, камер и человека за монтажным столом!',
        displayWords: ['Этот', 'ролик', 'полностью', 'создан', 'Google', 'Veo', 'без', 'камер', 'и', 'людей!'],
        rate: '+6%',
        imagePrompt: 'Google Veo cyberpunk film director chair empty with glowing holographic camera running Google Veo neural video engine, neon magenta and cyan, 9:16 frame',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Мы подключили API Google Veo прямо в Remotion код. Текстовый сценарий на лету превращается в кинематографичный вертикальный видеоряд.',
        displayWords: ['API', 'Google', 'Veo', 'внутри', 'Remotion:', 'код', 'сам', 'создает', 'видеоряд.'],
        rate: '+8%',
        imagePrompt: 'Google Veo dynamic visual of code generating neural cinema reels in real time, vibrant neon streams, CRT scanlines, Y2K retro cyber tech, 9:16 frame',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'Нейросеть выдерживает постоянную композицию персонажей и освещения между сценами с идеальным битрейтом и динамикой.',
        displayWords: ['Идеальная', 'динамика,', 'свет', 'и', 'кинематографичный', 'битрейт.'],
        rate: '+8%',
        imagePrompt: 'Google Veo multiple vertical cinema video monitors syncing ultra high quality generated scenes, vivid cyberpunk vaporwave lighting, 9:16 frame',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Больше никаких статичных картинок и скучных слайдов — только чистый автономный видеопродакшн двадцать шестого года.',
        displayWords: ['Забудь', 'про', 'статику:', 'только', 'чистый', 'нейро-видеопродакшн!'],
        rate: '+8%',
        imagePrompt: 'Google Veo futuristic AI video production dashboard rendering 9:16 clips at 60fps, glowing holographic badges, retro futurism, 9:16 frame',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Хочешь такой же автономный пайплайн? Ставь лайк и пиши в комментариях "Veo"!',
        displayWords: ['Хочешь', 'такой', 'пайплайн?', 'Пиши', 'Veo', 'в', 'комментах', 'и', 'подписывайся!'],
        rate: '+6%',
        imagePrompt: 'Google Veo neon retro glowing sign saying GOOGLE VEO AUTOMATION over futuristic cyber studio, neon magenta glow, 9:16 frame',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['google veo', 'veo video', 'ai video', 'remotion', 'automated pipeline', 'shorts', 'vibecoding', 'programming'],
    title: 'Google Veo в Remotion: видеогенерация 9:16 без камер 🎬 #shorts',
    description: 'Как мы подключили нейровидеогенерацию Google Veo в автоматический Remotion пайплайн. Ролики генерируются и монтируются кодом!\n\n#shorts #googleveo #veo #ai #remotion #automation #vibecoding #programming',
  },
  {
    topic: 'Автономные фабрики разработки на базе Astra 6 и Sonnet 5.5',
    angle: 'Автономная разработка: рои агентов пишут и деплоят прод без человека',
    hook: 'Программисты больше не нужны? Новые фабрики кода на Astra 6 и Sonnet 5.5 пишут прод за минуты!',
    style_preset: 'street_grunge',
    segments: [
      {
        id: 1,
        text: 'Программисты больше не нужны? Новые фабрики разработки на базе Astra 6 и Sonnet 5.5 пишут прод за считанные минуты!',
        displayWords: ['Программисты', 'всё?', 'Фабрики', 'на', 'Astra', '6', 'пишут', 'прод', 'за', 'минуты!'],
        rate: '+6%',
        imagePrompt: 'Google Veo grungy urban wall with bold street art stencil of autonomous AI agents taking over code factory, high voltage neon yellow spray paint, 9:16 frame',
        kenBurns: 'zoom_in',
      },
      {
        id: 2,
        text: 'Архитектурный агент на Sonnet 5.5 декомпозирует задачу на микросервисы и раздает задачи пулу воркеров.',
        displayWords: ['Sonnet', '5.5', 'декомпозирует', 'задачу', 'и', 'руководит', 'роем', 'воркеров.'],
        rate: '+8%',
        imagePrompt: 'Google Veo industrial dark server room with glowing neural master node directing hundreds of worker processes, raw concrete textures, 9:16 frame',
        kenBurns: 'pan_down',
      },
      {
        id: 3,
        text: 'А рой агентов на GPT Astra 6 параллельно пишет код, прогоняет тесты и автоматически деплоит контейнеры в прод.',
        displayWords: ['Рой', 'Astra', '6', 'пишет', 'код,', 'тестирует', 'и', 'деплоит', 'в', 'кластер.'],
        rate: '+8%',
        imagePrompt: 'Google Veo high speed terminal swarm running parallel unit tests with 100% green pass marks, dramatic edgy high contrast lighting, 9:16 frame',
        kenBurns: 'tilt_zoom',
      },
      {
        id: 4,
        text: 'Человек теперь не пишет строки кода, а выступает в роли дирижера и главного продакт-оунера всей системы.',
        displayWords: ['Ты', 'больше', 'не', 'кодер,', 'ты', '—', 'дирижёр', 'автономной', 'системы.'],
        rate: '+8%',
        imagePrompt: 'Google Veo rebel engineer overseeing massive holographic cluster of working AI agents, dark alley cyberpunk street grunge, 9:16 frame',
        kenBurns: 'pan_up',
      },
      {
        id: 5,
        text: 'Будущее уже наступило. Сохраняй ролик, чтобы не отстать от трендов разработки!',
        displayWords: ['Будущее', 'наступило!', 'Сохраняй', 'ролик', 'и', 'подписывайся', 'на', 'канал!'],
        rate: '+6%',
        imagePrompt: 'Google Veo bold stencil typography saying AI FACTORY 2026 glowing in neon yellow over raw concrete wall, street grunge aesthetic, 9:16 frame',
        kenBurns: 'zoom_out',
      },
    ],
    keywords: ['astra 6', 'claude sonnet 5.5', 'autonomous dev', 'ai swarm', 'ai agents', 'vibe coding', 'shorts', 'programming'],
    title: 'Автономные фабрики разработки: Astra 6 + Sonnet 5.5 🤖 #shorts',
    description: 'Как распределенные рои агентов на базе GPT Astra 6 и Claude Sonnet 5.5 проектируют, пишут и деплоят прод без участия человека.\n\n#shorts #astra6 #sonnet5 #aiagents #autodev #vibecoding #programming #developer',
  },
];

/**
 * Получение номера следующего цикла из состояния
 */
export function getNextCycleNumber() {
  const statePath = path.join(sharedDir, 'pipeline_state.json');
  try {
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      return (Number(state.lastCycle) || 0) + 1;
    }
  } catch (e) {
    // ignore
  }
  return 1;
}

/**
 * Сохранение состояния пайплайна
 */
export function savePipelineState(cycleNumber, status, videoUrl = null, error = null, topic = null, stylePreset = null) {
  const statePath = path.join(sharedDir, 'pipeline_state.json');
  const vsStatePath = path.join(vsShared, 'pipeline_state.json');
  let state = { lastCycle: 0, history: [] };
  try {
    if (fs.existsSync(statePath)) {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      if (!Array.isArray(state.history)) state.history = [];
    }
  } catch (e) {}

  state.lastCycle = cycleNumber;
  state.lastRunAt = new Date().toISOString();
  state.history.unshift({
    cycle: cycleNumber,
    topic,
    stylePreset,
    timestamp: new Date().toISOString(),
    status,
    url: videoUrl,
    error,
  });
  if (state.history.length > 50) state.history = state.history.slice(0, 50);

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(vsStatePath, JSON.stringify(state, null, 2));
}

/**
 * [Шаг 1] Генерация сценария, визуала и выбор стиля (Style Variation Engine)
 */
export async function step1_generateTrend(runIndex = 0, requestedStyle = null) {
  log('Запуск [Шаг 1]: Генерация тренда 2026, сценария и выбор визуального стиля...', 'STEP 1');
  
  // Считываем динамический стоп-лист из аналитики
  let stopList = [];
  try {
    const stopListPath = path.join(sharedDir, 'stop_list.json');
    if (fs.existsSync(stopListPath)) {
      const parsed = JSON.parse(fs.readFileSync(stopListPath, 'utf8'));
      stopList = parsed.stop_topics || [];
    }
  } catch (_) {}

  // Выбираем валидную тему из пула 2026 (Sonnet 5.5, GPT Astra 6, Flash 3.8)
  const pool = (TRENDS_POOL_2026 && TRENDS_POOL_2026.length > 0) ? TRENDS_POOL_2026 : VIRAL_TRENDS_POOL;
  let trend = pool[runIndex % pool.length];

  const validation = validateTrend2026(trend, stopList);
  if (!validation.valid) {
    log(`[Фильтр 2026] Тема "${trend.topic}" отклонена: ${validation.reason}. Поиск альтернативы...`, 'WARN');
    for (const alt of pool) {
      if (validateTrend2026(alt, stopList).valid) {
        trend = alt;
        break;
      }
    }
  }

  // Выбор стиля из пула пресетов (Dark/Gritty, Y2K/Retro, Minimalist/Tech, Street/Grunge)
  const stylePresetObj = getStylePreset(requestedStyle || trend.style_preset);
  log(`Выбран визуальный стиль: [${stylePresetObj.name}] (${stylePresetObj.description})`, 'STYLE');

  const brandBotHandle = process.env.BRAND_BOT_HANDLE || '@AIBot';
  const enableBrandPill = process.env.ENABLE_BRAND_PILL !== 'false';

  const trendData = {
    topic: trend.topic,
    angle: trend.angle,
    hook: trend.hook,
    style_preset: stylePresetObj.id,
    style_name: stylePresetObj.name,
    style_badge: stylePresetObj.badgeText,
    audience: 'разработчики, мидлы, сеньоры и пет-проджектеры',
    keywords: trend.keywords,
    rationale: 'Высокий интерес сообщества разработчиков к автоматизации написания кода и инструментам vibe coding.',
    confidence: 0.95,
    selectedPoolIndex: runIndex % pool.length,
    segments: trend.segments,
    brandBotHandle,
    enableBrandPill,
  };

  const trendPath = path.join(sharedDir, 'trend.json');
  fs.writeFileSync(trendPath, JSON.stringify(trendData, null, 2));
  fs.writeFileSync(path.join(vsShared, 'trend.json'), JSON.stringify(trendData, null, 2));

  log(`Тема утверждена: "${trend.topic}" (Стиль: "${stylePresetObj.name}")`, 'STEP 1');
  return { ...trend, stylePresetObj, brandBotHandle, enableBrandPill };
}

/**
 * [Шаг 2] Синтез речи / озвучка и синхронизация временных меток сцен (Human TTS)
 */
export async function step2_synthesizeSpeech(trendWithStyle) {
  log('Запуск [Шаг 2]: Человечный синтез речи (ElevenLabs / Edge-TTS SSML) и пословные тайминги...', 'STEP 2');

  const tempDir = path.join(rootDir, 'temp_audio_orchestrate');
  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  const ffmpeg = path.join(vsDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
  const ffprobe = path.join(vsDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe');

  const segmentFiles = [];
  const allWordTimings = [];
  const sceneItems = [];
  let currentGlobalTime = 0.0;

  for (let i = 0; i < trendWithStyle.segments.length; i++) {
    const seg = trendWithStyle.segments[i];
    const segFile = path.join(tempDir, `seg_${i}.mp3`);

    let success = false;
    let segDuration = 0;

    // 1. Приоритетный путь: Человечный TTS через ElevenLabs / Edge-TTS SSML адаптер
    try {
      const humanRes = await synthesizeHumanSegment({
        text: seg.text,
        displayWords: seg.displayWords,
        outputFile: segFile,
        rate: seg.rate || '+5%',
      });
      if (humanRes && fs.existsSync(segFile) && fs.statSync(segFile).size > 500) {
        success = true;
        segDuration = humanRes.duration;
      }
    } catch (humanErr) {
      log(`[TTS] Адаптер сообщил: ${humanErr.message}. Запуск стандартного синтезатора...`, 'WARN');
    }

    // 2. Фолбэк на синтезатор synthesize_tts.py
    if (!success) {
      const pyScript = path.join(vsDir, 'synthesize_tts.py');
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          if (fs.existsSync(pyScript)) {
            execFileSync('python', [
              pyScript,
              '--text', seg.text,
              '--voice', 'ru-RU-SvetlanaNeural',
              '--rate', seg.rate || '+0%',
              '--output', segFile,
            ], { cwd: vsDir, stdio: 'pipe' });

            if (fs.existsSync(segFile) && fs.statSync(segFile).size > 500) {
              success = true;
              break;
            }
          }
        } catch (pyErr) {
          log(`[TTS] Попытка ${attempt} для сцены ${i + 1}: ${pyErr.message}`, 'WARN');
          await new Promise((r) => setTimeout(r, attempt * 1000));
        }
      }
    }

    if (!success) {
      throw new Error(`Синтез сегмента ${i + 1} не удался после всех попыток`);
    }

    if (!segDuration) {
      segDuration = parseFloat(
        execFileSync(ffprobe, [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          segFile,
        ]).toString().trim()
      );
    }

    segmentFiles.push(segFile);

    // Кинетические тайминги для слов
    const wordTimings = calculateWordTimings(seg.displayWords, segDuration, currentGlobalTime);
    allWordTimings.push(...wordTimings);

    const segStartTime = currentGlobalTime;
    currentGlobalTime += segDuration;

    sceneItems.push({
      id: i,
      text: seg.text,
      displayWords: seg.displayWords,
      imagePrompt: seg.imagePrompt,
      kenBurns: seg.kenBurns,
      shotType: seg.shotType || 'dynamic tracking',
      isCtaOutro: seg.isCtaOutro || (i === trendWithStyle.segments.length - 1),
      startTime: Number(segStartTime.toFixed(2)),
      endTime: Number(currentGlobalTime.toFixed(2)),
      duration: Number(segDuration.toFixed(2)),
    });

    await new Promise((r) => setTimeout(r, 100));
  }

  // Склейка всех частей озвучки в shared/audio.mp3
  const concatList = path.join(tempDir, 'concat_list.txt');
  fs.writeFileSync(concatList, segmentFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n'));

  const finalAudioPath = path.join(sharedDir, 'audio.mp3');
  execFileSync(ffmpeg, ['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-c', 'copy', finalAudioPath]);

  const totalDuration = parseFloat(
    execFileSync(ffprobe, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      finalAudioPath,
    ]).toString().trim()
  );

  // Копируем аудио в компоненты видео
  fs.copyFileSync(finalAudioPath, path.join(vsShared, 'audio.mp3'));
  fs.copyFileSync(finalAudioPath, path.join(vsPublic, 'audio.mp3'));

  fs.rmSync(tempDir, { recursive: true, force: true });
  log(`Озвучка готова: ${finalAudioPath} (${totalDuration.toFixed(2)}s, слов: ${allWordTimings.length})`, 'STEP 2');

  const botHandle = trendWithStyle.brandBotHandle || '@AIBot';
  const cleanHandle = botHandle.replace('@', '');
  const ctaLink = `https://t.me/${cleanHandle}?start=yt_shorts`;

  return {
    topic: trendWithStyle.topic,
    source_trend: 'shared/trend.json',
    audio: 'shared/audio.mp3',
    duration: Number(totalDuration.toFixed(2)),
    words: allWordTimings,
    scenes: sceneItems,
    stylePreset: trendWithStyle.stylePresetObj.id,
    styleTheme: trendWithStyle.stylePresetObj.theme,
    brandBotHandle: trendWithStyle.brandBotHandle,
    enableBrandPill: trendWithStyle.enableBrandPill,
    youtube: {
      title: trendWithStyle.title,
      description: `${trendWithStyle.description}\n\n🤖 Забирай исходники, готовый стек и бонусы в боте:\n${ctaLink}`,
      pinnedComment: `🔥 Все материалы, исходный код и бонусы ждут тебя в Telegram-боте: ${ctaLink} Переходи и фарми поинты! 🚀`,
      tags: trendWithStyle.keywords,
      madeForKids: false,
      visibility: 'public',
    },
  };
}

/**
 * [Шаг 2.5] Модуль генерации кадров и Veo видеоряда под анимацию
 */
export async function step2_5_generateSceneImages(dataJson, stylePresetObj) {
  log(`Запуск [Шаг 2.5]: Генерация 9:16 кадров и Veo видеоряда для ${dataJson.scenes.length} сцен в стиле "${stylePresetObj.name}"...`, 'IMAGES');
  const enrichedScenes = await generateScenesVisuals(dataJson.scenes, stylePresetObj);

  // Подключение генератора видеоряда Google Veo для каждой сцены
  for (let i = 0; i < enrichedScenes.length; i++) {
    const sc = enrichedScenes[i];
    const imagePath = sc.imageFile ? path.join(vsPublic, sc.imageFile) : null;
    try {
      const veoResult = await generateVeoSceneClip({
        sceneId: i,
        prompt: sc.imagePrompt || sc.text,
        duration: sc.duration || 4.0,
        fallbackImage: imagePath,
        isOutro: sc.isCtaOutro || (i === enrichedScenes.length - 1),
      });
      if (veoResult && veoResult.videoFile) {
        sc.videoFile = veoResult.videoFile;
      }
    } catch (veoErr) {
      log(`[Veo Engine] Пропуск генерации видеоклипа для сцены ${i + 1}: ${veoErr.message}`, 'WARN');
    }
  }

  dataJson.scenes = enrichedScenes;
  dataJson.brandBotHandle = process.env.BRAND_BOT_HANDLE || '@AIBot';
  dataJson.enableBrandPill = process.env.ENABLE_BRAND_PILL !== 'false';

  const dataPath = path.join(sharedDir, 'data.json');
  fs.writeFileSync(dataPath, JSON.stringify(dataJson, null, 2));
  fs.writeFileSync(path.join(vsShared, 'data.json'), JSON.stringify(dataJson, null, 2));

  log(`Кадры и видеоряд успешно сгенерированы и привязаны к таймингам сцен!`, 'IMAGES');
  return dataJson;
}

/**
 * [Шаг 3] Сборка ролика с фоновой музыкой и субтитрами в out/video.mp4
 */
export async function step3_renderAndMix(dataJson) {
  log('Запуск [Шаг 3]: Рендер Remotion и микширование фоновой музыки...', 'STEP 3');

  // 1. Убеждаемся, что музыкальная библиотека заполнена
  await ensureMusicLibrary();

  // 2. Рендерим Remotion MyComp в промежуточное видео
  const remotionBin = path.join(vsDir, 'node_modules', '.bin', 'remotion.cmd');
  const rawVideoPath = path.join(outDir, 'video_raw.mp4');

  log('Запуск рендера видеоряда через Remotion CLI...', 'STEP 3');
  execSync(`"${remotionBin}" render src/index.ts MyComp "${rawVideoPath}"`, {
    cwd: vsDir,
    stdio: 'inherit',
  });

  if (!fs.existsSync(rawVideoPath)) {
    throw new Error(`Remotion не создал файл ${rawVideoPath}`);
  }

  // 3. Выбираем случайный трек из assets/music
  const bgmTrack = await getRandomBgmTrack();
  log(`Выбран фоновый трек: ${path.basename(bgmTrack)}`, 'STEP 3');

  // 4. Микшируем BGM (громкость 12%, зацикливание, плавное затухание 2 сек)
  const finalVideoPath = path.join(outDir, 'video.mp4');
  mixBgmIntoVideo({
    inputVideo: rawVideoPath,
    bgmTrack: bgmTrack,
    outputVideo: finalVideoPath,
  });

  // Зеркалируем в video-shorts/out
  fs.copyFileSync(finalVideoPath, path.join(vsOut, 'video.mp4'));

  const finalSizeMb = (fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(2);
  log(`[Шаг 3] Ролик с музыкой успешно собран: ${finalVideoPath} (${finalSizeMb} MB)`, 'STEP 3');
  return finalVideoPath;
}

/**
 * [Шаг 3.5] Аудио-видео валидатор (Sync & Pacing QA Subagent)
 */
export async function step3_5_validateSync(dataJson, finalVideoPath) {
  log('Запуск [Шаг 3.5]: Аудио-видео валидатор (Sync & Pacing QA Subagent)...', 'QA');
  const audioPath = path.join(sharedDir, 'audio.mp3');
  const dataPath = path.join(sharedDir, 'data.json');

  const qaResult = await validateShortsSync({
    audioPath,
    videoPath: finalVideoPath,
    dataPath,
    autoFixFn: async ({ targetDuration }) => {
      log(`[QA Subagent] Авто-коррекция хронометража видеоряда до ${targetDuration}s...`, 'QA');
      dataJson.duration = targetDuration;
      fs.writeFileSync(dataPath, JSON.stringify(dataJson, null, 2));
      fs.writeFileSync(path.join(vsShared, 'data.json'), JSON.stringify(dataJson, null, 2));

      // Повторный рендер с точной длиной
      const remotionBin = path.join(vsDir, 'node_modules', '.bin', 'remotion.cmd');
      const rawVideoPath = path.join(outDir, 'video_raw.mp4');
      execSync(`"${remotionBin}" render src/index.ts MyComp "${rawVideoPath}"`, {
        cwd: vsDir,
        stdio: 'inherit',
      });

      // Повторное сведение аудио
      const bgmTrack = await getRandomBgmTrack();
      mixBgmIntoVideo({
        inputVideo: rawVideoPath,
        bgmTrack,
        outputVideo: finalVideoPath,
      });
      fs.copyFileSync(finalVideoPath, path.join(vsOut, 'video.mp4'));
    },
  });

  if (qaResult.status !== 'PASSED') {
    throw new Error(`QA Валидатор отклонил публикацию: ${qaResult.reason}`);
  }

  log(`[QA Subagent] Валидация PASSED! Ролик допущен к публикации. (Длина: ${qaResult.videoDuration.toFixed(2)}s, дрейф: ${qaResult.maxDriftMs || 0}ms)`, 'QA');
  return qaResult;
}

/**
 * Проверка и запуск локального прокси Xray для доступа к YouTube Studio
 */
export async function ensureProxyRunning() {
  try {
    const net = await import('net');
    const isListening = await new Promise((resolve) => {
      const s = new net.Socket();
      s.setTimeout(1000);
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('timeout', () => { s.destroy(); resolve(false); });
      s.on('error', () => { s.destroy(); resolve(false); });
      s.connect(10809, '127.0.0.1');
    });
    if (isListening) return true;
  } catch (e) {}

  const xrayBin = 'C:\\Users\\novoz\\Desktop\\v2rayN-windows-64\\bin\\xray\\xray.exe';
  const xrayConfig = 'C:\\Users\\novoz\\Desktop\\v2rayN-windows-64\\xray_youtube.json';
  if (fs.existsSync(xrayBin) && fs.existsSync(xrayConfig)) {
    log('Запуск локального сервиса Xray для стабильного доступа к YouTube Studio...', 'PROXY');
    const { spawn } = await import('child_process');
    const child = spawn(xrayBin, ['run', '-config', xrayConfig], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    await new Promise((r) => setTimeout(r, 2500));
    return true;
  }
  return false;
}

/**
 * [Шаг 4] Выгрузка на YouTube Studio через upload_youtube.mjs
 */
export async function step4_upload() {
  log('Запуск [Шаг 4]: Автономная публикация на YouTube Studio...', 'STEP 4');
  await ensureProxyRunning();

  const uploadScript = path.join(vsDir, 'upload_youtube.mjs');
  const stdout = execSync(`node "${uploadScript}"`, {
    cwd: vsDir,
    encoding: 'utf8',
  });

  // Поиск ссылки на Shorts в выводе
  const match = stdout.match(/https:\/\/youtube\.com\/shorts\/[a-zA-Z0-9_-]+/);
  const videoUrl = match ? match[0] : 'https://youtube.com/shorts/published';

  log(`[Шаг 4] Публикация успешна! Ссылка: ${videoUrl}`, 'STEP 4');
  return videoUrl;
}

/**
 * Полный цикл выполнения пайплайна с ротацией стилей, генерацией кадров и QA валидатором
 */
export async function runFullPipeline(specifiedCycle = null, requestedStyle = null) {
  const cycleNumber = specifiedCycle !== null && !isNaN(Number(specifiedCycle))
    ? Number(specifiedCycle)
    : getNextCycleNumber();

  const startTime = Date.now();
  log(`====================================================`, 'PIPELINE');
  log(`СТАРТ ОБНОВЛЕННОГО ЦИКЛА ПАЙПЛАЙНА #${cycleNumber}`, 'PIPELINE');
  log(`====================================================`, 'PIPELINE');

  let activeTrend = null;
  try {
    // Шаг 1: Тренд + Выбор стиля (Style Variation Engine)
    activeTrend = await step1_generateTrend(cycleNumber - 1, requestedStyle);

    // Шаг 2: Синтез речи и разметка сцен
    const dataJson = await step2_synthesizeSpeech(activeTrend);

    // Шаг 2.5: Генерация вертикальных 9:16 изображений под Ken Burns анимацию
    const dataWithImages = await step2_5_generateSceneImages(dataJson, activeTrend.stylePresetObj);

    // Шаг 3: Рендер Remotion с Ken Burns анимацией + Микширование BGM
    const videoPath = await step3_renderAndMix(dataWithImages);

    // Шаг 3.5: Аудио-видео валидатор (Sync & Pacing QA Subagent)
    await step3_5_validateSync(dataWithImages, videoPath);

    // Шаг 4: Автономная выгрузка на YouTube Studio
    const videoUrl = await step4_upload();

    const elapsedMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    log(`Ц И К Л #${cycleNumber} [${activeTrend.stylePresetObj.name}] УСПЕШНО ЗАВЕРШЁН за ${elapsedMin} мин. Видео: ${videoUrl}`, 'SUCCESS');

    savePipelineState(cycleNumber, 'SUCCESS', videoUrl, null, activeTrend.topic, activeTrend.stylePresetObj.id);
    return { success: true, url: videoUrl, cycle: cycleNumber, topic: activeTrend.topic, style: activeTrend.stylePresetObj.name };
  } catch (err) {
    log(`ОШИБКА В ЦИКЛЕ #${cycleNumber}: ${err.message}`, 'ERROR');
    if (err.stack) {
      log(`Стек ошибки: ${err.stack}`, 'ERROR');
    }
    savePipelineState(cycleNumber, 'FAILED', null, err.message, activeTrend?.topic || 'Unknown', activeTrend?.stylePresetObj?.id || null);
    return { success: false, error: err.message, cycle: cycleNumber };
  }
}

// Прямой запуск скрипта
if (process.argv[1] && (process.argv[1].endsWith('orchestrate.mjs') || process.argv[1].endsWith('run_pipeline.mjs'))) {
  const argCycle = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  const argStyle = process.argv[3] || null;
  runFullPipeline(argCycle, argStyle).catch(console.error);
}
